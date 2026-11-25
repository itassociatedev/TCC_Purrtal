<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('ticket_location_category_counters')) {
            return;
        }

        Schema::create('ticket_location_category_counters', function (Blueprint $table) {
            $table->string('location_code', 12);
            $table->string('category_code', 2);
            $table->unsignedInteger('last_number');
            $table->primary(['location_code', 'category_code']);
        });
    }

    public function down(): void
    {
        // Keep allocated sequences available if this migration is reapplied.
    }
};
