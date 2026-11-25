<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Explicit registration prevents selecting arbitrary live users in preview.
        // The unique role key permits exactly one generated test identity per role.
        Schema::create('ticket_preview_users', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained('users')->cascadeOnDelete();
            $table->foreignId('role_id')->unique()->constrained('roles')->cascadeOnDelete();
        });
        // Existing tickets remain live; new preview writes opt into the test dataset.
        Schema::table('tickets', fn (Blueprint $table) => $table->boolean('is_preview')->default(false)->index());
    }

    public function down(): void
    {
        Schema::table('tickets', fn (Blueprint $table) => $table->dropColumn('is_preview'));
        Schema::dropIfExists('ticket_preview_users');
    }
};
