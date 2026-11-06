<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, File, Schema};

return new class extends Migration {
    private const REMOVED = ['issue_at', 'issue_time_type', 'affected_users', 'affected_areas', 'error_messages', 'troubleshooting_steps', 'follow_up_contact'];

    public function up(): void
    {
        $columns = array_values(array_filter(self::REMOVED, fn ($column) => Schema::hasColumn('tickets', $column)));
        if (!$columns) return;
        // Archive complete existing rows before dropping obsolete intake columns.
        // Abort on any write error: a failed backup must never permit the schema change.
        $directory = storage_path('app/private/ticket-backups');
        File::ensureDirectoryExists($directory);
        $path = $directory.'/before-intake-cleanup-'.now()->format('Ymd-His').'-'.bin2hex(random_bytes(4)).'.jsonl';
        $handle = fopen($path, 'xb');
        if (!$handle) throw new RuntimeException('Cannot create ticket cleanup backup.');
        try {
            foreach (DB::table('tickets')->orderBy('id')->cursor() as $row) {
                $line = json_encode($row, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)."\n";
                if (fwrite($handle, $line) !== strlen($line)) throw new RuntimeException('Ticket backup write failed.');
            }
            if (!fflush($handle)) throw new RuntimeException('Ticket backup flush failed.');
        } finally { fclose($handle); }
        Schema::table('tickets', fn (Blueprint $table) => $table->dropColumn($columns));
    }

    public function down(): void
    {
        // Rollback restores schema only. Original values remain in the private JSONL archive.
        Schema::table('tickets', function (Blueprint $table) {
            $table->dateTime('issue_at')->nullable();
            $table->string('issue_time_type')->nullable();
            $table->unsignedInteger('affected_users')->nullable();
            foreach (['affected_areas', 'error_messages', 'troubleshooting_steps', 'follow_up_contact'] as $column) $table->text($column)->nullable();
        });
    }
};
