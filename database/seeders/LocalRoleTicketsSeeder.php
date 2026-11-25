<?php

namespace Database\Seeders;

use App\Models\{Role, Ticket, User};
use App\Services\{TicketAccess, TicketDemoFactory};
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LocalRoleTicketsSeeder extends Seeder
{
    public function run(TicketDemoFactory $factory): void
    {
        if (!app()->environment('local') || DB::connection()->getDatabaseName() !== 'tcc_purrtal_local') {
            throw new \RuntimeException('Sample role tickets require the tcc_purrtal_local database.');
        }

        $count = DB::transaction(function () use ($factory) {
            $roles = Role::orderBy('id')->get();
            $accounts = User::without('role')->where('name', 'like', 'Local Role Test (%)')
                ->orderBy('id')->lockForUpdate()->get()->keyBy('email');
            $users = $roles->map(function (Role $role) use ($accounts) {
                $account = $accounts->get(Str::slug($role->name).'@tcc.local');
                if (!$account || $account->name !== 'Local Role Test ('.$role->name.')'
                    || (int) $account->role_id !== (int) $role->id) {
                    throw new \RuntimeException('Run LocalRoleAccountsSeeder before creating sample tickets.');
                }
                return $account->setRelation('role', $role);
            });

            $member = $users->first(fn (User $user) => TicketAccess::role($user) === 'member');
            $leader = $users->first(fn (User $user) => TicketAccess::role($user) === 'leader');
            if (!$member || !$leader) {
                throw new \RuntimeException('Sample tickets require a local IT member and team leader.');
            }

            $count = 0;
            foreach ($users as $user) {
                $owner = TicketAccess::role($user) === 'employee' ? $member : $user;
                foreach (['new', 'active', 'resolved', 'closed'] as $scenario) {
                    $marker = "[Local role sample: {$scenario}]";
                    if (Ticket::where('creator_id', $user->id)->where('is_preview', false)
                        ->where('description', 'like', "%{$marker}")->exists()) {
                        continue;
                    }

                    // Replay the demo workflow with notifications suppressed, then
                    // expose the completed sample to normal local ticket views.
                    $ticket = $factory->make($user, $owner, $leader, $scenario);
                    $ticket->update([
                        'is_preview' => false,
                        'description' => $ticket->description."\n".$marker,
                    ]);
                    $count++;
                }
            }

            return $count;
        });

        $this->command?->info("Created {$count} sample tickets for local role accounts.");
    }
}
