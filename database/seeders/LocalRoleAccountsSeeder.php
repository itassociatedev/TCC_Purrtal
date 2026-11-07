<?php

namespace Database\Seeders;

use App\Models\{Branch, Department, Role, User};
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LocalRoleAccountsSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // These predictable credentials belong only in the isolated local database.
        if (!app()->environment('local') || DB::connection()->getDatabaseName() !== 'tcc_purrtal_local') {
            throw new \RuntimeException('Local role accounts require the tcc_purrtal_local database.');
        }

        $branch = Branch::where('name', 'Makati')->firstOrFail();
        $operations = Department::where('name', 'Operations')->firstOrFail();
        $it = Department::where('name', 'Information Technology')->firstOrFail();
        $roles = Role::orderBy('name')->get();

        DB::transaction(function () use ($roles, $branch, $operations, $it) {
            foreach ($roles as $role) {
                $slug = Str::slug($role->name);
                $email = $slug.'@tcc.local';
                $name = 'Local Role Test ('.$role->name.')';
                $account = User::where('email', $email)->first();
                // Never replace an existing employee or another role's credentials.
                if ($account && ($account->name !== $name || (int) $account->role_id !== (int) $role->id)) {
                    throw new \RuntimeException("The email {$email} is already assigned to another account.");
                }

                $departmentId = User::where('role_id', $role->id)
                    ->whereNotNull('department_id')->orderBy('id')->value('department_id');
                if (in_array(strtolower($role->name), array_map('strtolower', [
                    ...config('ticketing.leader_roles'), ...config('ticketing.member_roles'),
                ]), true)) {
                    $departmentId = $it->id;
                }

                $account ??= new User();
                $account->fill([
                    'name' => $name,
                    'email' => $email,
                    'password' => $slug.'123123',
                    'status' => 'Active',
                    'role_id' => $role->id,
                    'branch_id' => $branch->id,
                    'department_id' => $departmentId ?? $operations->id,
                    'email_verified_at' => now(),
                    'failed_login_attempts' => 0,
                    'device_limit' => 5,
                ])->save();
                $account->branches()->sync([$branch->id]);
            }
        });

        $this->command?->info("Configured {$roles->count()} local accounts for {$branch->name}.");
    }
}
