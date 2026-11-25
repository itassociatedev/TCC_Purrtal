<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{Schema, DB};
return new class extends Migration {
    public function up(): void
    {
        Schema::create('ticket_priorities', function (Blueprint $table) {
            $table->id(); $table->string('key', 60)->unique(); $table->string('label', 80)->unique();
            $table->unsignedInteger('response_seconds'); $table->unsignedInteger('resolution_seconds');
            $table->unsignedInteger('update_seconds')->nullable(); $table->unsignedInteger('sort_order'); $table->timestamps();
        });
        // Preserve the installed policy, including deliberately enabled local test targets.
        foreach (config('ticket-sla.targets') as $key => $target) {
            DB::table('ticket_priorities')->insert(['key' => $key, 'label' => ucfirst($key),
                'response_seconds' => $target['response'], 'resolution_seconds' => $target['resolution'],
                'update_seconds' => $target['update'], 'sort_order' => array_search($key, array_keys(config('ticket-sla.targets'))) + 1,
                'created_at' => now(), 'updated_at' => now()]);
        }
    }
    public function down(): void { Schema::dropIfExists('ticket_priorities'); }
};
