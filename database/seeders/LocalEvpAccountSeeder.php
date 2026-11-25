<?php
namespace Database\Seeders;

use App\Models\{Branch, Department, Position, Role, User};
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\{DB, Hash};

class LocalEvpAccountSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // Only this local dummy identity is changed; never reset other role accounts.
        if (!app()->environment('local') || DB::connection()->getDatabaseName() !== 'tcc_purrtal_local') {
            throw new \RuntimeException('EVP test credentials require the isolated local database.');
        }
        DB::transaction(function () {
            $role = Role::where('name', 'Executive Vice President')->firstOrFail();
            $name = 'Local Role Test (Executive Vice President)';
            $account = User::where('email', 'evp@tcc.local')->first()
                ?? User::where('email', 'executive-vice-president@tcc.local')->first();
            if ($account && ($account->name !== $name || (int) $account->role_id !== (int) $role->id)) {
                throw new \RuntimeException('The EVP test email belongs to another account.');
            }
            $account ??= new User(['name' => $name, 'role_id' => $role->id,
                'branch_id' => Branch::where('name', 'Makati')->firstOrFail()->id,
                'department_id' => User::where('role_id', $role->id)->whereNotNull('department_id')->value('department_id')
                    ?? Department::where('name', 'Operations')->firstOrFail()->id]);
            // Use an existing position; never create roles or HR titles for the test login.
            $account->position_id = Position::where('name', 'Executive Vice President')->firstOrFail()->id;
            $account->fill(['email' => 'evp@tcc.local', 'password' => 'evp123123', 'status' => 'Active',
                'email_verified_at' => now(), 'failed_login_attempts' => 0, 'device_limit' => 5])->save();
            $account->branches()->syncWithoutDetaching([$account->branch_id]);
            if (!Hash::check('evp123123', $account->fresh()->password)) throw new \RuntimeException('Password verification failed.');
            if (!\App\Services\TicketAccess::canViewLeaderboard($account->fresh())) throw new \RuntimeException('Leaderboard permission missing.');
            $this->command?->info('EVP local test login configured and password/leaderboard permission verified (user '.$account->id.').');
        });
    }
}
