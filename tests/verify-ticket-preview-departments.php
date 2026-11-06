<?php
// Read-only checks for the department configuration used by ticket preview.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$users = App\Models\User::whereIn('id', Illuminate\Support\Facades\DB::table('ticket_preview_users')->select('user_id'))->with(['role','department'])->get();
if ($users->isEmpty()) throw new RuntimeException('No registered preview accounts.');
foreach ($users as $user) {
    if (!$user->department) throw new RuntimeException('Preview account has no existing department: '.$user->id);
    if (App\Services\TicketAccess::role($user) !== 'employee' && $user->department->name !== 'Information Technology') throw new RuntimeException('IT preview account has incorrect department.');
    if (strtolower($user->role?->name ?? '') === 'employee' && $user->department->name !== 'Operations') throw new RuntimeException('Generic employee preview must use Operations.');
}
echo 'PASS: All '.$users->count()." registered preview accounts have existing departments.\nPASS: IT preview staff use Information Technology; generic Employee uses Operations.\n";
foreach ($users->groupBy(fn ($u) => $u->department->name)->sortKeys() as $department => $group) echo $department.': '.$group->count()." test accounts\n";
