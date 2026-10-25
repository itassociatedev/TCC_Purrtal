<?php

namespace Database\Seeders;

use App\Models\AdminACL;
use App\Models\Role;
use Illuminate\Database\Seeder;

class AdminACLSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get the admin role
        $adminRole = Role::where('name', 'admin')->first();

        if (!$adminRole) {
            $this->command->error('Admin role not found!');
            return;
        }

        // All available modules
        $modules = array_keys(\App\Models\AdminACL::modules());

        // Give admin full access to all modules
        foreach ($modules as $module) {
            AdminACL::updateOrCreate(
                [
                    'role_id' => $adminRole->id,
                    'module' => $module,
                ],
                [
                    'permission_level' => 'full',
                ]
            );
        }

        $this->command->info("✓ Admin role granted FULL access to all " . count($modules) . " modules!");
    }
}
