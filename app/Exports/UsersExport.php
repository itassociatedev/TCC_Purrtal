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

    protected $search, $department, $branch;

    public function __construct($search = null, $department = null, $branch = null)
    {
        $this->search = $search;
        $this->department = $department;
        $this->branch = $branch;
    }

    public function query()
    {
        $query = User::with(['department', 'position', 'branches'])->latest();

        if ($this->search) {
            $query->where(function ($q) {
                $q->where('name', 'LIKE', '%' . $this->search . '%')
                  ->orWhere('email', 'LIKE', '%' . $this->search . '%');
            });
        }
        if ($this->department) {
            $query->whereHas('department', function ($q) {
                $q->where('name', $this->department);
            });
        }
        if ($this->branch) {
            $query->whereHas('branches', function ($q) {
                $q->where('name', $this->branch);
            });
        }

        return $query;
    }

    public function headings(): array
    {
        // Changed 'Is Rotating' to 'Status' here
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
            ucfirst($user->status), // Changed from $user->is_rotating ? 'Yes' : 'No'
        ];
    }
}