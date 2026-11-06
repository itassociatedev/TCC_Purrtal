<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('task_module_records', function (Blueprint $table) {
            $table->id();
            $table->string('client_key')->unique();
            $table->unsignedBigInteger('creator_id')->index();
            $table->unsignedBigInteger('assignee_id')->nullable()->index();
            $table->unsignedBigInteger('reviewer_id')->nullable()->index();
            $table->string('department')->index();
            $table->string('branch')->index();
            $table->json('payload');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('task_module_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_record_id')->index();
            $table->unsignedBigInteger('actor_id');
            $table->unsignedInteger('version');
            $table->string('event');
            $table->json('recipient_ids');
            $table->timestamps();
            $table->unique(['task_record_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_module_events');
        Schema::dropIfExists('task_module_records');
    }
};
