<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\{DB, Log, Schema};

return new class extends Migration {
    public function up(): void
    {
        DB::transaction(function () {
            $employee = DB::table('roles')->whereRaw('LOWER(TRIM(name)) = ?', ['employee'])->first();
            // A fresh database (CI, new installs) has no roles yet, so there is nothing to convert.
            if (!$employee) return;
            $mapping = ['IT TL' => 'IT Team Leader', 'IT Member' => 'IT Associate', 'IT Intern' => 'IT Intern'];
            foreach ($mapping as $roleName => $positionName) {
                $position = DB::table('positions')->whereRaw('LOWER(TRIM(name)) = ?', [strtolower($positionName)])->orderBy('id')->first();
                if (!$position) {
                    // Never stop a deploy halfway: leave this role and its users untouched and report it.
                    Log::warning("use_positions_for_ticket_access: position \"{$positionName}\" not found; role \"{$roleName}\" was left unchanged.");
                    continue;
                }
                $role = DB::table('roles')->whereRaw('LOWER(TRIM(name)) = ?', [strtolower($roleName)])->first();
                $emails = ['IT TL' => 'it-tl@tcc.local', 'IT Member' => 'it-member@tcc.local', 'IT Intern' => 'it-intern@tcc.local'];
                // Preserve IDs, passwords, departments, branch links, tickets and account status.
                DB::table('users')->where(function ($q) use ($role, $roleName, $emails) {
                    if ($role) $q->where('role_id', $role->id);
                    $q->orWhere('email', $emails[$roleName]);
                })->update(['role_id' => $employee->id, 'position_id' => $position->id]);
                if (!$role) continue;
                if (Schema::hasTable('ticket_preview_users')) {
                    // Keep legacy preview isolation without colliding with employee slot zero.
                    foreach (DB::table('ticket_preview_users')->where('role_id', $role->id)->orderBy('user_id')->get() as $link) {
                        $slot = (int) DB::table('ticket_preview_users')->where('role_id', $employee->id)->max('slot') + 1;
                        DB::table('ticket_preview_users')->where('user_id', $link->user_id)->update(['role_id' => $employee->id, 'slot' => $slot]);
                    }
                }
                // Obsolete IT-role ACLs are discarded, never copied to every employee.
                if (Schema::hasTable('admin_acl')) DB::table('admin_acl')->where('role_id', $role->id)->delete();
                DB::table('roles')->where('id', $role->id)->delete();
            }
        });
    }

    public function down(): void
    {
        throw new \RuntimeException('Position-based access migration is forward-only; do not recreate obsolete IT roles.');
    }
};
