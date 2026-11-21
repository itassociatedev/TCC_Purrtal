<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};
return new class extends Migration {
    public function up(): void {
        Schema::create('task_scoring_policies', function (Blueprint $t) {
            $t->id(); $t->json('policy'); $t->unsignedBigInteger('actor_id')->nullable(); $t->string('application'); $t->timestamps();
        });
        Schema::create('task_scoring_states', function (Blueprint $t) {
            $t->unsignedBigInteger('task_record_id')->primary(); $t->unsignedBigInteger('policy_id');
            $t->unsignedInteger('record_version')->default(0); $t->json('evidence'); $t->json('result'); $t->timestamps();
        });
        Schema::create('task_scoring_audits', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('task_record_id')->nullable()->index(); $t->unsignedBigInteger('policy_id');
            $t->unsignedBigInteger('actor_id')->nullable(); $t->string('event'); $t->json('details'); $t->timestamps();
        });
        // No HR roles/positions or existing task evidence are fabricated by this migration.
        DB::table('task_scoring_policies')->insert(['policy'=>json_encode(config('task-scoring')), 'application'=>'initial', 'created_at'=>now(), 'updated_at'=>now()]);
    }
    public function down(): void {
        Schema::dropIfExists('task_scoring_audits'); Schema::dropIfExists('task_scoring_states'); Schema::dropIfExists('task_scoring_policies');
    }
};
