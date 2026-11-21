<?php
namespace App\Services;
use App\Models\{TaskModuleRecord, User};
use App\Support\TaskScoreCalculator;
use Illuminate\Support\Facades\{DB, Schema};
use Illuminate\Validation\ValidationException;

// Current awards are replaceable snapshots; the append-only audit retains every change.
// Call observe inside the caller's existing task transaction and row lock.
class TaskScoring
{
    public static function canView(User $user): bool {
        $access=app(TaskModuleAccess::class);
        return $access->active($user) && $access->role($user)!=='Employee' && !preg_match('/intern/i',$access->position($user));
    }
    public function suspend(TaskModuleRecord $record, User $actor): void {
        if (!self::ready()) return;
        $state=DB::table('task_scoring_states')->where('task_record_id',$record->id)->lockForUpdate()->first();
        if (!$state) return;
        $before=json_decode($state->result,true); $after=[...$before,'eligible'=>false,'reason'=>'deleted','earned_units'=>0,'allocations'=>[]];
        DB::table('task_scoring_states')->where('task_record_id',$record->id)->update(['result'=>json_encode($after),'updated_at'=>now()]);
        DB::table('task_scoring_audits')->insert(['task_record_id'=>$record->id,'policy_id'=>$state->policy_id,'actor_id'=>$actor->id,'event'=>'deletion_reversal','details'=>json_encode(['before'=>$before,'after'=>$after]),'created_at'=>now(),'updated_at'=>now()]);
    }
    public static function ready(): bool { return Schema::hasTable('task_scoring_states'); }
    public static function policy(): object { return DB::table('task_scoring_policies')->orderByDesc('id')->first(); }
    private function person(?int $id, array $task): array {
        $u=$id ? User::find($id) : null;
        return ['id'=>$id,'name'=>$u?->name ?? $task['assignee'] ?? '', 'department'=>$task['department'] ?? '', 'branch'=>$task['branch'] ?? ''];
    }
    public static function snapshot(TaskModuleRecord $record): array {
        if (!self::ready()) return ['eligible'=>false,'reason'=>'incomplete_records','earned_units'=>0,'allocations'=>[]];
        $state=DB::table('task_scoring_states')->where('task_record_id',$record->id)->first();
        return $state ? [...json_decode($state->result,true),'policy_version'=>$state->policy_id] : ['eligible'=>false,'reason'=>'incomplete_records','earned_units'=>0,'allocations'=>[]];
    }
    public function observe(TaskModuleRecord $record, User $actor, ?array $previous, bool $submission, bool $created=false, ?array $handover=null, ?int $overridePolicy=null): void {
        if (!self::ready()) return;
        $state=DB::table('task_scoring_states')->where('task_record_id',$record->id)->lockForUpdate()->first();
        // Repeated saves/approvals must never add another award. Explicit recalculation bypasses this guard.
        if ($state && (int)$state->record_version === (int)$record->version && !$overridePolicy) return;
        $policyId=$overridePolicy ?? $state?->policy_id ?? self::policy()->id;
        $policy=json_decode(DB::table('task_scoring_policies')->where('id',$policyId)->value('policy'),true);
        $task=$record->payload;
        // Only freshly recorded tasks have a complete evidence trail; never fabricate legacy history.
        $e=$state ? json_decode($state->evidence,true) : ['complete'=>$created,'owner'=>$this->person($record->assignee_id,$task),'submissions'=>[],'returns'=>[],'transfers'=>[],'flags'=>[]];
        $events=[];
        if ($previous && ($previous['priority'] ?? '') !== ($task['priority'] ?? '')) {
            if (!empty($e['completion_priority']) || ($previous['status'] ?? '') === 'Completed') throw ValidationException::withMessages(['priority'=>'Priority is frozen after the first completion, including reopened work.']);
            $events[]=['type'=>'priority_changed','from'=>$previous['priority'] ?? null,'to'=>$task['priority'] ?? null];
        }
        if ($submission) { $event=['at'=>now()->toIso8601String(),'actor_id'=>$actor->id,'version'=>$record->version]; $e['submissions'][]=$event; $events[]=['type'=>'submission',...$event]; }
        // A coordinator may also return an already approved child while its parent is open.
        if (in_array($previous['status'] ?? '', ['Pending Review','Completed'], true) && ($task['status'] ?? '') === 'Revision Needed') {
            $event=['at'=>now()->toIso8601String(),'actor_id'=>$actor->id,'version'=>$record->version]; $e['returns'][]=$event; $events[]=['type'=>'formal_return',...$event];
        }
        if ($handover) {
            $from=$handover['from']; $to=$this->person($record->assignee_id,$task);
            if (!$state) $e['owner']=$from;
            $shares=TaskScoreCalculator::allocations($e['owner'],$e['transfers'],$policy['handover_percent']);
            if (count($e['transfers']) || in_array($to['id'],array_column($shares,'id'),true)) $e['flags'][]='Repeated or returning-owner handover requires review.';
            $transfer=['from'=>$from,'to'=>$to,'at'=>now()->toIso8601String(),'percent'=>$policy['handover_percent']];
            $e['transfers'][]=$transfer;
            $transfer['reserved_allocations']=TaskScoreCalculator::allocations($e['owner'],$e['transfers'],$policy['handover_percent']);
            $events[]=['type'=>'accepted_handover',...$transfer];
        }
        if (($task['status'] ?? '') === 'Completed' && ($previous['status'] ?? '') !== 'Completed') {
            $e['completion_priority'] ??= $task['priority']; $e['approved_at']=now()->toIso8601String();
            $events[]=['type'=>'approved_completion','actor_id'=>$actor->id,'at'=>$e['approved_at']];
        }
        $children=TaskModuleRecord::where('payload->parentId',$task['id'] ?? null)->exists();
        $result=TaskScoreCalculator::calculate($task,$e,$policy,$children);
        $before=$state ? json_decode($state->result,true) : null;
        if ($overridePolicy || $before != $result) $events[]=['type'=>$overridePolicy?'recalculation':(($before['earned_units'] ?? 0)>0 && !$result['earned_units']?'reversal':'score_evaluated'),'before'=>$before,'after'=>$result];
        DB::table('task_scoring_states')->updateOrInsert(['task_record_id'=>$record->id],['policy_id'=>$policyId,'record_version'=>$record->version,'evidence'=>json_encode($e),'result'=>json_encode($result),'created_at'=>$state?->created_at ?? now(),'updated_at'=>now()]);
        foreach ($events as $event) DB::table('task_scoring_audits')->insert(['task_record_id'=>$record->id,'policy_id'=>$policyId,'actor_id'=>$actor->id,'event'=>$event['type'],'details'=>json_encode($event),'created_at'=>now(),'updated_at'=>now()]);
    }
}
