<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Slot zero is the original role representative; additional slots allow
        // multiple test members without creating artificial application roles.
        Schema::table('ticket_preview_users', function (Blueprint $table) {
            $table->unsignedSmallInteger('slot')->default(0);
            $table->unique(['role_id', 'slot']);
        });
        Schema::table('ticket_preview_users', fn (Blueprint $table) => $table->dropUnique(['role_id']));
    }

    public function down(): void
    {
        // Restoring the original constraint fails safely if extra members remain.
        Schema::table('ticket_preview_users', fn (Blueprint $table) => $table->unique('role_id'));
        Schema::table('ticket_preview_users', function (Blueprint $table) {
            $table->dropUnique(['role_id', 'slot']);
            $table->dropColumn('slot');
        });
    }
};
