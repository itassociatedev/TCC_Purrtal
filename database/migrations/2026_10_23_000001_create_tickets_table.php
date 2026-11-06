<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Restrict deletion of referenced accounts/branches to preserve ticket history.
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained()->restrictOnDelete();
            // Snapshot the submitted name even if the employee is later renamed.
            $table->string('employee_name');
            $table->string('subject', 180);
            $table->text('description');
            $table->string('category');
            $table->string('status')->default('not_started')->index();
            $table->string('priority')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->restrictOnDelete();
            // Reports count when tickets closed, independently of creation time.
            $table->timestamp('closed_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
