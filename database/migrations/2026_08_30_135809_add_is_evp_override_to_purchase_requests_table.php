<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
{
    if (!Schema::hasColumn('purchase_requests', 'is_evp_override')) {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->boolean('is_evp_override')
                ->default(false)
                ->after('status');
        });
    }
}

    public function down(): void
{
    if (Schema::hasColumn('purchase_requests', 'is_evp_override')) {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->dropColumn('is_evp_override');
        });
    }
}
};