<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Ticket;
use Illuminate\Support\Facades\DB;

$check = function ($ok, $message) {
    if (!$ok) throw new RuntimeException($message);
    echo "PASS: {$message}\n";
};

$prefixes = ['Hardware' => 'HW', 'Software' => 'SW', 'Network' => 'NW', 'Account & Access' => 'AC', 'Other' => 'OT'];
$counters = DB::table('ticket_category_counters')->pluck('next_number', 'prefix')->all();
$invalid = Ticket::orderBy('id')->cursor()->first(function ($ticket) use ($prefixes, $counters) {
    $prefix = $prefixes[$ticket->category] ?? 'OT';

    return !preg_match('/^'.$prefix.'[0-9]{4,20}$/D', $ticket->ticket_code)
        || (int) substr($ticket->ticket_code, 2) >= $counters[$prefix];
});
$check($invalid === null, 'Existing tickets have category IDs below the next counter');
echo 'Existing tickets verified: '.Ticket::count()."\n";

$sample = Ticket::firstOrFail();
DB::beginTransaction();
try {
    foreach ([...array_keys($prefixes), 'Hardware'] as $category) {
        $ticket = $sample->replicate();
        $ticket->category = $category;
        $ticket->save();
        $prefix = $prefixes[$category];
        $expected = sprintf('%s%04d', $prefix, $counters[$prefix]);
        $check($ticket->fresh()->ticket_code === $expected, "{$category} receives {$expected}");
        $counters[$prefix]++;
    }
} finally {
    DB::rollBack();
}
