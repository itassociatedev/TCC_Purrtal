<?php

namespace App\Services;

use App\Models\TaskModuleRecord;
use App\Models\User;
use App\Notifications\TaskModuleEmail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class TaskModuleWriter
{
    public function __construct(private TaskModuleAccess $access) {}

    public function key(array $task): string
    {
        if(!empty($task['repeatSeriesId'])&&!empty($task['occurrenceStart']))return 'repeat:'.$task['repeatSeriesId'].':'.$task['occurrenceStart'];
        if (($task['template'] ?? '')==='narrative-report' && in_array($task['recurrence'] ?? '',['weekly','monthly'])) return 'narrative:'.hash('sha256',implode('|',[$task['recurrence'],$task['assignee'],$task['periodStart'] ?? $task['due']]));
        if (!empty($task['recurrence']) && $task['recurrence'] === 'daily') {
            return 'daily:'.hash('sha256', implode('|', [$task['template'], !empty($task['sharedBranchReport']) ? $task['branch'] : $task['assignee'], $task['scheduledDate'] ?? $task['due']]));
        }
        if (($task['template'] ?? '') === 'intern-weekly-report') return 'weekly:'.hash('sha256', ($task['assignee'] ?? '').'|'.($task['weekStart'] ?? $task['due']));
        return 'task:'.$task['id'];
    }

    public function saveMany(User $actor, array $documents): array
    {
        abort_unless($this->access->active($actor), 403);
        return DB::transaction(function () use ($actor, $documents) {
            $created=[];$saved=[];
            foreach($documents as $task)$saved[]=$this->save($actor,$task,$created);
            return $saved;
        });
    }

    private function save(User $actor, array $task,array &$createdInBatch): array
    {
        abort_if(!empty($task['sample']) || !empty($task['sampleKey']) || str_starts_with($task['title'], '[Sample]'), 422, 'Sample tasks stay in the browser and never send emails.');
        $key = $this->key($task);
        $record = TaskModuleRecord::withTrashed()->where('client_key', $key)->lockForUpdate()->first();
        abort_if($record?->trashed(), 409, 'This task was deleted. Refresh the workspace.');
        if ($record) {
            abort_unless($this->access->visible($actor)->whereKey($record->id)->exists(), 403);
            abort_if(($task['_serverVersion'] ?? null) !== $record->version, 409, 'This task changed in another session. Refresh before saving.');
        }
        $previous = $record?->payload;
        // Report authors may select an allowed work branch; task ownership still requires handover.
        $reportBranchEditable=in_array($task['template'],['narrative-report','daily-operations']) || str_starts_with($task['template'],'daily-custom-');
        if($previous)abort_if($task['assignee']!==$previous['assignee'] || $task['department']!==$previous['department'] || !$reportBranchEditable && $task['branch']!==$previous['branch'],422,'Use Hand over task to transfer responsibility.');
        if ($previous) {
            foreach (['repeatSeriesId','occurrenceStart','template','parentId','recurrence','scheduledDate','weekStart','periodStart','periodEnd','sharedBranchReport','kind','approvalRequired','approvalReviewer','approvalReviewerRole','requestedBy'] as $field) {
                abort_if(($task[$field] ?? null) !== ($previous[$field] ?? null),422,'Task identity and approval routing cannot be changed after creation.');
            }
            // Client timestamps and audit fields are display data, never trusted write inputs.
            foreach (['handover','handoverWork','recurrenceOwner','procedureReference','startedAt','elapsedSeconds','submittedAt','submittedBy','completedAt','approvalGrantedAt','approvalGrantedBy','dismissedAt','dismissedBy','history'] as $field) {
                if (array_key_exists($field,$previous)) $task[$field]=$previous[$field];
                else unset($task[$field]);
            }
        } else {
            foreach (['startedAt','elapsedSeconds','submittedAt','submittedBy','completedAt','approvalGrantedAt','approvalGrantedBy','dismissedAt','dismissedBy','history'] as $field) unset($task[$field]);
        }
        if(isset($previous['frequencyChangedAt']))$task['frequencyChangedAt']=$previous['frequencyChangedAt'];else unset($task['frequencyChangedAt']);
        $frequency=$task['frequency'] ?? 'once';
        if($frequency!=='once')abort_unless($task['template']==='standard'&&empty($task['parentId']),422,'Repeating schedules are available for standalone standard tasks.');
        $scheduleChanged=(!$previous&&$frequency!=='once')||$previous&&($frequency!==($previous['frequency'] ?? 'once')||$frequency!=='once'&&(($task['startDate'] ?? $task['due'])!==($previous['startDate'] ?? $previous['due'])||$task['due']!==$previous['due']));
        if($scheduleChanged){
            abort_if($record&&$record->creator_id!==$actor->id&&$this->access->role($actor)!=='Admin',403,'Only the task creator may change its repeating schedule.');
            $task['frequencyChangedAt']=now()->toIso8601String();
            $task['repeatAnchorStart']=$task['startDate'] ?? $task['due'];$task['repeatAnchorDue']=$task['due'];
        }else foreach(['repeatAnchorStart','repeatAnchorDue'] as $field){if(isset($previous[$field]))$task[$field]=$previous[$field];else unset($task[$field]);}
        if(!$previous){unset($task['handover'],$task['handoverWork'],$task['recurrenceOwner']);}
        if(($previous['handover']['status'] ?? '')==='pending' && ($task['status'] ?? '')!==($previous['status'] ?? '') && in_array($task['status'],['Pending Review','Completed','Denied','Dismissed'])){ $task['handover']['status']='cancelled';$task['handover']['resolvedAt']=now()->toIso8601String(); }
        $version = ($record?->version ?? 0) + 1;
        unset($task['_serverVersion'], $task['_serverKey']);
        abort_if(!empty($task['sharedBranchReport']) && ($task['template'] !== 'it-opening-rounds' || $task['department'] !== 'IT'),422,'Shared Opening Reports belong to IT.');
        $assignee = !empty($task['sharedBranchReport']) && $task['template'] === 'it-opening-rounds' ? null : User::where('name', $task['assignee'])->first();
        abort_if(!$assignee && empty($task['sharedBranchReport']), 422, 'The assignee must be an existing employee account.');
        abort_if($assignee && (!$this->access->active($assignee) || $this->access->department($assignee) !== $task['department'] || !in_array($task['branch'], $this->access->branches($assignee))), 422, 'The assignee is not active in this department and branch.');
        $parent = empty($task['parentId']) ? null : TaskModuleRecord::where('client_key', 'task:'.$task['parentId'])->first();
        abort_if(!empty($task['parentId']) && !$parent, 422, 'Save the parent task first.');
        $role = $this->access->role($actor);
        $daily = in_array($task['template'], ['it-opening-rounds','narrative-report','daily-operations','intern-weekly-report']) || str_starts_with($task['template'], 'daily-custom-');
        $sharedWorker = !empty($task['sharedBranchReport']) && $task['template'] === 'it-opening-rounds' && $this->access->department($actor) === 'IT' && ($role==='Team Leader' || in_array($task['branch'], $this->access->branches($actor)));
        $performer = $assignee?->id === $actor->id || $sharedWorker;
        $directOpeningSubmission=$sharedWorker && $role==='Team Leader' && (!$previous || in_array($previous['status'],['Not Started','In Progress','Revision Needed'])) && in_array($task['status'],['Pending Review','Completed']) && trim($task['submission'] ?? '')!=='';
        if ($directOpeningSubmission) $task['status']='Completed';
        if ($previous) {
            $outputChanged = collect(['submission','rounds','narrative','operations','customReport','weeklyReport'])->contains(fn ($field) => ($task[$field] ?? null) !== ($previous[$field] ?? null));
            abort_if($outputChanged && !$performer,403,'Only the assigned employee may change submitted work.');
        }
        $reviewer = $record?->reviewer_id ? User::find($record->reviewer_id) : $this->access->reviewer($actor, $task, $parent);
        if (!$record) {
            abort_if(!empty($task['repeatSeriesId']),422,'Refresh the workspace to load the scheduled task occurrence.');
            // A leader assigning someone else reviews their output, without OM permission to begin.
            if (!$daily && !$parent && $task['template']!=='collaborative' && $role==='Team Leader' && $assignee?->id!==$actor->id && !in_array($task['kind'] ?? '',['Self-created request','Turnover request'])) {
                $reviewer=$actor;
                $task['status']='Not Started';
                $task['approvalRequired']=false;
                unset($task['approvalReviewer'],$task['approvalReviewerRole']);
            }
            if ($parent) {
                $initialMonitor=isset($createdInBatch[$parent->id]) && $parent->creator_id===$actor->id && $task['template']==='collaborative';
                abort_unless(($parent->assignee_id === $actor->id || $initialMonitor) && in_array($parent->payload['status'],['Not Started','In Progress','Revision Needed']),403,'Only the active parent task coordinator may delegate work.');
            }
            abort_if($role === 'Employee' && str_starts_with($task['template'],'daily-custom-'),422,'A custom daily report must be saved by its manager before employee submissions.');
            $canCreate = in_array($role, ['Admin','EVP','Corporate Services','Operations Manager','Team Leader','Chief Vet']) || $daily && $performer || $parent && $parent->assignee_id === $actor->id;
            abort_unless($canCreate, 403, 'This account cannot create this task.');
            if (!$daily && $task['template'] !== 'collaborative' && $role === 'Team Leader' && $assignee && !in_array($this->access->role($assignee), ['Employee','Team Leader','Corporate Services','Operations Manager']) && $assignee->id !== $actor->id && !$parent) abort(403, 'Team Leaders and Supervisors can assign employees, other leaders, Operations Managers, or Corporate Services members.');
            if ($role === 'Chief Vet') abort_unless($task['branch'] === $actor->branch?->name,403);
            if ($task['template'] === 'collaborative' && !$parent) abort_unless($assignee && in_array($this->access->role($assignee), ['Admin','EVP','Corporate Services','Operations Manager','Team Leader']),422,'Choose an eligible final approver.');
            if (!$daily && !$parent && $task['template'] !== 'collaborative' && ($role === 'Team Leader' && $assignee?->id === $actor->id || in_array($task['kind'] ?? '', ['Self-created request','Turnover request']))) {
                abort_unless($reviewer, 422, 'No higher-up is available to approve this task.');
                $task = [...$task, 'status'=>'Pending Approval','approvalRequired'=>true,'approvalReviewer'=>$reviewer->name,'approvalReviewerRole'=>$this->access->role($reviewer)];
            }
            abort_unless(in_array($task['status'], $daily ? ['Not Started','In Progress','Pending Review','Dismissed',...($directOpeningSubmission?['Completed']:[])] : ['Not Started','Pending Approval']), 422, 'New tasks cannot import approval or completion.');
            $task['requestedBy'] = $actor->name;
        } else {
            $correction = $task['template'] === 'narrative-report' && $record->assignee_id === $actor->id && !empty($task['correcting']) && $task['status'] === 'In Progress' && in_array($previous['status'],['Pending Review','Completed']);
            $changed = array_keys(array_udiff_assoc($task, $previous, fn ($a,$b) => json_encode($a) <=> json_encode($b)));
            $followUpOnly = $changed && !array_diff($changed,['pings']);
            $coordinatorRevision = $parent && $parent->assignee_id===$actor->id && $previous['status']==='Completed' && $task['status']==='Revision Needed' && in_array($parent->payload['status'],['Not Started','In Progress','Revision Needed']);
            $creator = $record->creator_id === $actor->id || $role === 'Admin';
            if (!$creator) {
                $allowed = $record->reviewer_id === $actor->id ? ['status','remarks','history','completedAt','approvalGrantedAt','approvalGrantedBy','pings'] : ['status','submission','rounds','narrative','operations','customReport','weeklyReport','correcting','previousSubmission','history','submittedBy','completedAt','pings'];
                if ($performer && $reportBranchEditable) $allowed[]='branch';
                if ($performer) $allowed=[...$allowed,'handover','submission','rounds','narrative','operations','customReport','weeklyReport','correcting','previousSubmission','submittedBy'];
                if ($task['status'] === 'Dismissed') $allowed = [...$allowed,'dismissedBy','dismissedAt'];
                abort_if(array_diff($changed, $allowed), 403, 'This account cannot change these task details.');
            }
            if ($previous['status'] === 'Pending Approval' && $task['status'] !== 'Pending Approval') abort_unless($record->reviewer_id === $actor->id && in_array($task['status'], ['Not Started','Denied']), 403, 'Higher-up approval is required first.');
            if ($task['status'] !== $previous['status']) {
                if (in_array($task['status'], ['In Progress','Pending Review'])) abort_unless($performer, 403, 'Only the assigned employee may submit this work.');
                if (in_array($task['status'], ['Completed','Denied','Revision Needed'])) {
                    $rootCompletion = $task['template'] === 'collaborative' && empty($task['parentId']) && $record->assignee_id === $actor->id && $task['status'] === 'Completed';
                    abort_unless($directOpeningSubmission || $rootCompletion || $record->reviewer_id === $actor->id && $record->assignee_id !== $actor->id, 403, 'Only the designated reviewer may make this decision.');
                    if ($task['status'] === 'Completed' && !$rootCompletion && !$directOpeningSubmission) abort_unless($previous['status'] === 'Pending Review', 422, 'Submit the work for review first.');
                }
                abort_if(in_array($previous['status'], ['Completed','Denied','Dismissed']) && !$correction && !$coordinatorRevision, 422, 'This task is closed.');
            }
            if (in_array($previous['status'], ['Completed','Denied','Dismissed']) && $task != $previous && !$correction && !$coordinatorRevision && !$followUpOnly) abort(422, 'This server task is closed.');
            if ($previous['status'] === 'Pending Review' && $task['status'] === 'Pending Review' && ($task['submission'] ?? '') !== ($previous['submission'] ?? '')) abort(422, 'Request a revision before editing submitted work.');
            if ($previous['status'] === 'Pending Review' && in_array($task['status'],['Not Started','In Progress']) && !$correction) abort(422, 'Request a revision before reopening this submission.');
            if ($previous['status'] === 'Pending Review' && $record->reviewer_id !== $actor->id && $role !== 'Admin' && $task != $previous && !$correction && !$followUpOnly) abort(403, 'This submission is waiting for review.');
            if ($task == $previous) return $record->document();
        }
        if ($parent) {
            abort_if($task['due'] >= $parent->payload['due'],422,'Child deadlines must be earlier than the parent deadline.');
            foreach ($task['dependsOn'] ?? [] as $id) {
                $prerequisite=TaskModuleRecord::where('client_key','task:'.$id)->first();
                abort_unless($prerequisite && ($prerequisite->payload['parentId'] ?? null) === $task['parentId'] && $id !== $task['id'],422,'Prerequisites must be existing sibling tasks.');
                abort_if($prerequisite->payload['due'] > $task['due'],422,'The deadline cannot be before a prerequisite deadline.');
                if (in_array($task['status'],['In Progress','Pending Review','Completed'])) abort_unless($prerequisite->payload['status']==='Completed',422,'Complete the prerequisite tasks first.');
            }
            if ($previous) abort_if(($task['dependsOn'] ?? []) !== ($previous['dependsOn'] ?? []),422,'Existing prerequisites cannot be changed.');
        }
        if (($task['pings'] ?? []) !== ($previous['pings'] ?? [])) {
            $task['pings']=app(TaskModuleFollowUps::class)->validate($actor,$task,$previous ?? [],$this->access);
        }
        if ($task['status'] === 'Dismissed') {
            abort_unless($role === 'Team Leader' && $this->access->department($actor) === 'IT' && $task['template'] === 'it-opening-rounds' && ($task['scheduledDate'] ?? $task['due']) === now('Asia/Manila')->toDateString() && (!$previous || in_array($previous['status'], ['Not Started','In Progress','Revision Needed'])), 403);
            $task['dismissedBy'] = $actor->name;
        }
        if ($daily && in_array($task['status'], ['In Progress','Pending Review']) && (!$previous || $task['status'] !== $previous['status'])) abort_unless($performer, 403);
        if (in_array($task['status'], ['Pending Review','Completed']) && ($task['template'] === 'collaborative' || $parent)) {
            abort_if(!trim($task['submission'] ?? ''), 422, 'A text or link submission is required.');
            $unfinished = TaskModuleRecord::where('payload->parentId', $task['id'])->where('payload->status','!=','Completed')->exists();
            abort_if($unfinished, 422, 'All child tasks must be approved first.');
            if ($task['template'] === 'collaborative') abort_unless(TaskModuleRecord::where('payload->parentId',$task['id'])->exists(),422,'Assign at least one child task first.');
        }
        $isSubmission = $directOpeningSubmission || ($task['status'] === 'Pending Review' && ($previous['status'] ?? '') !== 'Pending Review')
            || ($task['status'] === 'Completed' && $task['template'] === 'collaborative' && !$parent && ($previous['status'] ?? '') !== 'Completed');
        if ($task['status']==='In Progress' && empty($previous['startedAt'])) {
            abort_unless($performer,403,'Only the assigned employee may start this task.');
            $task['startedAt']=now()->toIso8601String();
        }
        if ($isSubmission) {
            abort_if(empty($previous['startedAt']),422,'Start the task before submitting work.');
            $task['elapsedSeconds']=max(0,now()->timestamp-strtotime($previous['startedAt']));
        }
        if ($directOpeningSubmission) { $task['submittedBy']=$actor->name; $reviewer=null; }
        if ($isSubmission && !$directOpeningSubmission && $sharedWorker && $reviewer?->id===$actor->id) $reviewer=$this->access->reviewer($actor,$task,$parent);
        $task['submittedAt'] = $isSubmission ? now()->toIso8601String() : ($previous['submittedAt'] ?? null);
        if ($task['status'] === 'Completed' && ($previous['status'] ?? '') !== 'Completed') $task['completedAt']=now()->toIso8601String();
        if ($task['status'] === 'Dismissed' && ($previous['status'] ?? '') !== 'Dismissed') $task['dismissedAt']=now()->toIso8601String();
        if ($task['status'] === 'Pending Review') {
            abort_if(!trim($task['submission'] ?? ''), 422, 'Add your submission before requesting review.');
            abort_unless($reviewer, 422, 'No reviewer is configured.');
            $task['submittedBy'] = $isSubmission ? $actor->name : ($previous['submittedBy'] ?? $actor->name);
        }
        if (in_array($task['status'], ['Denied','Revision Needed'])) abort_if(!trim($task['remarks'] ?? ''), 422, 'Add feedback for denial or revision.');
        if (($previous['status'] ?? '') === 'Pending Approval' && $task['status'] === 'Not Started') {
            $task = [...$task,'approvalGrantedBy'=>$actor->name,'approvalGrantedAt'=>now()->toIso8601String()];
            if ($record->creator_id !== $record->assignee_id) $reviewer = User::find($record->creator_id);
        }
        $event = !$previous ? ($task['status'] === 'Pending Review' ? 'Submitted for review' : 'Task created') : match ($task['status']) {
            'Completed'=>'Task approved','Denied'=>'Task denied','Revision Needed'=>'Revision requested','Pending Review'=>'Submitted for review',
            'Not Started'=>($previous['status'] === 'Pending Approval' ? 'Task request approved' : 'Task updated'),
            'Dismissed'=>'Opening Report dismissed', default=>'Task updated',
        };
        $historyText = $directOpeningSubmission ? 'Opening Rounds completed by '.$actor->name.'.' : ($task['status'] === 'Completed' ? $task['title'].': approved.' : $event.' by '.$actor->name.'.');
        $task['history'] = [['text'=>$historyText,'at'=>now()->toIso8601String()], ...($previous['history'] ?? $task['history'] ?? [])];
        $record ??= new TaskModuleRecord(['client_key'=>$key,'creator_id'=>$actor->id]);
        $newRecord=!$record->exists;
        $record->fill(['assignee_id'=>$assignee?->id,'reviewer_id'=>$reviewer?->id,'department'=>$task['department'],'branch'=>$task['branch'],'payload'=>$task,'version'=>$version])->save();
        if($newRecord)$createdInBatch[$record->id]=true;
        if ($previous && $task['status'] === $previous['status'] && ($previous['assignee'] ?? '') === $task['assignee']) {
            LoggerService::log('Task Module', 'Update', 'Updated task: '.$task['title'], userId: $actor->id);
            return $record->document();
        }
        $ids = array_values(array_unique(array_filter([$record->assignee_id,$record->creator_id,in_array($task['status'], ['Pending Approval','Pending Review']) ? $record->reviewer_id : null])));
        DB::table('task_module_events')->insert(['task_record_id'=>$record->id,'actor_id'=>$actor->id,'version'=>$version,'event'=>$event,'recipient_ids'=>json_encode($ids),'created_at'=>now(),'updated_at'=>now()]);
        $mode = config('task_module.email_mode');
        if (in_array($mode,['log','send'])) {
            $recipients = User::whereIn('id',$ids)->get()->filter(fn ($user) => $this->access->active($user) && filter_var($user->email,FILTER_VALIDATE_EMAIL));
            Notification::send($recipients, new TaskModuleEmail($task,$event,$actor->name,$mode));
        }
        return $record->document();
    }
}
