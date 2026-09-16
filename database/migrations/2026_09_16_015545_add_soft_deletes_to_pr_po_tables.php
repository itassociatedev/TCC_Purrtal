<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_requests', 'deleted_at')) {
                $table->softDeletes();
            }
        });
        Schema::table('purchase_request_items', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_request_items', 'deleted_at')) {
                $table->softDeletes();
            }
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_orders', 'deleted_at')) {
                $table->softDeletes();
            }
        });
        Schema::table('purchase_order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_order_items', 'deleted_at')) {
                $table->softDeletes();
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_requests', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
        Schema::table('purchase_request_items', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_request_items', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
        Schema::table('purchase_order_items', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_order_items', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
