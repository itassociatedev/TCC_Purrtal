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
        Schema::create('duty_meal_branch_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('duty_date'); // The exact date of the meal
            $table->foreignId('original_branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('requested_branch_id')->constrained('branches')->cascadeOnDelete();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('reason')->nullable(); // Optional context from the employee
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete(); // The admin who approved/rejected
            $table->timestamp('handled_at')->nullable();
            $table->timestamps();
            
            // Ensure a user can only have one active request per day
            $table->unique(['user_id', 'duty_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('duty_meal_branch_requests');
    }
};
