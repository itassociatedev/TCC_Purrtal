<?php
namespace Database\Seeders;
use App\Models\{User, Role, Position, Department, Branch};
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\DB;

class LocalItPositionAccountsSeeder extends Seeder
{
    use WithoutModelEvents;
    public function run(): void
    {
        if (!app()->environment('local') || DB::connection()->getDatabaseName() !== 'tcc_purrtal_local') {
            throw new \RuntimeException('IT test accounts require the isolated local database.');
        }
        DB::transaction(function () {
            $role = Role::whereRaw('LOWER(name) = ?', ['employee'])->firstOrFail();
            foreach (['it-tl' => ['IT Team Leader', 'Local Role Test (IT TL)'], 'it-member' => ['IT Associate', 'Local Role Test (IT Member)'], 'it-intern' => ['IT Intern', 'IT Intern Test']] as $slug => [$title, $name]) {
                $position = Position::where('name', $title)->firstOrFail();
                $user = User::where('email', $slug.'@tcc.local')->first();
                if ($user && $user->name !== $name) throw new \RuntimeException('Test email belongs to another account.');
                $user ??= new User(['name' => $name, 'email' => $slug.'@tcc.local', 'password' => $slug.'123123',
                    'branch_id' => Branch::where('name', 'Makati')->firstOrFail()->id]);
                // Existing passwords/branch/status remain intact when correcting position metadata.
                $user->role_id = $role->id; $user->position_id = $position->id;
                $user->department_id = Department::where('name', 'Information Technology')->firstOrFail()->id;
                $user->status ??= 'Active'; $user->email_verified_at ??= now();
                $user->device_limit ??= 5; $user->save();
                $user->branches()->syncWithoutDetaching([$user->branch_id]);
            }
        });
    }
}
