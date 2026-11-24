<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('assets', 'remarks')) {
            return;
        }

        Schema::table('assets', function (Blueprint $table) {
            $table->text('remarks')->nullable()->after('color');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('assets', 'remarks')) {
            return;
        }

        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('remarks');
        });
    }
};
