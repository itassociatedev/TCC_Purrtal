<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // Null is intentional: pre-existing tickets are not enrolled or backfilled.
            $table->json('sla_policy')->nullable();
            $table->json('sla_state')->nullable();
            $table->timestamp('sla_received_at')->nullable()->index();
            $table->string('reporting_channel')->default('portal');
            $table->text('emergency_reason')->nullable();
        });
        Schema::create('ticket_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type');
            $table->text('message');
            $table->json('details')->nullable();
            $table->timestamp('created_at');
            $table->index(['ticket_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_activities');
        Schema::table('tickets', fn (Blueprint $table) => $table->dropColumn([
            'sla_policy', 'sla_state', 'sla_received_at', 'reporting_channel', 'emergency_reason',
        ]));
    }
};
