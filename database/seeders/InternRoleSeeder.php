<?php

namespace Database\Seeders;

use App\Models\AdminACL;
use App\Models\Role;
use Illuminate\Database\Seeder;

class InternRoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $internRole = Role::firstOrCreate([
            'name' => 'Intern',
        ]);

        $modules = AdminACL::modules();
        $allowedPermissions = [
            'documents' => 'view',
            'feedback_form' => 'view',
        ];

        foreach ($modules as $module => $label) {
            AdminACL::updateOrCreate(
                [
                    'role_id' => $internRole->id,
                    'module' => $module,
                ],
                [
                    'permission_level' => $allowedPermissions[$module] ?? 'no_access',
                ]
            );
        }

        $this->command->info("Intern role seeded with limited ACL permissions.");
    }
}
