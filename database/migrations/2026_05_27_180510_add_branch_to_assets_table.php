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
        if (Schema::hasColumn('assets', 'branch')) {
            return;
        }

        Schema::table('assets', function (Blueprint $table) {
            $table->string('branch')->nullable()->after('department');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('assets', 'branch')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->dropColumn('branch');
            });
        }
    }
};
