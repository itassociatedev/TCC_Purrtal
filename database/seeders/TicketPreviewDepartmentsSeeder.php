<?php

namespace Database\Seeders;

use App\Models\{Department, User};
use App\Services\TicketAccess;
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\{DB, File};

class TicketPreviewDepartmentsSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // Generic preview roles use representative departments; specialist roles
        // map explicitly. Only accounts registered for ticket preview are modified.
        $mapping = [
            'admin' => 'Information Technology', 'it' => 'Information Technology', 'it admin' => 'Information Technology',
            'employee' => 'Operations', 'audit assistant' => 'Audit', 'auditor tl' => 'Audit',
            'cashier tl' => 'Cashier', 'chief vet' => 'Veterinarians', 'clinic assistant tl' => 'Clinic Assistants',
            'director of corporate services and operations' => 'Executive', 'executive vice president' => 'Executive', 'executive assistant' => 'Executive',
            'duty meal custodian' => 'Clinic Assistants', 'general accounting' => 'Accounting', 'housekeeping tl' => 'Housekeeping',
            'hr' => 'Human Resources', 'hr assistant' => 'Human Resources', 'hrbp' => 'Human Resources',
            'inventory assist' => 'Inventory', 'inventory tl' => 'Inventory', 'marketing manager' => 'Marketing',
            'operations manager' => 'Operations', 'procurement assist' => 'Procurement', 'procurement tl' => 'Procurement', 'vet tech tl' => 'Veterinary Technicians',
        ];
        DB::transaction(function () use ($mapping) {
            $users = User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->with('role')->get();
            $departments = Department::pluck('id', 'name');
            $changes = [];
            foreach ($users as $user) {
                $role = strtolower(trim($user->role?->name ?? ''));
                $name = TicketAccess::role($user) !== 'employee' ? 'Information Technology' : ($mapping[$role] ?? null);
                if (!$name) {
                    // Preserve an assigned department for unlisted future roles.
                    if ($user->department_id) continue;
                    $name = 'Operations';
                }
                if (!isset($departments[$name])) throw new \RuntimeException("Existing department required for preview role {$role}: {$name}");
                if ($user->department_id !== $departments[$name]) $changes[] = ['user_id' => $user->id, 'role' => $user->role?->name, 'previous_department_id' => $user->department_id, 'department_id' => $departments[$name], 'department' => $name];
            }
            if ($changes) {
                $directory = storage_path('app/private/ticket-backups');
                File::ensureDirectoryExists($directory);
                $path = $directory.'/preview-departments-'.now()->format('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json';
                $json = json_encode($changes, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
                if (file_put_contents($path, $json, LOCK_EX) !== strlen($json)) throw new \RuntimeException('Cannot back up preview department assignments.');
                foreach ($changes as $change) DB::table('users')->where('id', $change['user_id'])->update(['department_id' => $change['department_id']]);
            }
            $this->command?->info(count($changes).' preview department assignments updated; live accounts and ticket snapshots unchanged.');
        });
    }
}
