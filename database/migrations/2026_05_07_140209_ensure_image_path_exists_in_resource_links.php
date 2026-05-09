<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // We use this if-statement just to be extra safe!
        if (!Schema::hasColumn('resource_links', 'image_path')) {
            Schema::table('resource_links', function (Blueprint $table) {
                $table->string('image_path')->nullable()->after('url');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('resource_links', 'image_path')) {
            Schema::table('resource_links', function (Blueprint $table) {
                $table->dropColumn('image_path');
            });
        }
    }
};