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
        // 🟢 SAFETY NET: Skip completely blank Excel rows to prevent crashes
        if (empty($row['supplier_name']) || empty($row['product_name'])) {
            return null;
        }

        // 1. Find the supplier by name
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
                // 🟢 NEW: Capture the Smallest Unit from the Excel upload
                'smallest_unit' => isset($row['smallest_unit']) ? trim($row['smallest_unit']) : null,

                // 🟢 Reads the unit column, trims spaces, and forces UPPERCASE
                'unit' => isset($row['unit']) ? strtoupper(trim($row['unit'])) : null,

                'details' => isset($row['details']) ? trim($row['details']) : null,
                'price' => isset($row['price']) ? (float) $row['price'] : 0,
            ]
        );
    }
}
