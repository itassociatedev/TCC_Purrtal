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
            $role = Role::whereRaw('LOWER(name) = ?', ['employee'])->firstOrFail();
            $position = \App\Models\Position::where('name', 'IT Associate')->firstOrFail();
            $branches = Branch::where('name', '!=', 'Ticket Preview Clinic')->orderBy('name')->get();
            if ($branches->isEmpty()) throw new \RuntimeException('An actual clinic branch is required.');

            foreach (['Nathan Reed', 'Olivia Parker', 'Ethan Brooks'] as $index => $name) {
                // Reuse the named preview identity; allocate an unused employee-role slot
                // without recreating an IT role or colliding with other previews.
                $label = $name.' (IT Associate)';
                if (User::where('name', $label)->whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->exists()) continue;
                $slot = (int) DB::table('ticket_preview_users')->where('role_id', $role->id)->max('slot') + 1;
                $user = User::create([
                    'name' => $label, 'email' => 'ticket-preview-'.Str::uuid().'@example.invalid',
                    'password' => Str::random(64), 'status' => 'Disabled', 'email_verified_at' => now(),
                    'role_id' => $role->id, 'position_id' => $position->id, 'branch_id' => $branches[$index % $branches->count()]->id,
                ]);
                DB::table('ticket_preview_users')->insert(['user_id' => $user->id, 'role_id' => $role->id, 'slot' => $slot]);
                $user->branches()->syncWithoutDetaching($branches->pluck('id')->all());
                $this->command?->info("Created test IT member: {$name}");
            }
            $this->call(TicketPreviewDepartmentsSeeder::class);
        });
    }
}
