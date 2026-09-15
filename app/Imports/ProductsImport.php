<?php

namespace App\Imports;

use App\Models\Product;
use App\Models\Supplier;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class ProductsImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        // 1. Find the supplier by name (assuming your current logic looks like this)
        $supplier = Supplier::where('name', trim($row['supplier_name']))->first();

        // Skip rows where the supplier doesn't exist in the database
        if (!$supplier) {
            return null;
        }

        // 2. Create or Update the product
        return Product::updateOrCreate(
            [
                'name' => ucwords(strtolower(trim($row['product_name'] ?? $row['name']))),
                'supplier_id' => $supplier->id,
            ],
            [
                // 🟢 ADD THIS LINE: Reads the unit column, trims spaces, and forces UPPERCASE
                'unit' => isset($row['unit']) ? strtoupper(trim($row['unit'])) : null,

                'details' => isset($row['details']) ? trim($row['details']) : null,
                'price' => isset($row['price']) ? (float) $row['price'] : 0,
            ]
        );
    }
}
