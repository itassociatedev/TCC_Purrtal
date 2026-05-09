<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resource_links', function (Blueprint $table) {
            // This tells MySQL to change the column from VARCHAR(255) to TEXT (which holds 65,000+ characters)
            $table->text('url')->change();
        });
    }

    public function down(): void
    {
        Schema::table('resource_links', function (Blueprint $table) {
            $table->string('url', 255)->change();
        });
    }
};