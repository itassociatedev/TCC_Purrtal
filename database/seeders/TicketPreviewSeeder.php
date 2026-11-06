<?php

namespace Database\Seeders;

use App\Models\{Branch, Role, Ticket, User};
use App\Services\TicketAccess;
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TicketPreviewSeeder extends Seeder
{
    // Avoid employee-management audit events when generating sample accounts.
    use WithoutModelEvents;

    public function run(): void
    {
        DB::transaction(function () {
            // Ensure all three ticket workflows exist even on a small database.
            foreach (['Employee', config('ticketing.leader_roles')[0], config('ticketing.member_roles')[0]] as $name) {
                Role::firstOrCreate(['name' => $name]);
            }
            // Reuse configured clinic locations instead of creating a fake branch.
            $legacyBranch = Branch::where('name', 'Ticket Preview Clinic')->first();
            $branches = Branch::where('name', '!=', 'Ticket Preview Clinic')->orderBy('name')->get();
            if ($branches->isEmpty()) {
                throw new \RuntimeException('Add an actual clinic branch before seeding ticket previews.');
            }
            foreach (Role::orderBy('id')->get() as $index => $role) {
                $branch = $branches[$index % $branches->count()];
                // Reruns add missing roles without replacing existing test identities.
                $existing = DB::table('ticket_preview_users')->where('role_id', $role->id)->where('slot', 0)->value('user_id');
                if ($existing) continue;
                // Preview identities are disabled and have unknown random passwords;
                // the admin selector provides access without logging in as these users.
                $user = User::create([
                    'name' => 'Test Employee ('.$role->name.')',
                    'email' => 'ticket-preview-'.Str::uuid().'@example.invalid',
                    'password' => Str::random(64), 'status' => 'Disabled',
                    'email_verified_at' => now(), 'role_id' => $role->id, 'branch_id' => $branch->id,
                ]);
                DB::table('ticket_preview_users')->insert(['user_id' => $user->id, 'role_id' => $role->id]);
            }
            $users = User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->get();
            foreach ($users as $index => $user) {
                // Existing test identities keep their real primary branch. Accounts
                // on the retired sample branch are spread across actual locations.
                if (!$user->branch_id || $user->branch_id === $legacyBranch?->id) {
                    $user->update(['branch_id' => $branches[$index % $branches->count()]->id]);
                }
                // Preview employees may try every actual location in the branch dropdown.
                $user->branches()->syncWithoutDetaching($branches->pluck('id')->all());
                if ($legacyBranch) {
                    $user->branches()->detach($legacyBranch->id);
                    Ticket::where('creator_id', $user->id)->where('is_preview', true)
                        ->where('branch_id', $legacyBranch->id)->update(['branch_id' => $user->branch_id]);
                }
            }
            $this->call(TicketPreviewDepartmentsSeeder::class);
            // New examples use the current intake and SLA workflow instead of legacy rows.
            app(\App\Services\TicketDemoFactory::class)->seedPreview();
            // Foreign keys prevent removal if unrelated data still references it;
            // the transaction then rolls back instead of changing that live data.
            $legacyBranch?->delete();
        });
    }
}
