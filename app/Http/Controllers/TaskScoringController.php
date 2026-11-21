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
        return response()->json(['version'=>$policy->id,'settings'=>json_decode($policy->policy,true)]);
    }
    public function update(Request $r) {
        $this->authorizeAdmin($r);
        $d=$r->validate(['version'=>'required|integer|min:1','weights'=>'required|array','weights.time'=>'required|numeric','weights.priority'=>'required|numeric','weights.returns'=>'required|numeric','weights.ownership'=>'required|numeric',
            'lateness'=>'required|array|min:1|max:12','lateness.*.max_hours'=>'present|nullable|numeric|gt:0|max:87600','lateness.*.score'=>'required|numeric|min:0|max:30',
            'return_deduction'=>'required|numeric|min:0|max:20','handover_percent'=>'required|numeric|min:0|max:100','application'=>'required|in:new,recalculate']);
        if (array_sum($d['weights'])!=100 || $d['weights']!=config('task-scoring.weights')) throw ValidationException::withMessages(['weights'=>'The fixed weights must be 30 / 30 / 20 / 20 and total 100%.']);
        $previous=0; $score=30; $last=count($d['lateness'])-1;
        foreach ($d['lateness'] as $i=>$b) {
            if (($i===$last && $b['max_hours']!==null) || ($i<$last && ($b['max_hours']===null || $b['max_hours']<=$previous)) || $b['score']>$score) throw ValidationException::withMessages(['lateness'=>'Use increasing hour bounds, non-increasing scores, and an unbounded final bracket.']);
            $previous=$b['max_hours'] ?? $previous; $score=$b['score'];
        }
        return DB::transaction(function () use($d,$r) {
            $old=DB::table('task_scoring_policies')->orderByDesc('id')->lockForUpdate()->first();
            abort_if((int)$old->id!==(int)$d['version'],409,'Scoring settings changed. Reload before saving.');
            $policy=array_intersect_key($d,array_flip(['weights','lateness','return_deduction','handover_percent']));
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
