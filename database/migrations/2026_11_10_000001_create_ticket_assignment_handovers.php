<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('ticket_assignment_handovers')) {
            Schema::create('ticket_assignment_handovers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('member_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
                $table->date('starts_on');
                $table->date('ends_on');
                $table->timestamp('revoked_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasIndex('ticket_assignment_handovers', 'ticket_handover_active_idx')) {
            Schema::table('ticket_assignment_handovers', function (Blueprint $table) {
                $table->index(['member_id', 'revoked_at', 'starts_on', 'ends_on'], 'ticket_handover_active_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_assignment_handovers');
    }
};
