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
        Schema::create('assets', function (Blueprint $table) {
            $table->id();

            // 1. Basic Info
            $table->string('name'); // Item Description Name
            $table->string('asset_tag')->unique(); // e.g., GH-00001
            $table->string('category')->nullable(); // e.g., Office Equipment
            $table->string('classification')->nullable(); // NONCURRENT or SUPPLIES
            
            // 2. Location & Assignment
            $table->string('department')->nullable(); 
            $table->string('assigned_personnel')->nullable(); 
            $table->string('area')->nullable(); 
            
            // 3. Purchase Info (Links to PR/PO Suppliers!)
            $table->date('purchase_date')->nullable();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('supplier_name')->nullable(); // Fallback if no supplier is selected
            $table->date('warranty_expiration')->nullable();
            
            // 4. Value & Condition
            $table->string('condition')->default('Good'); 
            $table->decimal('unit_value', 12, 2)->default(0);
            $table->integer('qty')->default(1);
            $table->decimal('total_value', 12, 2)->default(0);
            $table->string('asset_status')->default('New'); 
            
            // 5. Item Details
            $table->string('model_no')->nullable();
            $table->string('serial_no')->nullable();
            $table->string('color')->nullable();
            
            // 6. Documents & Links
            $table->string('photo_path')->nullable(); 
            $table->string('accountability_form')->nullable();
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
