<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserAccountsSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $accounts = [
            ['name' => 'Duty Meal Custodian', 'email' => 'dmc@gmail.com', 'password' => 'ad123456', 'role' => 'Duty Meal Custodian', 'nickname' => 'DMC'],
            ['name' => 'HR', 'email' => 'hr@gmail.com', 'password' => 'ad123456', 'role' => 'HR', 'nickname' => 'HR'],
            ['name' => 'Chief Vet', 'email' => 'cv@gmail.com', 'password' => 'ad123456', 'role' => 'Chief Vet', 'nickname' => 'CV'],
            ['name' => 'Vet Tech TL', 'email' => 'vttl@gmail.com', 'password' => 'ad123456', 'role' => 'Vet Tech TL', 'nickname' => 'VTTL'],
            ['name' => 'Director of Corporate Services and Operations', 'email' => 'dcso@gmail.com', 'password' => 'ad123456', 'role' => 'Director of Corporate Services and Operations', 'nickname' => 'DCSO'],
            ['name' => 'HRBP', 'email' => 'hrbp@gmail.com', 'password' => 'ad123456', 'role' => 'HRBP', 'nickname' => 'HRBP'],
            ['name' => 'IT TL', 'email' => 'ittl@gmail.com', 'password' => 'ad123456', 'role' => 'IT TL', 'nickname' => 'ITTL'],
            ['name' => 'Marketing Manager', 'email' => 'mm@gmail.com', 'password' => 'ad123456', 'role' => 'Marketing Manager', 'nickname' => 'MM'],
            ['name' => 'Cashier TL', 'email' => 'ctl@gmail.com', 'password' => 'ad123456', 'role' => 'Cashier TL', 'nickname' => 'CTL'],
            ['name' => 'Housekeeping TL', 'email' => 'hktl@gmail.com', 'password' => 'ad123456', 'role' => 'Housekeeping TL', 'nickname' => 'HKTL'],
            ['name' => 'Inventory TL', 'email' => 'itl@gmail.com', 'password' => 'ad123456', 'role' => 'Inventory TL', 'nickname' => 'ITL'],
            ['name' => 'Clinic Assistant TL', 'email' => 'catl@gmail.com', 'password' => 'ad123456', 'role' => 'Clinic Assistant TL', 'nickname' => 'CATL'],
            ['name' => 'Procurement TL', 'email' => 'ptl@gmail.com', 'password' => 'ad123456', 'role' => 'Procurement TL', 'nickname' => 'PTL'],
            ['name' => 'Auditor TL', 'email' => 'atl@gmail.com', 'password' => 'ad123456', 'role' => 'Auditor TL', 'nickname' => 'ATL'],
            ['name' => 'Inventory Assist', 'email' => 'ia@gmail.com', 'password' => 'ad123456', 'role' => 'Inventory Assist', 'nickname' => 'IA'],
            ['name' => 'Procurement Assist', 'email' => 'pa@gmail.com', 'password' => 'ad123456', 'role' => 'Procurement Assist', 'nickname' => 'PA'],
            ['name' => 'General Accounting', 'email' => 'ga@gmail.com', 'password' => 'ad123456', 'role' => 'General Accounting', 'nickname' => 'GA'],
            ['name' => 'HR Assistant', 'email' => 'hra@gmail.com', 'password' => 'ad123456', 'role' => 'HR Assistant', 'nickname' => 'HRA'],
            ['name' => 'Audit Assistant', 'email' => 'aa@gmail.com', 'password' => 'ad123456', 'role' => 'Audit Assistant', 'nickname' => 'AA'],
        ];

        foreach ($accounts as $account) {
            $role = Role::firstOrCreate(['name' => $account['role']]);

            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'password' => Hash::make($account['password']),
                    'email_verified_at' => now(),
                    'status' => 'Active',
                    'role_id' => $role->id,
                ]
            );
        }
    }
}
