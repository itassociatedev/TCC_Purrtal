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
        Schema::create('admin_acl', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->string('module'); // 'employees', 'announcements', etc.
            $table->enum('permission_level', ['full', 'edit', 'view', 'no_access'])->default('no_access');
            $table->timestamps();
            
            // Unique constraint: one permission per role-module pair
            $table->unique(['role_id', 'module']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_acl');
    }
};
