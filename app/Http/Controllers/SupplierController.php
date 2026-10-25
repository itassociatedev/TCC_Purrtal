<?php
// Supplier controller: supplier CRUD and lookup endpoints

namespace App\Http\Controllers;
//
use App\Models\Supplier;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Exports\SuppliersExport; // Added for Export
use Maatwebsite\Excel\Facades\Excel; // Added for Excel

class SupplierController extends Controller
{
    /**
     * Display suppliers list.
     */
    public function index()
    {
        $suppliers = Supplier::orderBy('name')->get();

        return Inertia::render('PRPO/SuppliersIndex', [
            'suppliers' => $suppliers,
        ]);
    }

    /**
     * Export the suppliers list to Excel.
     */
    public function export()
    {
        return Excel::download(new SuppliersExport, 'suppliers_list.xlsx');
    }

    public function store(Request $request)
    {
        // 🔐 ACL CHECK: Verify user can CREATE suppliers
        // Permission Hierarchy: Full + Edit can create
        $user = auth()->user();
        if (!$user->canCreateModule('suppliers')) {
            abort(403, 'You do not have permission to add suppliers.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:suppliers,name',
            'contact_person' => 'nullable|string|max:255', 
            'contact_number' => 'nullable|string|max:255', 
            'address' => 'nullable|string|max:255',
            'tin' => 'nullable|string|max:255',
        ]);

        Supplier::create($validated);

        return back()->with('success', 'Supplier added successfully.');
    }

    public function update(Request $request, Supplier $supplier)
    {
        // 🔐 ACL CHECK: Verify user can EDIT suppliers
        // Permission Hierarchy: Full only can edit
        $user = auth()->user();
        if (!$user->canEditModule('suppliers')) {
            abort(403, 'You do not have permission to update suppliers.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:suppliers,name,' . $supplier->id,
            'contact_person' => 'nullable|string|max:255', 
            'contact_number' => 'nullable|string|max:255', 
            'address' => 'nullable|string|max:255',
            'tin' => 'nullable|string|max:255',
        ]);

        $supplier->update($validated);

        return back()->with('success', 'Supplier updated successfully.');
    }

    public function destroy(Supplier $supplier)
    {
        // 🔐 ACL CHECK: Verify user can DELETE suppliers
        // Permission Hierarchy: Full only can delete
        $user = auth()->user();
        if (!$user->canDeleteModule('suppliers')) {
            abort(403, 'You do not have permission to delete suppliers.');
        }

        try {
            $supplier->delete();
            return back()->with('success', 'Supplier deleted successfully.');
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() == 23000) {
                return back()->withErrors(['error' => 'Cannot delete supplier. There are still products assigned to it.']);
            }
            return back()->withErrors(['error' => 'An error occurred while deleting the supplier.']);
        }
    }

    public function batchDestroy(Request $request)
    {
        // 🔐 ACL CHECK: Verify user can DELETE suppliers
        // Permission Hierarchy: Full only can delete
        $user = auth()->user();
        if (!$user->canDeleteModule('suppliers')) {
            abort(403, 'You do not have permission to delete suppliers.');
        }

        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:suppliers,id',
        ]);

        $deletedCount = 0;
        $failedCount = 0;

        foreach ($request->ids as $id) {
            try {
                $supplier = Supplier::find($id);
                if ($supplier) {
                    $supplier->delete();
                    $deletedCount++;
                }
            } catch (\Illuminate\Database\QueryException $e) {
                // Code 23000 means there's a foreign key constraint (products are tied to it)
                if ($e->getCode() == '23000') {
                    $failedCount++;
                }
            }
        }

        if ($failedCount > 0) {
            return back()->with('error', "Deleted {$deletedCount} suppliers, but {$failedCount} could not be deleted because they have products assigned to them.");
        }

        return back()->with('success', "Successfully deleted {$deletedCount} suppliers.");
    }
    public function toggleStatus(Supplier $supplier)
    {
        // 🔐 ACL CHECK: Verify user can EDIT suppliers
        // Permission Hierarchy: Full only can edit/modify
        $user = auth()->user();
        if (!$user->canEditModule('suppliers')) {
            abort(403, 'You do not have permission to modify supplier status.');
        }

        try {
            if ($supplier->status === 'Disabled') {
                $supplier->update(['status' => null]);
                $supplier->products()->update(['status' => null]);
                $message = "Supplier '{$supplier->name}' and all their products have been re-enabled.";
            } else {
                $supplier->update(['status' => 'Disabled']);
                $supplier->products()->update(['status' => 'Disabled']);
                $message = "Supplier '{$supplier->name}' and all their products have been disabled.";
            }

            return back()->with('success', $message);
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to update supplier status: ' . $e->getMessage());
        }
    }

    public function downloadTemplate()
    {
        $headers = [
            "Content-type"        => "text/csv",
            "Content-Disposition" => "attachment; filename=suppliers_template.csv",
            "Pragma"              => "no-cache",
            "Cache-Control"       => "must-revalidate, post-check=0, pre-check=0",
            "Expires"             => "0"
        ];

        $columns = ['name', 'contact_person', 'contact_number', 'address', 'tin'];

        $callback = function() use($columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:2048',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getPathname(), "r");
        $header = fgetcsv($handle); 

        $importedCount = 0;
        $skippedCount = 0;

        while (($row = fgetcsv($handle)) !== false) {
            if (empty(trim($row[0]))) {
                $skippedCount++;
                continue;
            }

            $exists = Supplier::where('name', trim($row[0]))->exists();
            if ($exists) {
                $skippedCount++;
                continue;
            }

            Supplier::create([
                'name' => trim($row[0]),
                'contact_person' => trim($row[1] ?? ''),
                'contact_number' => trim($row[2] ?? ''),
                'address' => trim($row[3] ?? ''),
                'tin' => trim($row[4] ?? ''),
            ]);
            $importedCount++;
        }
        
        fclose($handle);

        return back()->with('success', "Import complete: $importedCount added, $skippedCount skipped (duplicates or missing names).");
    }
}