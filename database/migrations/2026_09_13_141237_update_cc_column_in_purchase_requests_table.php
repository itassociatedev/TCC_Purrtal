<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            // 1. Skip dropping the foreign key because it does not exist in this database state

            // 2. Safely drop the old column directly
            if (Schema::hasColumn('purchase_requests', 'cc_user_id')) {
                $table->dropColumn('cc_user_id');
            }

            // 3. Add the new JSON column to store an array of IDs
            if (!Schema::hasColumn('purchase_requests', 'cc_users')) {
                $table->json('cc_users')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_requests', 'cc_users')) {
                $table->dropColumn('cc_users');
            }
            if (!Schema::hasColumn('purchase_requests', 'cc_user_id')) {
                $table->unsignedBigInteger('cc_user_id')->nullable();
            }
        });
    }
};
