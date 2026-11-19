<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('task_module_settings', function(Blueprint $table) { $table->string('key')->primary(); $table->json('value'); $table->unsignedInteger('version')->default(1); $table->timestamps(); });
        Schema::create('task_id_sequences', function(Blueprint $table) { $table->string('scope')->primary(); $table->unsignedBigInteger('last_number')->default(0); $table->timestamps(); });
    }
    public function down(): void { Schema::dropIfExists('task_id_sequences'); Schema::dropIfExists('task_module_settings'); }
};
