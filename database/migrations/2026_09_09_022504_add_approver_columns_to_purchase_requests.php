<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('reviewed_by_id')->nullable()->after('user_id');
            $table->unsignedBigInteger('approved_by_id')->nullable()->after('reviewed_by_id');
        });
    }

    public function down(): void {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->dropColumn(['reviewed_by_id', 'approved_by_id']);
        });
    }
};
