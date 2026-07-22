<?php
// Controller: products endpoints and import/export

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Imports\ProductsImport;
use App\Exports\ProductsExport;
use Maatwebsite\Excel\Facades\Excel;

// Product controller: product CRUD, import/export, status toggling
class ProductController extends Controller
{

    public function index()
    {
        // List products and suppliers for the frontend ProductsIndex view
        $user = auth()->user();
        if (!$user || !$user->canViewModule('products')) {
            abort(403, 'You do not have permission to view the Products Masterlist.');
        }

        // 1. Fetch products with their linked suppliers
        $products = Product::with('supplier')->latest()->get();
        
        // 2. Fetch all suppliers for the filter dropdown and manage modal
        $suppliers = Supplier::orderBy('name')->get();

        // 3. Render the React component and pass the data as props
        // Note: Make sure the path matches where you saved ProductsIndex.jsx 
        // (e.g., 'PRPO/ProductsIndex')
        return Inertia::render('PRPO/ProductsIndex', [
            'products' => $products,
            'suppliers' => $suppliers,
        ]);
    }


    public function store(Request $request)
    {
        // Create product: validate input and enforce create permission
        // 🔐 ACL CHECK: Verify user can CREATE products
        // Permission Hierarchy: Full + Edit can create
        $user = auth()->user();
        if (!$user->canCreateModule('products')) {
            abort(403, 'You do not have permission to add products.');
        }

        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'name' => 'required|string|max:255',
            'details' => 'nullable|string',
            'unit' => 'nullable|string|max:50',
            'price' => 'required|numeric|min:0',
        ]);

        Product::create($validated);

        return back()->with('success', 'Product added successfully.');
    }

public function update(Request $request, Product $product)
    {
        // Update product: validate input and enforce edit permission
        // 🔐 ACL CHECK: Verify user can EDIT products
        // Permission Hierarchy: Full only can edit
        $user = auth()->user();
        if (!$user->canEditModule('products')) {
            abort(403, 'You do not have permission to update products.');
        }

        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'name' => 'required|string|max:255',
            'unit' => 'nullable|string|max:50', // 🟢 NEW: Added unit validation
            'details' => 'nullable|string',
            'price' => 'required|numeric|min:0',
        ]);

        $product->update($validated);

        return back()->with('success', 'Product updated successfully.');
    }

    public function destroy(Product $product)
    {
        // Delete single product: permission-guarded removal
        // 🔐 ACL CHECK: Verify user can DELETE products
        // Permission Hierarchy: Full only can delete
        $user = auth()->user();
        if (!$user->canDeleteModule('products')) {
            abort(403, 'You do not have permission to delete products.');
        }

        $product->delete();

        return back()->with('success', 'Product deleted successfully.');
    }

    public function batchDestroy(Request $request)
    {
        // Batch delete: remove multiple products by IDs
        // 🔐 ACL CHECK: Verify user can DELETE products
        // Permission Hierarchy: Full only can delete
        $user = auth()->user();
        if (!$user->canDeleteModule('products')) {
            abort(403, 'You do not have permission to delete products.');
        }

        $request->validate([
            'ids'   => 'required|array',
            'ids.*' => 'exists:products,id',
        ]);

        Product::whereIn('id', $request->ids)->delete();

        return back()->with('success', count($request->ids) . ' products deleted successfully.');
    }

    public function import(Request $request)
    {
        // Import products from uploaded spreadsheet (XLSX/CSV)
        $request->validate([
            'import_file' => 'required|mimes:xlsx,csv,xls|max:10240', // Max 10MB
        ]);

        try {
            Excel::import(new ProductsImport, $request->file('import_file'));
            return back()->with('success', 'Products imported successfully!');
        } catch (\Exception $e) {
            // 🟢 FIXED: Changed to with('error', ...) to trigger your custom red toast
            return back()->with('error', 'Error importing file. Please check your template format.');
        }
    }

    public function downloadTemplate()
    {
        // Provide a downloadable CSV template for product imports
        return response()->streamDownload(function () {
            $file = fopen('php://output', 'w');
            
            // Template headers and example row
            fputcsv($file, ['supplier_name', 'product_name', 'unit', 'details', 'price']);
            fputcsv($file, ['Example Supplier Inc.', 'Paracetamol 500mg', 'BOX', 'Box of 100 tablets', '150.50']);
            
            fclose($file);
        }, 'product_import_template.csv');
    }

    public function export(Request $request)
    {
        // Export products to an Excel file, optionally filtered by supplier/search
        $supplierId = $request->input('supplier_id');
        $search = $request->input('search');
        
        $fileName = 'products_export_' . date('Y-m-d_H-i-s') . '.xlsx';

        return Excel::download(new ProductsExport($supplierId, $search), $fileName);
    }

    public function toggleStatus(Product $product)
    {
        // Toggle product status between active and Disabled (permission-guarded)
        // 🔐 ACL CHECK: Verify user can edit products module
        $user = auth()->user();
        if (!$user->canEditModule('products')) {
            abort(403, 'You do not have permission to modify product status.');
        }

        try {
            if ($product->status === 'Disabled') {
                $product->update(['status' => null]);
                $message = "Product '{$product->name}' has been re-enabled.";
            } else {
                $product->update(['status' => 'Disabled']);
                $message = "Product '{$product->name}' has been disabled.";
            }

            return back()->with('success', $message);
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to update product status: ' . $e->getMessage());
        }
    }
}