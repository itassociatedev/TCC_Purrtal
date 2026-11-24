<?php

use App\Models\TaskModuleRecord;
use App\Support\TaskScoreCalculator;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('task_scoring_states')) return;
        // Recompute only recorded evidence. Never fabricate legacy submissions or restore deleted awards.
        TaskModuleRecord::whereIn('id',DB::table('task_scoring_states')->select('task_record_id'))->orderBy('id')->chunkById(100,function($records) {
            foreach ($records as $record) DB::transaction(function() use($record) {
                // Match the writer's lock order: task first, then scoring state.
                $record=TaskModuleRecord::whereKey($record->id)->lockForUpdate()->first();
                if (!$record) return;
                $state=DB::table('task_scoring_states')->where('task_record_id',$record->id)->lockForUpdate()->first();
                if (!$state) return;
                $before=json_decode($state->result,true);
                if (($before['allocation_rule'] ?? '')==='equal_handover_pool_v2') return;
                $policy=json_decode(DB::table('task_scoring_policies')->where('id',$state->policy_id)->value('policy'),true);
                $children=TaskModuleRecord::where('payload->parentId',$record->payload['id'] ?? null)->exists();
                $after=TaskScoreCalculator::calculate($record->payload,json_decode($state->evidence,true),$policy,$children);
                DB::table('task_scoring_states')->where('task_record_id',$record->id)->update(['result'=>json_encode($after),'updated_at'=>now()]);
                DB::table('task_scoring_audits')->insert(['task_record_id'=>$record->id,'policy_id'=>$state->policy_id,'actor_id'=>null,'event'=>'ownership_pool_recalculation','details'=>json_encode(['rule'=>'equal_handover_pool_v2','before'=>$before,'after'=>$after]),'created_at'=>now(),'updated_at'=>now()]);
            });
        });
    }
    public function down(): void {
        // Allocation changes remain in the audit trail; rollback does not fabricate or erase awards.
    }
};
