<?php

namespace App\Exports;

use App\Models\Asset;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class AssetsExport implements FromCollection, WithHeadings, WithMapping
{
    public function collection()
    {
        return Asset::with('user')->latest()->get();
    }

    public function headings(): array
    {
        return [
            'Asst Name', 'Asset Tag', 'Serial No.', 'Model No.', 'Color', 
            'Category', 'Status', 'Condition', 'Assigned Personnel', 
            'Department', 'Branch', 'Area', 'Supplier', 'Purchased Date', 
            'Warranty Exp.', 'Quantity', 'Unit Value', 'Total Value'
        ];
    }

    public function map($asset): array
    {
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

        return [
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
            $asset->purchase_date ?: '-',
            $asset->warranty_expiration ?: '-',
            $asset->qty ?? 1,
            $asset->unit_value ?? 0,
            $asset->total_value ?? 0
        ];
    }
}