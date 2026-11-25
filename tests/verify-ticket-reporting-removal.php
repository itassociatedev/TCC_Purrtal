<?php
// Read-only confirmation after the focused removal migration has been applied.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\{Schema, DB};
foreach (['reporting_channel', 'emergency_reason'] as $column) {
    if (Schema::hasColumn('tickets', $column)) throw new RuntimeException('Obsolete column remains: '.$column);
    if (in_array($column, (new App\Models\Ticket)->getFillable(), true)) throw new RuntimeException('Obsolete model attribute remains');
}
foreach (DB::table('ticket_activities')->select(['type', 'details'])->cursor() as $event) {
    $details = json_decode($event->details ?? '{}', true);
    if (!is_array($details)) continue;
    if (array_key_exists('reporting_channel', $details) || array_key_exists('emergency_reason', $details)
        || ($event->type === 'received' && array_key_exists('channel', $details))) throw new RuntimeException('Obsolete history metadata remains');
}
echo 'PASS: Reporting columns, model attributes and copied receipt metadata removed; '.DB::table('tickets')->count().' existing tickets remain.'.PHP_EOL;
