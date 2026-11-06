<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The original create migration for the PO tables was never committed, so fresh
     * databases could not be built. Existing databases already have these tables and skip it.
     */
    public function up(): void
    {
        if (!Schema::hasTable('purchase_orders')) {
            Schema::create('purchase_orders', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('purchase_request_id')->nullable();
                $table->unsignedBigInteger('supplier_id');
                $table->unsignedBigInteger('prepared_by_id')->nullable();
                $table->string('po_number');
                $table->date('po_date');
                $table->date('delivery_date')->nullable();
                $table->string('payment_terms')->default('30 Days');
                $table->string('ship_to')->nullable();
                $table->text('shipping_address')->nullable();
                $table->string('attention')->nullable();
                $table->string('contact_no')->nullable();
                $table->text('purpose')->nullable();
                $table->string('department')->nullable();
                $table->string('delivery_location')->nullable();
                $table->text('special_instructions')->nullable();
                $table->decimal('gross_amount', 15, 2)->default(0);
                $table->decimal('discount_total', 15, 2)->default(0);
                $table->decimal('net_of_discount', 15, 2)->default(0);
                $table->decimal('vat_total', 15, 2)->default(0);
                $table->decimal('grand_total', 15, 2)->default(0);
                $table->string('status')->default('drafted');
                $table->text('remarks')->nullable();
                $table->unsignedInteger('no_of_quotations')->default(0);
                $table->timestamps();
                $table->json('attachments')->nullable();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('purchase_order_items')) {
            Schema::create('purchase_order_items', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('purchase_order_id');
                $table->unsignedBigInteger('product_id')->nullable();
                $table->text('description');
                $table->string('notes')->nullable();
                $table->decimal('qty', 10, 2);
                $table->string('unit', 50)->nullable();
                $table->decimal('unit_price', 15, 2)->default(0);
                $table->decimal('discount', 15, 2)->default(0);
                $table->decimal('vat_rate', 5, 2)->default(12);
                $table->decimal('vat_amount', 15, 2)->default(0);
                $table->decimal('vat_inclusive', 15, 2)->default(0);
                $table->decimal('withholding_tax', 15, 2)->default(0);
                $table->decimal('net_payable', 15, 2)->default(0);
                $table->timestamps();
                $table->string('status')->default('active');
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        // Intentionally left empty: these tables hold live PR/PO data
    }
};
