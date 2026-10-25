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

class AssetController extends Controller
{
    public function index()
    {
        // Security Bouncer for Audit
        $userRole = strtolower(trim(Auth::user()?->role?->name ?? ''));
        if (str_contains($userRole, 'audit') || str_contains($userRole, 'view only') || str_contains($userRole, 'accountability')) {
            return redirect()->route('admin.asset-masterlist');
        }

        return Inertia::render('Admin/Assets', [
            // 🟢 FIXED: Changed paginate(10) to get() so React receives all 100+ items
            'assets' => Asset::with(['user', 'supplier'])->latest()->get(),
            
            // 🟢 CLEANED: Combined the unused variables you had earlier into the render array
            'suppliers' => Supplier::where('status', 'Active')->orderBy('name')->get(['id', 'name']),
            'users' => User::with('department')->orderBy('name')->get(),
            'branches' => Branch::all(),
            'departments' => Department::all(), 
        ]);
    }

    public function masterlist()
    {
        // Security Bouncer for Admins
        $userRole = strtolower(trim(Auth::user()?->role?->name ?? ''));
        $isAdmin = in_array($userRole, ['admin', 'super admin', 'director of corporate services and operations']);
        
        if ($isAdmin) {
            return redirect()->route('admin.assets.index');
        }

        $assets = Asset::with(['supplier', 'user'])->latest()->get();
        
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

        // 🟢 RECORD ACTION TO SYSTEM LOGS
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Create',
                'module' => 'Accountability Management Module',
                'description' => "Created new asset: {$asset->asset_tag} ({$asset->name}).",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {
            Log::info("Asset created by User " . Auth::id() . " - Tag: {$asset->asset_tag}");
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

        // 🟢 RECORD ACTION TO SYSTEM LOGS
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Update',
                'module' => 'Accountability Management Module',
                'description' => "Updated asset: {$asset->asset_tag}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {
            Log::info("Asset updated by User " . Auth::id() . " - Tag: {$asset->asset_tag}");
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

        // 🟢 RECORD ACTION TO SYSTEM LOGS (Using request helper)
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Delete',
                'module' => 'Accountability Management Module',
                'description' => "Deleted asset: {$assetTag}.",
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent()
            ]);
        } catch (\Exception $e) {
            Log::info("Asset deleted by User " . Auth::id() . " - Tag: {$assetTag}");
        }

        return back()->with('success', 'Asset deleted successfully.');
    }

    public function bulkTransfer(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:assets,id',
            'user_id' => 'nullable|exists:users,id',
            'branch' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
        ]);

        Asset::whereIn('id', $request->ids)->update([
            'user_id' => $request->user_id ?: null,
            'branch' => $request->branch ?: null,
            'department' => $request->department ?: null,
            'asset_status' => 'Assigned',
        ]);

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
}