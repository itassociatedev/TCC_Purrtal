<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};
return new class extends Migration {
    public function up(): void
    {
        // Resolve pre-existing ties/gaps deterministically before adding the constraint.
        DB::transaction(function () {
            foreach (DB::table('ticket_priorities')->orderBy('sort_order')->orderBy('id')->lockForUpdate()->get() as $index => $priority) {
                DB::table('ticket_priorities')->where('id', $priority->id)->update(['sort_order' => $index + 1]);
            }
        });
        Schema::table('ticket_priorities', fn (Blueprint $table) => $table->unique('sort_order', 'ticket_priorities_sort_order_unique'));
    }
    public function down(): void
    {
        Schema::table('ticket_priorities', fn (Blueprint $table) => $table->dropUnique('ticket_priorities_sort_order_unique'));
    }
};
