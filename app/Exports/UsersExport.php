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

    /**
     * The filters to apply to the export query.
     * * FIXED: Added explicit 'array' type to resolve Intelephense P1132.
     */
    protected array $filters;

    /**
     * Receive the array of filters from the Controller.
     *
     * @param array $filters
     */
    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    /**
     * Build the query for the export.
     *
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function query()
    {
        // Start the query and eager load relationships to avoid N+1 issues
        $query = User::with(['department', 'position', 'branches'])->latest();

        // 1. Filter by Search Query (Name or Email)
        if (!empty($this->filters['search'])) {
            $searchTerm = $this->filters['search'];
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'LIKE', '%' . $searchTerm . '%')
                  ->orWhere('email', 'LIKE', '%' . $searchTerm . '%');
            });
        }

        // 2. Filter by Department
        if (!empty($this->filters['department'])) {
            $query->whereHas('department', function ($q) {
                $q->where('name', $this->filters['department']);
            });
        }

        // 3. Filter by Position
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

        // 5. Filter by Status (e.g., "Pending Setup")
        if (!empty($this->filters['status'])) {
            $query->where('status', $this->filters['status']);
        }

        return $query;
    }

    /**
     * Define the Excel sheet headings.
     *
     * @return array
     */
    public function headings(): array
    {
        return ['Name', 'Email', 'Department', 'Position', 'Branches', 'Status'];
    }

    /**
     * Map each row of the export.
     *
     * @param User $user
     * @return array
     */
    public function map($user): array
    {
        // Pluck branch names and turn them into a comma-separated string
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