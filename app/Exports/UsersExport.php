<?php

namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;

class UsersExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize
{
    use Exportable;

    protected $filters;

    // Receive the array of filters from the Controller
    public function __construct($filters = [])
    {
        $this->filters = $filters;
    }

    public function query()
    {
        // Start the query and eager load relationships
        $query = User::with(['department', 'position', 'branches'])->latest();

        // 1. Filter by Search Query (Name or Email)
        if (!empty($this->filters['search'])) {
            $query->where(function ($q) {
                $q->where('name', 'LIKE', '%' . $this->filters['search'] . '%')
                  ->orWhere('email', 'LIKE', '%' . $this->filters['search'] . '%');
            });
        }

        // 2. Filter by Department
        if (!empty($this->filters['department'])) {
            $query->whereHas('department', function ($q) {
                $q->where('name', $this->filters['department']);
            });
        }

        // 3. Filter by Position (Added)
        if (!empty($this->filters['position'])) {
            $query->whereHas('position', function ($q) {
                $q->where('name', $this->filters['position']);
            });
        }

        // 4. Filter by Branch
        if (!empty($this->filters['branch'])) {
            $query->whereHas('branches', function ($q) {
                $q->where('name', $this->filters['branch']);
            });
        }

        // 5. Filter by Status (Added - e.g., "Pending Setup")
        if (!empty($this->filters['status'])) {
            $query->where('status', $this->filters['status']);
        }

        return $query;
    }

    public function headings(): array
    {
        return ['Name', 'Email', 'Department', 'Position', 'Branches', 'Status'];
    }

    public function map($user): array
    {
        $branchNames = $user->branches->pluck('name')->implode(', ');

        return [
            $user->name,
            $user->email,
            $user->department->name ?? 'Unassigned',
            $user->position->name ?? 'Unassigned',
            $branchNames ?: 'N/A',
            ucfirst($user->status),
        ];
    }
}