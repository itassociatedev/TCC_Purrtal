<?php

namespace App\Exports;

use App\Models\Product;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;

class ProductsExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize
{
    use Exportable;

    protected $supplierId;
    protected $search;

    // Receive the filter parameter from the controller
    public function __construct($supplierId = null, $search = null)
    {
        $this->supplierId = $supplierId;
        $this->search = $search;
    }

    // Build the query (Laravel Excel handles chunking automatically for performance)
    public function query()
    {
        $query = Product::with('supplier')->latest();

        // 1. Filter by Supplier dropdown (if selected)
        if ($this->supplierId) {
            $query->where('supplier_id', $this->supplierId);
        }

        // 2. Filter by typed text search (if typing)
        if ($this->search) {
            $query->where('name', 'LIKE', '%' . $this->search . '%');
        }

        return $query;
    }

    // Define the exact column headers for the Excel file
    public function headings(): array
    {
        return [
            'Supplier Name',
            'Product Name',
            'Details',
            'Unit',
            'Price',
            'Date Added'
        ];
    }

    // Map each database row to the Excel columns
    public function map($product): array
    {
        return [
            $product->supplier->name ?? 'Unknown',
            $product->name,
            $product->details,
            $product->unit,
            $product->price,
            $product->created_at->format('Y-m-d H:i:s'),
        ];
    }
}