<?php

namespace Database\Seeders;

use App\Models\{Ticket, User};
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TicketPreviewNamesSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        DB::transaction(function () {
            // Rename registered test identities only. IDs, assignments, branches,
            // and real employee records are unaffected by this presentation change.
            $users = User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->get();
            foreach ($users as $user) {
                $suffix = ' ('.$user->role->name.')';
                // Repeated runs must not append the role more than once.
                if (!Str::endsWith($user->name, $suffix)) {
                    $user->update(['name' => $user->name.$suffix]);
                }
                // Preview rows store the creator's name as a snapshot; synchronize
                // those snapshots without rewriting any live ticket history.
                Ticket::where('creator_id', $user->id)->where('is_preview', true)
                    ->where('employee_name', '!=', $user->name)->update(['employee_name' => $user->name]);
            }
            $this->command?->info("Role labels applied to {$users->count()} test employees.");
        });
    }
}
