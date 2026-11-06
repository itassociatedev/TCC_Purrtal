<?php
// Integration checks use rollback-only preview data and fake all notifications.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Http\Controllers\TicketController;
use App\Models\{Ticket, User};
use App\Services\{TicketAccess, TicketWorkbook};
use Illuminate\Http\{Request, UploadedFile};
use Illuminate\Support\Facades\{Auth, DB, Route, Notification};
use PhpOffice\PhpSpreadsheet\{Spreadsheet, IOFactory};
use PhpOffice\PhpSpreadsheet\Cell\DataType;
$check = function ($condition, $message) { if (!$condition) throw new RuntimeException($message); echo "PASS: {$message}\n"; };
$users = User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->with('role')->get();
$leader = $users->first(fn ($u) => TicketAccess::role($u) === 'leader');
$employee = $users->first(fn ($u) => TicketAccess::role($u) === 'employee' && TicketAccess::branches($u)->exists());
$admin = User::with('role')->get()->first(fn ($u) => TicketAccess::canPreview($u));
Auth::setUser($admin); Notification::fake();
$controller = app(TicketController::class);
$session = $app['session']->driver();
$request = function ($name, $input) use ($admin, $session) {
    $r = Request::create('/tickets/preview', str_ends_with($name, 'import') ? 'POST' : 'GET', $input);
    $r->setUserResolver(fn () => $admin);
    $r->setRouteResolver(fn () => Route::getRoutes()->getByName($name));
    $r->setLaravelSession($session);
    return $r;
};
$path = __DIR__.'/.ticket-workbook-'.bin2hex(random_bytes(5)).'.xlsx';
DB::beginTransaction();
try {
    $book = new Spreadsheet();
    $book->getActiveSheet()->fromArray([TicketWorkbook::HEADERS, [$employee->id, TicketAccess::branches($employee)->first()->name, '=1+1', 'Hardware', 'High', 'Operations', 'Printer', 'Cannot print', 'Reception delayed', 'https://example.com/file']]);
    // A literal formula-looking subject is supported, but executable workbook formulas are rejected.
    $book->getActiveSheet()->setCellValueExplicit('C2', '=1+1', DataType::TYPE_STRING);
    IOFactory::createWriter($book, 'Xlsx')->save($path); $book->disconnectWorksheets();
    $rows = app(TicketWorkbook::class)->read($path);
    $data = app(TicketWorkbook::class)->validateRows($rows, true);
    $check(count($data) === 1 && $data[0]['creator_id'] === $employee->id && $data[0]['priority'] === 'high', 'XLSX rows validate employee, branch and initial priority');
    try { app(TicketWorkbook::class)->validateRows([array_replace($rows[0], [3 => 'Invalid category'])], true); throw new RuntimeException('Invalid row accepted'); }
    catch (Illuminate\Validation\ValidationException $e) { $check(isset($e->errors()['row_2']), 'Invalid rows return row-numbered errors'); }
    $before = Ticket::where('is_preview', true)->count();
    $req = $request('tickets.preview.import', ['preview_user' => $leader->id, 'mode' => 'preview']);
    $req->files->set('file', new UploadedFile($path, 'tickets.xlsx', null, null, true));
    $controller->workbookImport($req);
    $check(Ticket::where('is_preview', true)->count() === $before, 'Validation preview creates no tickets');
    $key = 'tickets.import.1.'.$leader->id;
    $pending = $session->get($key);
    $controller->workbookImport($request('tickets.preview.import', ['preview_user' => $leader->id, 'mode' => 'confirm', 'token' => $pending['token']]));
    $ticket = Ticket::where('subject', '=1+1')->where('is_preview', true)->latest('id')->firstOrFail();
    $check(Ticket::where('is_preview', true)->count() === $before + 1 && $ticket->sla_policy && $ticket->creator_id === $employee->id, 'Confirmation creates a new SLA-tracked ticket for the correct employee');
    Notification::assertNothingSent();
    $check(!$session->has($key), 'Successful import consumes preview token');
    try { $controller->workbookImport($request('tickets.preview.import', ['preview_user' => $leader->id, 'mode' => 'confirm', 'token' => $pending['token']])); throw new RuntimeException('Token replay accepted'); }
    catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { $check($e->getStatusCode() === 422, 'Repeat confirmation cannot duplicate tickets'); }
    foreach (['import', 'template'] as $action) {
        try {
            $req = $request('tickets.preview.'.$action, ['preview_user' => $employee->id, 'mode' => 'cancel']);
            $action === 'import' ? $controller->workbookImport($req) : $controller->workbookTemplate($req);
            throw new RuntimeException('Employee import access accepted');
        } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { $check($e->getStatusCode() === 403, 'Import/template restricted to leadership'); }
    }
    foreach (['tickets.preview.export', 'tickets.export'] as $exportRoute) {
        try {
            $req = $request($exportRoute, ['preview_user' => $employee->id, 'view' => 'all']);
            if ($exportRoute === 'tickets.export') $req->setUserResolver(fn () => $employee);
            $controller->index($req);
            throw new RuntimeException('Non-IT export accepted');
        } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { $check($e->getStatusCode() === 403, 'Non-IT employee export blocked on live and preview routes'); }
    }
    $req = $request('tickets.preview.export', ['preview_user' => $leader->id, 'view' => 'all', 'search' => '=1+1', 'per_page' => '5']);
    $response = $controller->index($req);
    ob_start(); ($response->getCallback())(); $bytes = ob_get_clean(); file_put_contents($path, $bytes);
    $book = IOFactory::load($path);
    $sheet = $book->getSheetByName('Tickets');
    $check($sheet->getHighestRow() === 2 && $sheet->getCell('A2')->getValue() === $ticket->ticket_code, 'Export follows authorized search filters and shows the category ticket ID');
    $check($sheet->getCell('B2')->getDataType() === DataType::TYPE_STRING && $sheet->getCell('B2')->getValue() === '=1+1', 'Export writes formula-looking text as a safe string');
    $check($book->getSheetByName('Ticket reports') !== null, 'Leader retains report export access');
    $book->disconnectWorksheets();
    $req = $request('tickets.preview.export', ['preview_user' => $leader->id, 'view' => 'all', 'status_filter' => 'closed', 'per_page' => '5']);
    $response = $controller->index($req); ob_start(); ($response->getCallback())(); file_put_contents($path, ob_get_clean());
    $book = IOFactory::load($path);
    $check($book->getSheetByName('Tickets')->getHighestRow() - 1 === Ticket::where('is_preview', true)->where('status', 'closed')->count(), 'Leader export includes all matching rows beyond table pagination');
    $check($book->getSheetByName('Ticket reports') && $book->getSheetByName('SLA performance') && $book->getSheetByName('Staff workload'), 'Leader workbook includes report sheets and scope metadata');
    $book->disconnectWorksheets();
    $member = $users->first(fn ($u) => TicketAccess::role($u) === 'member');
    $response = $controller->index($request('tickets.preview.export', ['preview_user' => $member->id, 'view' => 'assigned']));
    ob_start(); ($response->getCallback())(); file_put_contents($path, ob_get_clean());
    $book = IOFactory::load($path);
    $check($book->getSheetByName('Tickets') !== null && $book->getSheetByName('Staff workload') === null, 'IT member retains scoped export without leader-only reports');
    $book->disconnectWorksheets();
    echo "Workbook checks passed. All test writes rolled back.\n";
} finally { DB::rollBack(); $session->forget('tickets.import.1.'.$leader->id); if (is_file($path)) unlink($path); }
