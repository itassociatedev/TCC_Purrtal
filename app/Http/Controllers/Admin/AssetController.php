<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage; // 泙 CRITICAL: Required for saving images
use App\Models\Department; // Make sure this is imported
use App\Models\Branch;      // <-- This is the one missing causing the crash!
use App\Models\SystemLog;   // 🟢 Added for tracking
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use App\Models\AssetImportBatch;
use App\Models\AssetImportItem;
use App\Exports\AssetTemplateExport;

use App\Models\AssetPhotoSubmission;
use App\Models\OrgChartMember;
use App\Support\AssetAccess;
use Illuminate\Support\Str;

class AssetController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        if (!AssetAccess::canViewOverview($user)) return redirect()->route('admin.assets.entry');

        $isIt = AssetAccess::isIt($user);
        $orgLeaderNames = OrgChartMember::query()->get(['name', 'position'])
            ->filter(fn ($member) => preg_match('/(team leader|supervisor|manager|head|director|chief|president)/i', $member->position ?? ''))
            ->pluck('name')
            ->map(fn ($name) => strtolower(trim($name)));
        $leaderUserIds = User::query()->get(['id', 'name'])
            ->filter(fn ($employee) => $orgLeaderNames->contains(strtolower(trim($employee->name))))
            ->pluck('id')
            ->values()
            ->all();

        $rejectedPhotos = AssetPhotoSubmission::with(['asset:id,name,asset_tag', 'submitter:id,name', 'reviewer:id,name'])
            ->where('status', 'rejected');
        if (!AssetAccess::canReviewPhotos($user) && !AssetAccess::isFullManager($user)) {
            $rejectedPhotos->where('submitted_by', $user->id);
        }

        return Inertia::render('Admin/Assets', [
            'assets' => Asset::with(['user', 'supplier', 'accountableUsers.department', 'accountableUsers.position'])->latest()->get(),
            'suppliers' => Supplier::where('status', 'Active')->orderBy('name')->get(['id', 'name']),
            'users' => User::with(['department', 'position', 'branches'])->orderBy('name')->get(),
            'leaderUserIds' => $leaderUserIds,
            'branches' => Branch::all(),
            'departments' => Department::all(),
            'rejectedPhotoSubmissions' => $rejectedPhotos->latest()->get(),
            'canReviewPhotos' => $isIt,
        ]);
    }

    public function entry()
    {
        $user = Auth::user();
        abort_unless(AssetAccess::canEnter($user), 403);

        return Inertia::render('Admin/AssetEntry', [
            'suppliers' => Supplier::where('status', 'Active')->orderBy('name')->get(['id', 'name']),
            'branches' => Branch::all(),
            'departments' => Department::all(),
            'rejectedPhotoSubmissions' => AssetPhotoSubmission::with(['asset:id,name,asset_tag', 'submitter:id,name', 'reviewer:id,name'])
                ->where('submitted_by', $user->id)
                ->where('status', 'rejected')
                ->latest()
                ->get(),
        ]);
    }

    public function masterlist()
    {
        // Security Bouncer for Admins
        $userRole = strtolower(trim(Auth::user()?->role?->name ?? ''));
        $isAdmin = AssetAccess::isFullManager(Auth::user());
        
        if ($isAdmin) {
            return redirect()->route('admin.assets.index');
        }

        $assets = Asset::with(['supplier', 'user', 'accountableUsers'])->latest()->get();
        
        return Inertia::render('Admin/AssetMasterlist', [
            'assets' => $assets,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'asset_tag' => 'required|string|max:255|unique:assets',
            'category' => 'nullable|string|max:255',
            'classification' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'branch' => 'nullable|string|max:255',
            'assigned_personnel' => 'nullable|string|max:255',
            'area' => 'nullable|string|max:255',
            'purchase_date' => 'nullable|date',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'supplier_name' => 'nullable|string|max:255',
            'warranty_expiration' => 'nullable|date',
            'deviation' => 'nullable|string|max:255',
            'condition' => 'required|string|max:255',
            'unit_value' => 'nullable|numeric|min:0',
            'qty' => 'nullable|integer|min:1',
            'asset_status' => 'required|string|max:255',
            'model_no' => 'nullable|string|max:255',
            'serial_no' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:255',
            'user_id' => 'nullable|exists:users,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120', // 泙 Validates image
        ]);

        $asset = new Asset();
        $asset->fill($request->except('image'));

        // 泙 HANDLE IMAGE SAVE
        if ($request->hasFile('image')) {
        }

        if (!empty($asset->purchase_date) && !empty($asset->warranty_expiration)) {
            $pDate = strtotime($asset->purchase_date);
            $wDate = strtotime($asset->warranty_expiration);
            $diff = round(($wDate - $pDate) / 86400);
            $asset->deviation = $diff . ' Days';
        }

        $asset->total_value = ($asset->unit_value * $asset->qty);
        $asset->save();

        if ($request->hasFile('image')) {
            $pendingPath = 'asset-photos/pending/' . Str::uuid() . '.' . $request->file('image')->extension();
            Storage::disk('local')->put($pendingPath, $request->file('image')->get());
            AssetPhotoSubmission::create([
                'asset_id' => $asset->id,
                'submitted_by' => $request->user()->id,
                'temporary_path' => $pendingPath,
            ]);
        }

        return back()->with('success', 'Asset created successfully.');
    }

    public function update(Request $request, Asset $asset)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'asset_tag' => 'required|string|max:255|unique:assets,asset_tag,' . $asset->id,
            'category' => 'nullable|string|max:255',
            'classification' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'branch' => 'nullable|string|max:255',
            'assigned_personnel' => 'nullable|string|max:255',
            'area' => 'nullable|string|max:255',
            'purchase_date' => 'nullable|date',
            'user_id' => 'nullable|exists:users,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'supplier_name' => 'nullable|string|max:255',
            'warranty_expiration' => 'nullable|date',
            'deviation' => 'nullable|string|max:255',
            'condition' => 'required|string|max:255',
            'unit_value' => 'nullable|numeric|min:0',
            'qty' => 'nullable|integer|min:1',
            'asset_status' => 'required|string|max:255',
            'model_no' => 'nullable|string|max:255',
            'serial_no' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:255',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $asset->fill($request->except('image'));

        // 泙 HANDLE IMAGE UPDATE
        if ($request->hasFile('image')) {
            if ($asset->image_path && Storage::disk('public')->exists($asset->image_path)) {
                Storage::disk('public')->delete($asset->image_path);
            }
            $path = $request->file('image')->store('assets/images', 'public');
            $asset->image_path = $path;
        }

        if (!empty($asset->purchase_date) && !empty($asset->warranty_expiration)) {
            $pDate = strtotime($asset->purchase_date);
            $wDate = strtotime($asset->warranty_expiration);
            $diff = round(($wDate - $pDate) / 86400);
            $asset->deviation = $diff . ' Days';
        }

        $asset->total_value = ($asset->unit_value * $asset->qty);
        $asset->save();

        // Keep the legacy single-assignee transfer form in sync with the
        // many-to-many accountability records. Shared assignments use the
        // dedicated accountability editor.
        if ($request->has('user_id')) {
            $assignedId = $request->input('user_id') ? (int) $request->input('user_id') : null;
            $asset->accountability_type = 'personal';
            $asset->user_id = $assignedId;
            $asset->assigned_personnel = $assignedId ? User::find($assignedId)?->name : null;
            $asset->asset_status = $assignedId ? 'Assigned' : 'In Storage';
            $asset->save();
            $asset->accountableUsers()->sync($assignedId ? [$assignedId => ['is_team_leader' => false, 'accountability_type' => 'personal']] : []);
        }

        return back()->with('success', 'Asset updated successfully.');
    }

    public function destroy(Asset $asset)
    {
        // 泙 PREVENT ORPHANED IMAGES
        if ($asset->image_path && Storage::disk('public')->exists($asset->image_path)) {
            Storage::disk('public')->delete($asset->image_path);
        }
        
        $assetTag = $asset->asset_tag; // Save tag for the log before object is deleted
        $asset->delete();

        return back()->with('success', 'Asset deleted successfully.');
    }

    public function bulkTransfer(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:assets,id',
            'user_id' => 'nullable|exists:users,id',
            'accountability_type' => 'nullable|in:personal,shared',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'integer|exists:users,id',
            'team_leader_id' => 'nullable|integer|exists:users,id',
            'branch' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
        ]);

        $ids = array_values(array_unique(array_map('intval', $data['user_ids'] ?? [])));
        if (!$ids && !empty($data['user_id'])) $ids = [(int) $data['user_id']];
        $type = $data['accountability_type'] ?? 'personal';
        if ($type === 'personal') $ids = array_slice($ids, 0, 1);
        $leader = !empty($data['team_leader_id']) ? (int) $data['team_leader_id'] : ($type === 'personal' ? ($ids[0] ?? null) : null);
        if ($type === 'shared' && (!$ids || !$leader)) {
            return back()->withErrors(['team_leader_id' => 'Select at least one employee and a team leader for shared accountability.']);
        }
        if ($leader && !in_array($leader, $ids, true)) $ids[] = $leader;

        foreach (Asset::whereIn('id', $data['ids'])->get() as $asset) {
            $asset->update([
                'user_id' => $leader,
                'assigned_personnel' => $leader ? User::find($leader)?->name : null,
                'branch' => $data['branch'] ?? null,
                'department' => $data['department'] ?? null,
                'accountability_type' => $type,
                'asset_status' => $ids ? 'Assigned' : 'In Storage',
            ]);
            $pivotData = array_fill_keys($ids, ['is_team_leader' => false, 'accountability_type' => $type]);
            $asset->accountableUsers()->sync($pivotData);
            if ($leader && in_array($leader, $ids, true)) {
                $asset->accountableUsers()->updateExistingPivot($leader, ['is_team_leader' => true, 'accountability_type' => $type]);
            }
        }

        // 🟢 RECORD ACTION TO SYSTEM LOGS
        try {
            $count = count($request->ids);
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Bulk Transfer',
                'module' => 'Accountability Management Module',
                'description' => "Bulk transferred {$count} assets.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {
            Log::info("Assets bulk transferred by User " . Auth::id() . " - Count: " . count($request->ids));
        }

        return back()->with('success', 'Selected assets transferred successfully.');
    }

    public function unassign(Request $request)
    {
        $data = $request->validate(['ids' => ['required', 'array', 'min:1'], 'ids.*' => ['integer', 'exists:assets,id']]);
        Asset::whereIn('id', $data['ids'])->update([
            'user_id' => null,
            'assigned_personnel' => null,
            'asset_status' => 'In Storage',
        ]);

        DB::table('asset_user')->whereIn('asset_id', $data['ids'])->delete();
        return back()->with('success', 'Selected assets were unassigned and moved to In Storage.');
    }

    public function syncAccountability(Request $request, Asset $asset)
    {
        $data = $request->validate([
            'type' => ['required', 'in:personal,shared'],
            'user_ids' => ['array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'team_leader_id' => ['nullable', 'integer', 'exists:users,id'],
            'branch' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:255'],
            'area' => ['nullable', 'string', 'max:255'],
        ]);

        $ids = array_values(array_unique(array_map('intval', $data['user_ids'] ?? [])));
        if ($data['type'] === 'personal') {
            $ids = array_slice($ids, 0, 1);
            $leader = $ids[0] ?? null;
        } else {
            if (count($ids) < 1) return back()->withErrors(['user_ids' => 'Select at least one employee for shared accountability.']);
            $leader = !empty($data['team_leader_id']) ? (int) $data['team_leader_id'] : null;
            if (!$leader) return back()->withErrors(['team_leader_id' => 'Select the team leader for shared accountability.']);
            if (!in_array($leader, $ids, true)) $ids[] = $leader;
        }
        $asset->update([
            'accountability_type' => $data['type'],
            'user_id' => $leader,
            'assigned_personnel' => $leader ? User::find($leader)?->name : null,
            'branch' => $data['branch'] ?? $asset->branch,
            'department' => $data['department'] ?? $asset->department,
            'area' => $data['area'] ?? $asset->area,
            'asset_status' => $ids ? 'Assigned' : 'In Storage',
        ]);
        // Sync pivot with accountability_type included
        $pivotData = array_fill_keys($ids, ['is_team_leader' => false, 'accountability_type' => $data['type']]);
        $asset->accountableUsers()->sync($pivotData);
        if ($leader && in_array($leader, $ids, true)) {
            $asset->accountableUsers()->updateExistingPivot($leader, ['is_team_leader' => true, 'accountability_type' => $data['type']]);
        }

        return back()->with('success', 'Asset accountability updated.');
    }

    public function importSpreadsheet(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx,xls', 'max:20480'],
            'fallback_branch' => ['nullable', 'string', 'max:255'],
        ]);
        $file = $request->file('file');
        $storedPath = $file->store('asset-imports');
        $batch = AssetImportBatch::create([
            'uploaded_by' => Auth::id(),
            'original_filename' => $file->getClientOriginalName(),
            'stored_path' => $storedPath,
            'file_hash' => hash_file('sha256', $file->getRealPath()),
            'status' => 'processing',
        ]);

        try {
            $sheets = Excel::toArray(null, $file);
            $rows = [];
            $headers = [];
            $headerRowIndex = null;
            $workbookBranch = null;

            // Some masterfiles have title, summary, and grouped-header rows before
            // the actual table. Find the sheet/row containing the asset columns.
            foreach ($sheets as $sheetRows) {
                foreach (array_slice($sheetRows, 0, 60, true) as $index => $candidate) {
                    $candidateHeaders = array_map([self::class, 'normalizeImportHeader'], $candidate);
                    $hasName = in_array('name', $candidateHeaders, true)
                        || in_array('asset name', $candidateHeaders, true);
                    $hasTag = in_array('tag', $candidateHeaders, true)
                        || in_array('asset tag', $candidateHeaders, true)
                        || in_array('asset_tag', $candidateHeaders, true);

                    if ($hasName && $hasTag) {
                        $rows = $sheetRows;
                        $headers = $candidateHeaders;
                        $headerRowIndex = $index;
                        break 2;
                    }
                }
            }

            if ($headerRowIndex === null) abort(422, 'The workbook must contain a masterlist header row with Name and Tag columns.');

            // Use the workbook-level branch as the fallback for rows that do not
            // carry their own branch value (e.g. the Project Brave masterfile).
            foreach (array_slice($rows, 0, $headerRowIndex) as $metadataRow) {
                foreach ($metadataRow as $column => $value) {
                    if (self::normalizeImportHeader($value) === 'branch') {
                        $workbookBranch = trim((string) ($metadataRow[$column + 1] ?? '')) ?: null;
                        break 2;
                    }
                }
            }

            $rows = array_slice($rows, $headerRowIndex + 1);
            $created = 0; $updated = 0;
            $branchCodes = ['gh' => 'Greenhills', 'mkt' => 'Makati', 'alb' => 'Alabang'];

            $fallbackBranch = trim((string) $request->input('fallback_branch')) ?: null;

            DB::transaction(function () use ($rows, $headers, $batch, $branchCodes, $workbookBranch, $fallbackBranch, &$created, &$updated) {
                foreach ($rows as $values) {
                    $row = array_combine($headers, array_pad(array_slice($values, 0, count($headers)), count($headers), null));
                    $tag = trim((string) ($row['tag'] ?? $row['asset tag'] ?? $row['assettag'] ?? $row['asset_tag'] ?? ''));
                    $name = trim((string) ($row['name'] ?? $row['asset name'] ?? $row['asst name'] ?? ''));
                    if ($tag === '' && $name === '') continue;
                    if ($tag === '') $tag = 'AST-' . strtoupper(substr(hash('sha256', $name . microtime(true)), 0, 8));

                    $prefix = strtolower((string) preg_replace('/-.*/', '', $tag));
                    $branch = self::branchFromAssetTag($tag, $branchCodes)
                        ?? trim((string) ($row['branch'] ?? ''))
                        ?: $workbookBranch
                        ?: $fallbackBranch;
                    $person = trim((string) ($row['assigned personnel'] ?? $row['assigned_personnel'] ?? $row['personnel'] ?? ''));
                    $user = $person ? User::whereRaw('LOWER(name) = ?', [strtolower($person)])->first() : null;
                    $asset = Asset::whereRaw('LOWER(asset_tag) = ?', [strtolower($tag)])->first();
                    $isNew = !$asset;
                    $before = $asset?->getAttributes();
                    $asset ??= new Asset();
                    $asset->fill([
                        'name' => $name ?: 'Unnamed Asset', 'asset_tag' => $tag,
                        'serial_no' => $row['serial no.'] ?? $row['serial no'] ?? null,
                        'model_no' => $row['model no.'] ?? $row['model no'] ?? null,
                        'color' => $row['color'] ?? null, 'category' => $row['category'] ?? null,
                        'classification' => $row['asset classification'] ?? $row['classification'] ?? $row['noncurrent/supplies'] ?? null, 'department' => $row['department'] ?? null,
                        'branch' => $branch, 'area' => $row['area'] ?? null, 'supplier_name' => $row['supplier'] ?? null,
                        'assigned_personnel' => $person ?: null, 'user_id' => $user?->id,
                        'purchase_date' => self::parseImportDate($row['date'] ?? $row['purchased date'] ?? $row['purchase date'] ?? $row['purchase_date'] ?? null),
                        'warranty_expiration' => self::parseImportDate($row['warranty expiration'] ?? $row['warranty exp.'] ?? $row['warranty exp'] ?? $row['warranty date'] ?? null),
                        'condition' => $row['condition'] ?? 'Good', 'asset_status' => $person ? 'Assigned' : ($row['status'] ?? 'New'),
                        'qty' => max(1, (int) ($row['qty'] ?? $row['quantity'] ?? 1)),
                        'unit_value' => (float) preg_replace('/[^0-9.\-]/', '', (string) ($row['unit value'] ?? $row['value'] ?? 0)),
                    ]);
                    $asset->total_value = $asset->qty * $asset->unit_value;
                    $asset->save();
                    $afterHash = hash('sha256', json_encode($asset->getAttributes(), JSON_UNESCAPED_UNICODE));
                    $batch->items()->create(['asset_id' => $asset->id, 'created_by_batch' => $isNew, 'before_values' => $before, 'after_hash' => $afterHash]);
                    $isNew ? $created++ : $updated++;
                }
            });
            $batch->update(['created_count' => $created, 'updated_count' => $updated, 'status' => 'completed']);
            return back()->with('success', "Import complete: {$created} created, {$updated} updated.");
        } catch (\Throwable $e) {
            $batch->update(['status' => 'failed']);
            Log::error('Asset workbook import failed', ['exception' => $e]);
            return back()->withErrors(['file' => 'Import failed: ' . $e->getMessage()]);
        }
    }

    private static function normalizeImportHeader($header): string
    {
        $header = strtolower(trim((string) $header));
        $header = preg_replace('/[\r\n]+/', ' ', $header);
        $header = preg_replace('/\s+/', ' ', $header);
        return trim($header);
    }

    private static function branchFromAssetTag(string $tag, array $branchCodes): ?string
    {
        if (preg_match('/^(GH|MKT|ALB)(?:[-_\s]|\d|$)/i', trim($tag), $match)) {
            return $branchCodes[strtolower($match[1])] ?? null;
        }

        return null;
    }

    private static function parseImportDate($value): ?string
    {
        if (!$value) return null;
        if (is_numeric($value)) return date('Y-m-d', (int) (($value - 25569) * 86400));
        return strtotime((string) $value) ? date('Y-m-d', strtotime((string) $value)) : null;
    }

    public function bulkDelete(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:assets,id',
        ]);

        // Clean up images for all deleted assets
        $assets = Asset::whereIn('id', $request->ids)->get();
        foreach ($assets as $asset) {
            if ($asset->image_path && Storage::disk('public')->exists($asset->image_path)) {
                Storage::disk('public')->delete($asset->image_path);
            }
        }

        Asset::whereIn('id', $request->ids)->delete();

        // 🟢 RECORD ACTION TO SYSTEM LOGS
        try {
            $count = count($request->ids);
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Bulk Delete',
                'module' => 'Accountability Management Module',
                'description' => "Bulk deleted {$count} assets.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {
            Log::info("Assets bulk deleted by User " . Auth::id() . " - Count: " . count($request->ids));
        }

        return back()->with('success', 'Selected assets deleted successfully.');
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file',
        ]);

        try {
            $file = $request->file('file');
            $extension = strtolower($file->getClientOriginalExtension());

            if (!in_array($extension, ['csv', 'txt'])) {
                return back()->withErrors(['file' => 'ERROR: You must open your Excel file and click "Save As -> CSV (Comma delimited)" before uploading.']);
            }

            $csvData = file_get_contents($file->getRealPath());
            $csvData = preg_replace('/\r\n|\r/', "\n", $csvData);
            $csvData = preg_replace('/^\xEF\xBB\xBF/', '', $csvData);
            
            $lines = explode("\n", $csvData);

            if (count($lines) < 2) {
                return back()->withErrors(['file' => 'The file is empty or only contains headers.']);
            }

            $headers = str_getcsv(array_shift($lines));
            $headers = array_map(function($col) {
                $col = preg_replace('/[^\x20-\x7E]/', '', $col);
                return trim(strtolower($col));
            }, $headers);

            $importedCount = 0;

            foreach ($lines as $line) {
                if (empty(trim($line))) continue;

                $data = str_getcsv($line);
                
                if (count($headers) > count($data)) {
                    $data = array_pad($data, count($headers), '');
                } elseif (count($data) > count($headers)) {
                    $data = array_slice($data, 0, count($headers));
                }

                $row = array_combine($headers, $data);

                $assetName = trim($row['asset name'] ?? $row['asst name'] ?? '');
                $assetTag = trim($row['asset tag'] ?? $row['assettag'] ?? $row['asset_tag'] ?? '');

                if (empty($assetTag) && empty($assetName)) continue;

                if (empty($assetTag)) {
                    $assetTag = 'AST-' . strtoupper(substr(md5(uniqid()), 0, 6));
                }
                if (empty($assetName)) {
                    $assetName = 'Unnamed Asset';
                }

                $qtyStr = $row['qty'] ?? $row['quantity'] ?? '1';
                $qty = (int) preg_replace('/[^0-9]/', '', $qtyStr);
                if ($qty <= 0) $qty = 1;

                $unitValueStr = $row['unit value'] ?? $row['unit_value'] ?? $row['value'] ?? '0';
                $unitValue = (float) preg_replace('/[^0-9.]/', '', $unitValueStr);

                $personnelName = trim($row['assigned personnel'] ?? $row['assigned_personnel'] ?? $row['personnel'] ?? '');
                $user = !empty($personnelName) ? User::where('name', $personnelName)->first() : null;

                $purchasedDateRaw = trim($row['purchased date'] ?? $row['purchase date'] ?? $row['purchase_date'] ?? '');
                $purchasedDate = (!empty($purchasedDateRaw) && strtotime($purchasedDateRaw)) ? date('Y-m-d', strtotime($purchasedDateRaw)) : null;

                $warrantyDateRaw = trim($row['warranty exp.'] ?? $row['warranty date'] ?? $row['warranty exp'] ?? '');
                $warrantyDate = (!empty($warrantyDateRaw) && strtotime($warrantyDateRaw)) ? date('Y-m-d', strtotime($warrantyDateRaw)) : null;

                $deviation = trim($row['deviation'] ?? '');
                if (empty($deviation) && $purchasedDate && $warrantyDate) {
                    $pDate = strtotime($purchasedDate);
                    $wDate = strtotime($warrantyDate);
                    $diff = round(($wDate - $pDate) / 86400);
                    $deviation = $diff . ' Days';
                }

                $asset = Asset::firstOrNew(['asset_tag' => $assetTag]);
                $asset->name = $assetName;
                $asset->serial_no = trim($row['serial no.'] ?? $row['serial no'] ?? '') ?: null;
                $asset->model_no = trim($row['model no.'] ?? $row['model no'] ?? '') ?: null;
                $asset->color = trim($row['color'] ?? '') ?: null;
                $asset->category = trim($row['category'] ?? '') ?: null;
                $asset->assigned_personnel = $personnelName ?: null;
                $asset->user_id = $user ? $user->id : null;
                $asset->department = trim($row['department'] ?? '') ?: null;
                $asset->branch = trim($row['branch'] ?? '') ?: null;
                $asset->area = trim($row['area'] ?? '') ?: null;
                $asset->supplier_name = trim($row['supplier'] ?? '') ?: null;
                $asset->purchase_date = $purchasedDate;
                $asset->warranty_expiration = $warrantyDate;
                $asset->deviation = $deviation ?: null;
                $asset->qty = $qty;
                $asset->unit_value = $unitValue;
                $asset->total_value = ($qty * $unitValue);
                $asset->condition = trim($row['condition'] ?? 'Good');
                $asset->asset_status = !empty($personnelName) ? 'Assigned' : (trim($row['status'] ?? '') ?: 'New');
                
                $asset->save();
                
                $importedCount++;
            }

            if ($importedCount === 0) {
                return back()->withErrors(['file' => 'We opened the file, but no readable data was found. Ensure your columns match the template.']);
            }

            // 🟢 RECORD ACTION TO SYSTEM LOGS
            try {
                SystemLog::create([
                    'user_id' => Auth::id(),
                    'action' => 'Import',
                    'module' => 'Asset Management Module',
                    'description' => "Imported {$importedCount} assets via CSV.",
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent()
                ]);
            } catch (\Exception $e) {
                Log::info("Assets imported by User " . Auth::id() . " - Count: {$importedCount}");
            }

            return back()->with('success', "Success! Imported {$importedCount} assets.");
        } catch (\Throwable $e) {
            Log::error("CSV Import Error: " . $e->getMessage());
            return back()->withErrors(['file' => 'Import Error: ' . $e->getMessage()]);
        }
    }

    // 🟢 FIXED: Export function rewritten to avoid closure scope issues, match React headers, and fix Excel '#' dates
    public function export(Request $request) 
    {
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Export',
                'module' => 'Asset Management Module',
                'description' => "Exported Asset records to CSV.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {
            Log::info("Asset records exported by User " . Auth::id());
        }

        $assets = Asset::with(['user', 'supplier'])->latest()->get();
        $fileName = "assets_records_export_" . date('Y-m-d') . ".csv";

        $headers = [
            "Content-type"        => "text/csv",
            "Content-Disposition" => "attachment; filename=$fileName",
            "Pragma"              => "no-cache",
            "Cache-Control"       => "must-revalidate, post-check=0, pre-check=0",
            "Expires"             => "0"
        ];

        return response()->streamDownload(function() use ($assets) {
            $file = fopen('php://output', 'w');
            // Write UTF-8 BOM so Excel opens it properly
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

            // Headers exactly matching Assets.jsx
            fputcsv($file, [
                'Asset Name', 'Asset Tag', 'Serial No.', 'Model No.', 'Color', 
                'Category', 'Status', 'Condition', 'Assigned Personnel', 
                'Department', 'Branch', 'Area', 'Supplier', 'Purchased Date', 
                'Warranty Exp.', 'Depreciation (Months)', 'Qty', 'Unit Value', 'Total Value',
                'Acc. Depreciation', 'Current Book Value'
            ]);

            foreach ($assets as $asset) {
                $personnelName = $asset->user ? $asset->user->name : ($asset->assigned_personnel ?: '-');
                
                $branchName = '-';
                if ($asset->branch) {
                    if (is_string($asset->branch) && str_starts_with($asset->branch, '{')) {
                        $decoded = json_decode($asset->branch);
                        $branchName = $decoded->name ?? $asset->branch;
                    } else {
                        $branchName = is_object($asset->branch) ? ($asset->branch->name ?? '') : $asset->branch;
                    }
                }

                // Format Dates (fixes Excel '#')
                $pDateStr = $asset->purchase_date ? date('M d, Y', strtotime($asset->purchase_date)) : '-';
                $wDateStr = $asset->warranty_expiration ? date('M d, Y', strtotime($asset->warranty_expiration)) : '-';

                // Calculate Depreciation Months
                $monthsStr = '-';
                if ($asset->purchase_date) {
                    $pTime = strtotime($asset->purchase_date);
                    if ($pTime) {
                        $diffDays = floor((time() - $pTime) / 86400);
                        $months = round($diffDays / 30.44);
                        $monthsStr = max(0, $months) . ' Months';
                    }
                }

                // Calculate Financials
                $qty = $asset->qty ?? 1;
                $unitValue = $asset->unit_value ?? 0;
                $originalValue = $asset->total_value ?? ($unitValue * $qty);
                $accumulated = 0;
                $current = $originalValue;

                if ($asset->purchase_date && $originalValue > 0) {
                    $pTime = strtotime($asset->purchase_date);
                    if ($pTime) {
                        $pYear = (int)date('Y', $pTime);
                        $pMonth = (int)date('n', $pTime);
                        $pDay = (int)date('j', $pTime);
                        
                        $tYear = (int)date('Y');
                        $tMonth = (int)date('n');
                        $tDay = (int)date('j');

                        $monthsAlive = (($tYear - $pYear) * 12) + ($tMonth - $pMonth);
                        if ($tDay < $pDay) {
                            $monthsAlive--;
                        }
                        $monthsAlive = max(0, $monthsAlive);

                        $depreciationRatio = min($monthsAlive / 60, 1); // 60 months (5 years)
                        $accumulated = $originalValue * $depreciationRatio;
                        $current = $originalValue - $accumulated;
                    }
                }

                fputcsv($file, [
                    $asset->name ?? '-',
                    $asset->asset_tag ?? '-',
                    $asset->serial_no ?: '-',
                    $asset->model_no ?: '-',
                    $asset->color ?: '-',
                    $asset->category ?: '-',
                    $asset->asset_status ?: 'New',
                    $asset->condition ?: 'Good',
                    $personnelName,
                    $asset->department ?: '-',
                    $branchName,
                    $asset->area ?: '-',
                    $asset->supplier_name ?: '-',
                    $pDateStr,
                    $wDateStr,
                    $monthsStr, 
                    $qty,
                    $unitValue,
                    $originalValue,
                    number_format($accumulated, 2, '.', ''),
                    number_format($current, 2, '.', '')
                ]);
            }
            fclose($file);
        }, $fileName, $headers);
    }

    public function pdf(Request $request)
    {
        $ids = collect($request->input('ids', []))->map(fn ($id) => (int) $id)->filter()->unique()->values();
        abort_if($ids->isEmpty(), 422, 'No assets were selected for the PDF.');

        $assets = Asset::with(['user', 'supplier', 'accountableUsers'])->whereIn('id', $ids)->orderBy('asset_tag')->get();

        return response()->view('exports.asset-masterlist-pdf', [
            'assets' => $assets,
            'generatedAt' => now(),
        ]);
    }

    // 🟢 FIXED: Required functions to catch the 500 error from the React interface background logs
    public function logExport(Request $request)
    {
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Export',
                'module' => 'Asset Management Module',
                'description' => "Exported Asset records to CSV (Frontend Trigger).",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
            return back();
        } catch (\Exception $e) {
            Log::error("Failed to log asset export: " . $e->getMessage());
            return back();
        }
    }

    public function logTemplateDownload(Request $request)
    {
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Download',
                'module' => 'Asset Management Module',
                'description' => "Downloaded the Asset Import CSV Template.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
            return back();
        } catch (\Exception $e) {
            Log::error("Failed to log template download: " . $e->getMessage());
            return back();
        }
    }

    public function downloadTemplate(Request $request)
    {
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Download',
                'module' => 'Asset Management Module',
                'description' => "Downloaded the Asset Import Template.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {
            Log::info("Template downloaded by User " . Auth::id());
        }

        return Excel::download(new AssetTemplateExport, 'asset_import_template.xlsx');
    }
}
