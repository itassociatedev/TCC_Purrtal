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
        // Older databases already received user_id from the previous add_branch migration
        if (Schema::hasColumn('assets', 'user_id')) {
            return;
        }

        Schema::table('assets', function (Blueprint $table) {
            // Links the asset directly to the users table
            $table->foreignId('user_id')->nullable()->after('assigned_personnel')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('assets', 'user_id')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->dropColumn('user_id');
            });
        }
    }
};
