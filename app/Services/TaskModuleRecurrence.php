<?php

namespace App\Services;

use App\Models\TaskModuleRecord;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TaskModuleRecurrence
{
    public function generate(): void
    {
        if (!config('task_module.server_enabled') || !Schema::hasTable('task_module_records')) return;
        $records=TaskModuleRecord::where('payload->template','standard')->whereNull('payload->parentId')->whereNotNull('payload->frequency')->get();
        $groups=$records->groupBy(fn($record)=>$record->payload['repeatSeriesId'] ?? $record->payload['id']);
        $today=CarbonImmutable::now('Asia/Manila')->startOfDay();
        $nextId=max((int) floor(microtime(true)*1000),(int) $records->max(fn($record)=>$record->payload['id'] ?? 0));
        foreach ($groups as $series=>$members) {
            DB::transaction(function() use ($series,$members,$today,&$nextId) {
                $root=TaskModuleRecord::withTrashed()->where('client_key','task:'.$series)->lockForUpdate()->first();
                if (!$root || $root->trashed()) return;
                $source=$members->sort(function($a,$b){$pa=$a->payload;$pb=$b->payload;return strcmp($pb['frequencyChangedAt'] ?? '',$pa['frequencyChangedAt'] ?? '') ?: strcmp($pb['startDate'] ?? $pb['due'],$pa['startDate'] ?? $pa['due']);})->first();
                $data=$source->payload;$frequency=$data['frequency'] ?? 'once';
                if (!in_array($frequency,['daily','weekly','monthly']) || in_array($data['status'],['Denied','Dismissed','Pending Approval'])) return;
                $access=app(TaskModuleAccess::class);$person=User::find($data['recurrenceOwner']['id'] ?? $source->assignee_id);
                if (!$person || !$access->active($person)) return;
                $anchor=CarbonImmutable::parse($data['repeatAnchorStart'] ?? $data['startDate'] ?? $data['due'],'Asia/Manila')->startOfDay();
                $deadline=CarbonImmutable::parse($data['repeatAnchorDue'] ?? $data['due'],'Asia/Manila')->startOfDay();
                $cutoff=isset($data['frequencyChangedAt'])?CarbonImmutable::parse($data['frequencyChangedAt'])->setTimezone('Asia/Manila')->startOfDay():$anchor;
                $offset=$frequency==='monthly'?max(1,($cutoff->year-$anchor->year)*12+$cutoff->month-$anchor->month):max(1,(int) floor($anchor->diffInDays($cutoff,false)/($frequency==='weekly'?7:1)));
                $known=$members->map(fn($record)=>$record->payload['occurrenceStart'] ?? $record->payload['startDate'] ?? $record->payload['due'])->all();
                for($made=0;$made<100;$offset++) {
                    $start=$frequency==='monthly'?$anchor->addMonthsNoOverflow($offset):$anchor->addDays($offset*($frequency==='weekly'?7:1));
                    if ($start->greaterThan($today)) break;
                    $date=$start->toDateString();if($start->lessThan($cutoff)||in_array($date,$known))continue;
                    $key='repeat:'.$series.':'.$date;
                    if(TaskModuleRecord::withTrashed()->where('client_key',$key)->exists())continue;
                    $due=$frequency==='monthly'?$deadline->addMonthsNoOverflow($offset):$deadline->addDays($offset*($frequency==='weekly'?7:1));
                    if($frequency==='monthly'&&$deadline->isSameDay($anchor->addMonthNoOverflow()->subDay()))$due=$anchor->addMonthsNoOverflow($offset+1)->subDay();
                    $copy=$data;
                    $repeatOwner=User::find($data['recurrenceOwner']['id'] ?? $source->assignee_id);
                    $copy['department']=$data['recurrenceOwner']['department'] ?? $data['department'];
                    if(!$repeatOwner || !$access->active($repeatOwner))continue;
                    $copy['assignee']=$repeatOwner->name;$copy['assigneeRole']=$access->role($repeatOwner);
                    foreach(['handover','handoverWork','recurrenceOwner','procedureReference','_serverKey','_serverVersion','startedAt','submittedAt','submittedBy','completedAt','elapsedSeconds','approvalGrantedAt','approvalGrantedBy','previousSubmission','correcting'] as $field)unset($copy[$field]);
                    $request=in_array($data['kind'] ?? '',['Self-created request','Turnover request']);
                    $creator=User::find($root->creator_id);if(!$creator)return;
                    $reviewer=$request?$access->reviewer($creator,$copy):User::find($source->reviewer_id);
                    if($request&&!$reviewer)return;
                    $copy=[...$copy,'id'=>++$nextId,'repeatSeriesId'=>(int)$series,'repeatAnchorStart'=>$anchor->toDateString(),'repeatAnchorDue'=>$deadline->toDateString(),'occurrenceStart'=>$date,'startDate'=>$date,'due'=>$due->toDateString(),'status'=>$request?'Pending Approval':'Not Started','submission'=>'','remarks'=>'','pings'=>[],'history'=>[['text'=>'Recurring task created.','at'=>now()->toIso8601String()]]];
                    if($request)$copy=[...$copy,'approvalRequired'=>true,'approvalReviewer'=>$reviewer->name,'approvalReviewerRole'=>$access->role($reviewer)];
                    $record=TaskModuleRecord::create(['client_key'=>$key,'creator_id'=>$root->creator_id,'assignee_id'=>$repeatOwner->id,'reviewer_id'=>$reviewer?->id,'department'=>$copy['department'],'branch'=>$copy['branch'],'payload'=>$copy,'version'=>1]);
                    DB::table('task_module_events')->insert(['task_record_id'=>$record->id,'actor_id'=>$root->creator_id,'version'=>1,'event'=>'Recurring task created','recipient_ids'=>json_encode(array_values(array_unique(array_filter([$source->assignee_id,$root->creator_id,$request?$reviewer?->id:null])))),'created_at'=>now(),'updated_at'=>now()]);
                    $known[]=$date;$made++;
                }
            });
        }
    }
}
