<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->string('prepared_by_name')->nullable()->after('user_id');
            $table->string('prepared_by_role')->nullable()->after('prepared_by_name');
            $table->string('reviewed_by_name')->nullable()->after('reviewed_by_id');
            $table->string('reviewed_by_role')->nullable()->after('reviewed_by_name');
            $table->string('approved_by_role')->nullable()->after('approved_by_name');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->dropColumn([
                'prepared_by_name',
                'prepared_by_role',
                'reviewed_by_name',
                'reviewed_by_role',
                'approved_by_role'
            ]);
        });
    }
};
