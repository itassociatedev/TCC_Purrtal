<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            // Links directly to the existing users table
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            // Categorization (e.g., 'Day Shift', 'Graveyard Shift')
            $table->string('shift_type')->nullable(); 
            
            // Exact operating hours
            $table->time('start_time');
            $table->time('end_time');
            
            // Stores the array of rest days (e.g., ["Saturday", "Sunday"])
            $table->json('off_days')->nullable(); 
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedules');
    }
};
