<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('asset_import_batches')) {
            return;
        }

        Schema::create('asset_import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('original_filename');
            $table->string('stored_path');
            $table->string('file_hash', 64)->index();
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->string('status', 20)->default('completed');
            $table->timestamp('reversed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('asset_import_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_import_batch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('created_by_batch')->default(false);
            $table->json('before_values')->nullable();
            $table->string('after_hash', 64);
            $table->timestamps();
            $table->index(['asset_import_batch_id', 'asset_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_import_items');
        Schema::dropIfExists('asset_import_batches');
    }
};
