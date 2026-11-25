<?php
namespace App\Http\Controllers;
use App\Models\TaskModuleRecord;
use App\Services\{TaskScoring, TaskModuleAccess, LoggerService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaskScoringController extends Controller
{
    private function authorizeAdmin(Request $r): void {
        abort_unless(strtolower(trim($r->user()->role?->name ?? ''))==='admin' && app(TaskModuleAccess::class)->active($r->user()),403);
        abort_unless(TaskScoring::ready(),503,'Run the Task scoring migration first.');
    }
    public function show(Request $r) {
        $this->authorizeAdmin($r); $policy=TaskScoring::policy();
        // An older saved version can be upgraded explicitly without rewriting its historical policy.
        $settings=json_decode($policy->policy,true);
        return response()->json(['version'=>$policy->id,'settings'=>($settings['model'] ?? '')==='points_10'?$settings:config('task-scoring')]);
    }
    public function update(Request $r) {
        $this->authorizeAdmin($r);
        $d=$r->validate([
            'version'=>'required|integer|min:1','weights'=>'required|array','weights.time'=>'required|numeric','weights.priority'=>'required|numeric','weights.returns'=>'required|numeric',
            'lateness'=>'required|array|min:1|max:12','lateness.*.max_hours'=>'present|nullable|numeric|gt:0|max:87600','lateness.*.score'=>'required|numeric|min:0|max:2',
            'return_brackets'=>'required|array|min:2|max:12','return_brackets.*.max_returns'=>'present|nullable|integer|min:0|max:10000','return_brackets.*.score'=>'required|numeric|min:0|max:1',
            'application'=>'required|in:new,recalculate',
        ]);
        if (array_sum($d['weights'])!=10 || $d['weights']!=config('task-scoring.weights')) throw ValidationException::withMessages(['weights'=>'Fixed maxima must be Time 2, Priority 7, Returns 1: 10 points total.']);
        foreach (['lateness'=>['max_hours',2],'return_brackets'=>['max_returns',1]] as $key=>[$bound,$maximum]) {
            $previous=$key==='lateness'?0:-1;$score=$maximum;$last=count($d[$key])-1;
            foreach($d[$key] as $i=>$bracket) {
                if(($i===$last && $bracket[$bound]!==null) || ($i<$last && ($bracket[$bound]===null || $bracket[$bound]<=$previous)) || $bracket['score']>$score) throw ValidationException::withMessages([$key=>'Use increasing bounds, non-increasing scores, and an unbounded final bracket.']);
                $previous=$bracket[$bound] ?? $previous;$score=$bracket['score'];
            }
        }
        if($d['return_brackets'][0]['max_returns']!=0 || $d['return_brackets'][0]['score']!=1) throw ValidationException::withMessages(['return_brackets'=>'Zero formal returns must earn the full 1 point.']);
        return DB::transaction(function () use($d,$r) {
            $old=DB::table('task_scoring_policies')->orderByDesc('id')->lockForUpdate()->first();
            abort_if((int)$old->id!==(int)$d['version'],409,'Scoring settings changed. Reload before saving.');
            $policy=[...config('task-scoring'),...array_intersect_key($d,array_flip(['weights','lateness','return_brackets']))];
            $id=DB::table('task_scoring_policies')->insertGetId(['policy'=>json_encode($policy),'actor_id'=>$r->user()->id,'application'=>$d['application'],'created_at'=>now(),'updated_at'=>now()]);
            $count=0;
            if ($d['application']==='recalculate') {
                foreach(TaskModuleRecord::where('payload->status','Completed')->orderBy('id')->lockForUpdate()->get() as $record) {
                    app(TaskScoring::class)->observe($record,$r->user(),$record->payload,false,false,null,$id); $count++;
                }
            }
            DB::table('task_scoring_audits')->insert(['task_record_id'=>null,'policy_id'=>$id,'actor_id'=>$r->user()->id,'event'=>'settings_changed','details'=>json_encode(['previous_version'=>$old->id,'policy'=>$policy,'application'=>$d['application'],'recalculated'=>$count]),'created_at'=>now(),'updated_at'=>now()]);
            LoggerService::log('Task Module','Scoring settings','Scoring policy '.$id.' saved; '.$d['application'].'; '.$count.' completed records recalculated.',userId:$r->user()->id);
            return response()->json(['version'=>$id,'settings'=>$policy,'recalculated'=>$count]);
        });
    }
}
