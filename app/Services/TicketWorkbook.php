<?php

namespace App\Services;

use App\Models\{Ticket, User, Branch};
use Illuminate\Support\Facades\{DB, Validator};
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\{Spreadsheet, IOFactory};
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;

class TicketWorkbook
{
    public const HEADERS = ['employee_id', 'branch_affected', 'subject', 'category', 'priority', 'department', 'affected_system', 'details', 'impact', 'supporting_links'];

    // Explicit string cells prevent user-entered text from becoming Excel formulas.
    public function download(array $sheets, string $filename)
    {
        $book = new Spreadsheet();
        $book->removeSheetByIndex(0);
        foreach ($sheets as $name => $rows) {
            $sheet = $book->createSheet()->setTitle($name);
            foreach ($rows as $r => $row) foreach (array_values($row) as $c => $value) {
                $sheet->setCellValueExplicit([$c + 1, $r + 1], (string) ($value ?? ''), DataType::TYPE_STRING);
            }
            $sheet->freezePane('A2');
            $sheet->getStyle('1:1')->getFont()->setBold(true);
            $sheet->getStyle($sheet->calculateWorksheetDimension())->getAlignment()->setWrapText(true);
            foreach ($sheet->getColumnIterator() as $column) $sheet->getColumnDimension($column->getColumnIndex())->setWidth(24);
            if (count($rows) > 1) $sheet->setAutoFilter($sheet->calculateWorksheetDimension());
        }
        $book->setActiveSheetIndex(0);
        return response()->streamDownload(function () use ($book) {
            try { IOFactory::createWriter($book, 'Xlsx')->save('php://output'); }
            finally { $book->disconnectWorksheets(); }
        }, $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    public function export($query, array $reports, array $sla, $workloads, array $summary, array $filters, string $role)
    {
        abort_if((clone $query)->count() > 10000, 422, 'Narrow your filters to 10,000 tickets or fewer before exporting.');
        $rows = [['Ticket ID', 'Subject', 'Description', 'Category', 'Status', 'Created at', 'Priority', 'Branch', 'Creator', 'Assigned to', 'Response SLA', 'Resolution SLA']];
        foreach ($query->get() as $ticket) {
            $snapshot = app(TicketSla::class)->snapshot($ticket);
            $rows[] = [$ticket->ticket_code, $ticket->subject, $ticket->description, $ticket->category, $ticket->status,
                $ticket->created_at->timezone('Asia/Manila')->format('Y-m-d H:i:s'),
                TicketPrioritySettings::labels()[$ticket->priority ?? ''] ?? 'Low',
                $ticket->affectedLocationName(), $ticket->employee_name, $ticket->assignee?->name,
                $snapshot['response_status'] ?? 'Excluded', $snapshot['resolution_status'] ?? 'Excluded'];
        }
        $sheets = ['Tickets' => $rows, 'Export scope' => [['Filter', 'Value'], ['Exported at', now('Asia/Manila')->format('Y-m-d H:i:s')], ['Role', $role], ['Tickets scope', 'All matching rows; pagination ignored']]];
        foreach ($filters as $key => $value) $sheets['Export scope'][] = [$key, $value];
        $sheets['Dashboard summary'] = [['Metric', 'Count'], ...collect($summary)->map(fn ($v, $k) => [$k, $v])->values()->all()];
        if ($role === 'leader') {
            $sheets['Ticket reports'] = [['Metric', 'Count'], ...collect($reports)->map(fn ($v, $k) => [$k, $v])->values()->all()];
            $sheets['SLA performance'] = [['Metric', 'Value'], ...collect($sla)->map(fn ($v, $k) => [$k, $v])->values()->all()];
            $sheets['Staff workload'] = [['Staff', 'Assigned', 'Resolved incl closed', 'Resolved percent', 'Resolver rating', 'Rated tickets']];
            foreach ($workloads as $m) $sheets['Staff workload'][] = [$m['name'], $m['assigned_count'], $m['resolved_count'], number_format($m['assigned_count'] ? $m['resolved_count'] / $m['assigned_count'] * 100 : 0, 2, '.', ''), $m['rating_average'] ?? 'Not rated', $m['rating_count']];
            $sheets['Export scope'][] = ['Report scope', 'Dashboard, Ticket reports and staff workload use all environment tickets; SLA uses report_period. Only Tickets sheet uses table filters.'];
        }
        return $this->download($sheets, 'tcc-tickets-'.now('Asia/Manila')->format('Ymd-His').'.xlsx');
    }

    public function read(string $path): array
    {
        // Bound compressed and expanded input before the workbook parser runs.
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) throw ValidationException::withMessages(['file' => 'Upload a valid XLSX workbook.']);
        try {
            $size = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) $size += $zip->statIndex($i)['size'];
            if ($zip->numFiles > 200 || $size > 20 * 1024 * 1024) throw ValidationException::withMessages(['file' => 'Workbook is too large. Maximum expanded size is 20 MB.']);
        } finally { $zip->close(); }
        $reader = new Xlsx();
        $reader->setReadDataOnly(false); // Inspect formulas rather than calculating them.
        try {
            $info = $reader->listWorksheetInfo($path);
            if (count($info) > 3 || $info[0]['totalRows'] > 101 || $info[0]['totalColumns'] > count(self::HEADERS)) throw new \RuntimeException();
            $reader->setLoadSheetsOnly($info[0]['worksheetName']);
            $book = $reader->load($path);
            try {
                $sheet = $book->getSheet(0);
                foreach ($sheet->getCellCollection()->getCoordinates() as $coord) {
                    if ($sheet->getCell($coord)->getDataType() === DataType::TYPE_FORMULA) throw new \RuntimeException();
                }
                $rows = $sheet->toArray(null, false, false, false);
                if (array_map(fn ($v) => trim((string) $v), array_shift($rows)) !== self::HEADERS) throw new \RuntimeException();
                return array_values(array_filter($rows, fn ($row) => count(array_filter($row, fn ($v) => $v !== null && $v !== '')) > 0));
            } finally { $book->disconnectWorksheets(); }
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['file' => 'Use the XLSX template: maximum 100 rows, exact headers, no formulas.']);
        }
    }

    public function validateRows(array $rows, bool $preview): array
    {
        if (!$rows || count($rows) > 100) throw ValidationException::withMessages(['file' => 'Provide between 1 and 100 tickets.']);
        $valid = []; $errors = [];
        $previewIds = DB::table('ticket_preview_users')->pluck('user_id');
        foreach ($rows as $index => $row) {
            $raw = array_combine(self::HEADERS, array_pad(array_slice($row, 0, count(self::HEADERS)), count(self::HEADERS), null));
            $data = array_map(fn ($v) => trim((string) $v), $raw);
            $rules = ['employee_id' => 'required|integer', 'branch_affected' => 'required|string', 'subject' => 'required|string|max:180',
                'category' => ['required', \Illuminate\Validation\Rule::in(config('ticketing.categories'))],
                'priority' => ['nullable', \Illuminate\Validation\Rule::in(array_values(TicketPrioritySettings::labels()))],
                'department' => 'required|string|max:255', 'affected_system' => 'required|string|max:255', 'details' => 'required|string|max:10000', 'impact' => 'required|string|max:5000', 'supporting_links' => 'nullable|string|max:20000'];
            $validator = Validator::make($data, $rules);
            $messages = $validator->errors()->all();
            $user = User::find($data['employee_id']);
            if (!$user || $previewIds->contains($user->id) !== $preview) $messages[] = 'Employee ID must belong to this live/preview environment.';
            $branch = Branch::where('name', $data['branch_affected'])->first();
            if (!$branch || ($user && !TicketAccess::branches($user)->whereKey($branch->id)->exists())) $messages[] = 'Branch must match an allowed branch for this employee.';
            $links = preg_split('/\r?\n/', $data['supporting_links'], -1, PREG_SPLIT_NO_EMPTY);
            $linkValidation = Validator::make(['links' => $links], ['links' => 'array|max:10', 'links.*' => 'url:http,https|max:2048']);
            $messages = array_merge($messages, $linkValidation->errors()->all());
            if ($messages) { $errors['row_'.($index + 2)] = 'Row '.($index + 2).': '.implode(' ', $messages); continue; }
            $valid[] = ['creator_id' => $user->id, 'employee_name' => $user->name, 'branch_id' => $branch->id,
                'employee_department' => $user->department?->name ?: $data['department'], 'subject' => $data['subject'], 'category' => $data['category'],
                'priority' => array_flip(TicketPrioritySettings::labels())[$data['priority'] ?? ''] ?? 'low',
                'affected_asset' => $data['affected_system'], 'description' => $data['details'], 'operational_impact' => $data['impact'], 'supporting_links' => $links];
        }
        if ($errors) throw ValidationException::withMessages($errors);
        return $valid;
    }
}
