<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ticket_locations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            $table->string('code', 12)->unique();
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->unsignedBigInteger('branch_id')->nullable()->change();
            $table->foreignId('ticket_location_id')->nullable()->constrained()->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::table('tickets')->whereNull('branch_id')->exists()) {
            throw new \RuntimeException('Tickets using custom locations must be migrated before rolling back.');
        }

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ticket_location_id');
            $table->unsignedBigInteger('branch_id')->nullable(false)->change();
        });
        Schema::dropIfExists('ticket_locations');
    }
};
