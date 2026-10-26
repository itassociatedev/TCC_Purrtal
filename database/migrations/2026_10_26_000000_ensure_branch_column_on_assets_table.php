<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Databases that ran the original add_branch migration only received user_id,
     * so the branch column used by the Accountability module is added here.
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
        // Column is owned by 2026_05_27_180510_add_branch_to_assets_table
    }
};
