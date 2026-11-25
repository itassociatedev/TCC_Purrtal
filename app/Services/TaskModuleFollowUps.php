<?php

namespace App\Services;

use App\Models\User;

class TaskModuleFollowUps
{
    public function validate(User $actor,array $task,array $previous,TaskModuleAccess $access): array
    {
        $old=$previous['pings'] ?? [];
        $next=$task['pings'] ?? [];
        abort_unless(is_array($next) && array_is_list($next),422,'Invalid follow-up list.');
        if (count($next)===count($old)+1) {
            $role=$access->role($actor);
            $canSend=$role==='EVP' || $role==='Team Leader' && in_array($access->department($actor),[$task['department'],$task['originDepartment'] ?? null]) || $role==='Operations Manager' && in_array($actor->branch?->name,[$task['branch'],$task['originBranch'] ?? null]);
            abort_unless($canSend && !in_array($task['status'],['Completed','Denied','Dismissed']) && array_slice($next,0,-1)===$old,403,'This follow-up is not allowed.');
            $new=end($next);
            abort_unless(is_array($new) && is_string($new['id'] ?? null) && strlen($new['id'])<=100 && !collect($old)->contains('id',$new['id']) && is_string($new['message'] ?? null) && trim($new['message']) && mb_strlen($new['message'])<=500,422,'Enter a follow-up of up to 500 characters.');
            return [...$old,['id'=>$new['id'],'message'=>trim($new['message']),'assignee'=>$task['assignee'],'sender'=>$actor->name,'senderRole'=>$role,'createdAt'=>now()->toIso8601String(),'acknowledgedAt'=>null]];
        }
        abort_unless(count($next)===count($old),403,'Existing follow-ups cannot be removed.');
        $changed=0;
        foreach($old as $index=>$ping){
            if($ping===$next[$index])continue;
            $updated=$next[$index];
            abort_unless(is_array($updated) && $task['assignee']===$actor->name && ($ping['assignee'] ?? '')===$actor->name && empty($ping['acknowledgedAt']),403,'Only the assignee can acknowledge this follow-up.');
            $candidate=$updated;
            unset($candidate['acknowledgedAt'],$candidate['acknowledgedBy']);
            $original=$ping;
            unset($original['acknowledgedAt'],$original['acknowledgedBy']);
            abort_unless($candidate===$original && !empty($updated['acknowledgedAt']),403,'Follow-up messages cannot be changed.');
            $next[$index]=[...$ping,'acknowledgedAt'=>now()->toIso8601String(),'acknowledgedBy'=>$actor->name];
            $changed++;
        }
        abort_unless($changed===1,403,'Acknowledge one follow-up at a time.');
        return $next;
    }
}
