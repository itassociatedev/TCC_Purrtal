<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Adds a nullable 'deleted_at' timestamp column
            $table->softDeletes(); 
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Safely rolls back the column if needed
            $table->dropSoftDeletes(); 
        });
    }
};