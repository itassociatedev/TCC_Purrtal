<?php

namespace Database\Seeders;

use App\Models\{Branch, Role, User};
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdditionalTicketMembersSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        DB::transaction(function () {
            $role = Role::firstOrCreate(['name' => config('ticketing.member_roles')[0]]);
            $branches = Branch::where('name', '!=', 'Ticket Preview Clinic')->orderBy('name')->get();
            if ($branches->isEmpty()) throw new \RuntimeException('An actual clinic branch is required.');

            foreach (['Nathan Reed', 'Olivia Parker', 'Ethan Brooks'] as $index => $name) {
                // Role/slot is stable across reruns, so no duplicate test accounts
                // are created and existing assignments remain attached.
                $slot = $index + 1;
                if (DB::table('ticket_preview_users')->where('role_id', $role->id)->where('slot', $slot)->exists()) continue;
                $user = User::create([
                    'name' => $name.' ('.$role->name.')', 'email' => 'ticket-preview-'.Str::uuid().'@example.invalid',
                    'password' => Str::random(64), 'status' => 'Disabled', 'email_verified_at' => now(),
                    'role_id' => $role->id, 'branch_id' => $branches[$index % $branches->count()]->id,
                ]);
                DB::table('ticket_preview_users')->insert(['user_id' => $user->id, 'role_id' => $role->id, 'slot' => $slot]);
                $user->branches()->syncWithoutDetaching($branches->pluck('id')->all());
                $this->command?->info("Created test IT member: {$name}");
            }
            $this->call(TicketPreviewDepartmentsSeeder::class);
        });
    }
}
