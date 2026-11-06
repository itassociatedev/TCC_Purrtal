<?php
namespace App\Services;

use App\Models\TaskModuleRecord;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class TaskModuleTurnover
{
    public function act(User $actor, array $input, TaskModuleAccess $access): array
    {
        return DB::transaction(function () use ($actor,$input,$access) {
            abort_unless($access->active($actor),403);
            $record=TaskModuleRecord::where('client_key',$input['key'])->lockForUpdate()->firstOrFail();
            abort_unless($access->visible($actor)->whereKey($record->id)->exists(),403);
            abort_if($record->version!==$input['version'],409,'This task changed. Refresh it before continuing.');
            $task=$record->payload;$pending=$task['handover'] ?? null;$action=$input['action'];
            abort_unless(($task['template'] ?? '')==='standard' && in_array($task['status'],['Not Started','In Progress','Revision Needed']),422,'Only open standard tasks can be handed over. Finish approval or review first.');
            abort_if(TaskModuleRecord::where('payload->parentId',$task['id'])->exists(),422,'This person coordinates other assignments. Hand over the individual work tasks instead.');
            $manager=$record->creator_id===$actor->id || $record->reviewer_id===$actor->id || $access->role($actor)==='Admin';
            if($action==='request') {
                abort_unless($record->assignee_id===$actor->id || $manager,403);
                abort_if(($pending['status'] ?? '')==='pending',422,'Cancel the current handover before choosing another person.');
                $recipient=User::where('name',$input['recipient'] ?? '')->first();
                abort_unless($recipient && $access->active($recipient) && $recipient->id!==$record->assignee_id && $recipient->id!==$record->reviewer_id && in_array($record->branch,$access->branches($recipient)),422,'Choose another active person available in this branch, other than the reviewer.');
                $task['handover']=['status'=>'pending','from'=>$task['assignee'],'to'=>$recipient->name,'recipientId'=>$recipient->id,'requestedBy'=>$actor->name,'requestedAt'=>now()->toIso8601String(),'notes'=>trim($input['notes'] ?? '')];
                abort_unless($task['handover']['notes']!=='',422,'Describe what is finished and what still needs doing.');
                $text=$actor->name.' offered this task to '.$recipient->name.'. The current owner remains responsible until acceptance. Notes: '.$task['handover']['notes'];
            } else {
                abort_unless(($pending['status'] ?? '')==='pending',422,'There is no pending handover.');
                if($action==='cancel')abort_unless($record->assignee_id===$actor->id || $manager || $pending['requestedBy']===$actor->name,403);
                else abort_unless((int)$pending['recipientId']===$actor->id,403,'Only the receiving employee can accept or decline.');
                if($action==='accept') {
                    abort_unless(in_array($record->branch,$access->branches($actor)) && $record->reviewer_id!==$actor->id,422,'Your assignment eligibility changed. Ask the owner to cancel this handover.');
                    $task['handoverWork'][]=['assignee'=>$task['assignee'],'startedAt'=>$task['startedAt'] ?? null,'submission'=>$task['submission'] ?? '', 'handedOverAt'=>now()->toIso8601String()];
                    $task['recurrenceOwner'] ??= ['id'=>$record->assignee_id,'name'=>$task['assignee'],'role'=>$task['assigneeRole'] ?? 'Employee','department'=>$record->department];
                    $task['department']=$access->department($actor);$record->department=$task['department'];
                    $task['assignee']=$actor->name;$task['assigneeRole']=$access->role($actor);$task['status']='Not Started';
                    foreach(['startedAt','elapsedSeconds','submittedAt','submittedBy','completedAt'] as $field)unset($task[$field]);
                    $task['submission']='';$record->assignee_id=$actor->id;
                }
                $task['handover']['status']=match($action){'accept'=>'accepted','decline'=>'declined',default=>'cancelled'};
                $task['handover']['resolvedAt']=now()->toIso8601String();
                $text=$actor->name.' '.$task['handover']['status'].' the handover from '.$pending['from'].' to '.$pending['to'].'.';
            }
            $task['history']=[['text'=>$text,'at'=>now()->toIso8601String()],...($task['history'] ?? [])];
            $record->payload=$task;$record->version++;$record->save();
            DB::table('task_module_events')->insert(['task_record_id'=>$record->id,'actor_id'=>$actor->id,'version'=>$record->version,'event'=>$text,'recipient_ids'=>json_encode(array_values(array_unique(array_filter([$record->assignee_id,$record->creator_id,$record->reviewer_id,$task['handover']['recipientId']])))),'created_at'=>now(),'updated_at'=>now()]);
            return $record->document();
        });
    }
}
