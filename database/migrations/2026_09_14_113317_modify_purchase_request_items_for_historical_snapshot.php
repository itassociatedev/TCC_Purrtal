<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add the historical snapshot column
        Schema::table('purchase_request_items', function (Blueprint $table) {
            $table->string('product_name')->nullable()->after('product_id');
        });

        // 2. Safely backfill existing PR items with current product names
        DB::table('purchase_request_items')
            ->join('products', 'purchase_request_items.product_id', '=', 'products.id')
            ->update(['purchase_request_items.product_name' => DB::raw('products.name')]);

        // 3. Drop the strict CASCADE foreign key and make the column nullable
        Schema::table('purchase_request_items', function (Blueprint $table) {
            $table->dropForeign('purchase_request_items_product_id_foreign');
            $table->unsignedBigInteger('product_id')->nullable()->change();

            // 4. Add the safe SET NULL foreign key
            $table->foreign('product_id', 'purchase_request_items_product_id_foreign')
                  ->references('id')
                  ->on('products')
                  ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_request_items', function (Blueprint $table) {
            $table->dropForeign('purchase_request_items_product_id_foreign');
            $table->unsignedBigInteger('product_id')->nullable(false)->change();

            $table->foreign('product_id', 'purchase_request_items_product_id_foreign')
                  ->references('id')
                  ->on('products')
                  ->onDelete('cascade');

            $table->dropColumn('product_name');
        });
    }
};
