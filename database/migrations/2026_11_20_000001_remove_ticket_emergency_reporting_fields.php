<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void
    {
        // Intentionally discard these obsolete values on existing test tickets too.
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn(['reporting_channel', 'emergency_reason']);
        });
        // Older receipt events copied the channel into JSON; do not keep exposing it in history.
        DB::table('ticket_activities')->select(['id', 'type', 'details'])->orderBy('id')->chunkById(200, function ($events) {
            foreach ($events as $event) {
                $details = json_decode($event->details ?? '{}', true);
                if (!is_array($details)) continue;
                $original = $details;
                unset($details['reporting_channel'], $details['emergency_reason']);
                if ($event->type === 'received') unset($details['channel']);
                if ($original !== $details) DB::table('ticket_activities')->where('id', $event->id)
                    ->update(['details' => json_encode($details)]);
            }
        });
    }

    public function down(): void
    {
        // Rollback recreates the columns only; discarded testing data cannot be restored.
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('reporting_channel')->default('portal');
            $table->text('emergency_reason')->nullable();
        });
    }
};
