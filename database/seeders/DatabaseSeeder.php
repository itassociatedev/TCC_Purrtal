<?php
// Seeds initial database data including roles and default users

namespace Database\\Seeders;

use App\Models\User;
use Database\Seeders\InternRoleSeeder;
use Database\Seeders\UserAccountsSeeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        $this->call([
            InternRoleSeeder::class,
            UserAccountsSeeder::class,
        ]);
    }
}
