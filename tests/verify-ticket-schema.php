<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\{DB, Schema};
$removed = ['issue_at', 'issue_time_type', 'affected_users', 'affected_areas', 'error_messages', 'troubleshooting_steps', 'follow_up_contact'];
foreach ($removed as $column) if (Schema::hasColumn('tickets', $column)) throw new RuntimeException("Obsolete column still exists: {$column}");
$files = glob(storage_path('app/private/ticket-backups/before-intake-cleanup-*.jsonl')); sort($files); $path = end($files);
if (!$path) throw new RuntimeException('Cleanup archive missing.');
$count = 0;
foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $original = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
    $current = (array) DB::table('tickets')->where('id', $original['id'])->first();
    foreach ($removed as $column) unset($original[$column]);
    if ($original != $current) throw new RuntimeException('Retained data changed on ticket '.$original['id']);
    $count++;
}
echo "PASS: Seven obsolete columns removed.\nPASS: All retained values preserved for {$count} existing tickets.\nBackup: {$path}\n";
