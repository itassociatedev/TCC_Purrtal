<?php

namespace App\Http\Controllers;

use App\Models\TaskModuleRecord;
use App\Services\LoggerService;
use App\Services\TaskModuleAccess;
use App\Services\TaskModuleWriter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TaskModuleController extends Controller
{
    private function available(): void
    {
        abort_unless(config('task_module.server_enabled') && Schema::hasTable('task_module_records'), 503, 'Task server storage has not been enabled.');
    }
    public function index(Request $request, TaskModuleAccess $access)
    {
        $this->available();
        abort_unless($access->active($request->user()), 403);
        if(!$request->filled('cursor'))app(\App\Services\TaskModuleRecurrence::class)->generate();
        $records = $access->visible($request->user())->withTrashed()->orderBy('id')->cursorPaginate(200);
        return response()->json(['records'=>$records->map(fn ($record) => $record->trashed() ? ['_serverKey'=>$record->client_key,'_deleted'=>true] : $record->document()),'next'=>$records->nextCursor()?->encode()]);
    }
    public function leaderboard(Request $request, TaskModuleAccess $access)
    {
        $this->available();
        abort_unless($access->active($request->user()), 403);
        $today = $request->validate(['today' => 'required|date_format:Y-m-d'])['today'];
        $activeAssignees = \App\Models\User::query()->get()->filter(fn ($person) => $access->active($person))->modelKeys();
        $records = TaskModuleRecord::query()->whereIn('assignee_id', $activeAssignees)->get(['id', 'payload']);
        $rows = $records->filter(function ($record) {
            $task = $record->payload;
            return !str_starts_with($task['title'] ?? '', '[Sample]')
                && !in_array($task['template'] ?? '', ['it-opening-rounds', 'narrative-report', 'daily-operations', 'intern-weekly-report'], true)
                && !str_starts_with($task['template'] ?? '', 'daily-custom-')
                && (($task['status'] ?? '') === 'Completed'
                    || in_array($task['status'] ?? '', ['Not Started', 'In Progress', 'Revision Needed'], true)
                        && !empty($task['due']) && $task['due'] < $today);
        })->map(function ($record) {
            $task = $record->payload;
            return [
                'id' => $task['id'] ?? $record->id,
                'assignee' => $task['assignee'] ?? '',
                'department' => $task['department'] ?? '',
                'branch' => $task['branch'] ?? '',
                'status' => $task['status'] ?? '',
                'due' => $task['due'] ?? '',
                'completedAt' => $task['completedAt'] ?? '',
                'submittedAt' => $task['submittedAt'] ?? '',
                'template' => $task['template'] ?? '',
            ];
        })->filter(fn (array $task) => $task['assignee'] !== '')->values();
        return response()->json(['records' => $rows]);
    }
    public function store(Request $request, TaskModuleWriter $writer)
    {
        $this->available();
        $validated = $request->validate([
            'tasks'=>'required|array|min:1|max:500','tasks.*'=>'required|array',
            'tasks.*.id'=>'required|integer|min:1','tasks.*.title'=>'required|string|max:140',
            'tasks.*.description'=>'required|string|max:20000','tasks.*.assignee'=>'required|string|max:255',
            'tasks.*.department'=>'required|string|max:255','tasks.*.branch'=>'required|string|max:255',
            'tasks.*.template'=>'required|string|max:100','tasks.*.due'=>'required|date_format:Y-m-d',
            'tasks.*.priority'=>'nullable|string|max:100','tasks.*.kind'=>'nullable|string|max:100','tasks.*.taskType'=>'nullable|in:execution,monitoring,both',
            'tasks.*.assigneeRole'=>'nullable|string|max:255','tasks.*.requestedBy'=>'nullable|string|max:255',
            'tasks.*.approvalRequired'=>'sometimes|boolean','tasks.*.approvalReviewer'=>'nullable|string|max:255',
            'tasks.*.approvalReviewerRole'=>'nullable|string|max:100',
            'tasks.*.approvalGrantedAt'=>'nullable|string|max:100','tasks.*.approvalGrantedBy'=>'nullable|string|max:255',
            'tasks.*.startedAt'=>'nullable|string|max:100',
            'tasks.*.elapsedSeconds'=>'nullable|integer|min:0',
            'tasks.*.submittedAt'=>'nullable|string|max:100','tasks.*.submittedBy'=>'nullable|string|max:255',
            'tasks.*.completedAt'=>'nullable|string|max:100','tasks.*.dismissedAt'=>'nullable|string|max:100',
            'tasks.*.dismissedBy'=>'nullable|string|max:255',
            'tasks.*.sample'=>'sometimes|boolean','tasks.*.sampleKey'=>'nullable|string|max:255',
            'tasks.*.rootId'=>'nullable|integer|min:1','tasks.*.coordinator'=>'nullable|string|max:255',
            'tasks.*.coordinators'=>'nullable|array','tasks.*.coordinators.*'=>'string|max:255',
            'tasks.*.originDepartment'=>'nullable|string|max:255','tasks.*.originBranch'=>'nullable|string|max:255',
            'tasks.*.correcting'=>'sometimes|boolean','tasks.*.previousSubmission'=>'nullable|array',
            'tasks.*.startDate'=>'nullable|date_format:Y-m-d','tasks.*.frequency'=>'nullable|in:once,daily,weekly,monthly','tasks.*.frequencyChangedAt'=>'nullable|date',
            'tasks.*.repeatSeriesId'=>'nullable|integer|min:1','tasks.*.occurrenceStart'=>'nullable|date_format:Y-m-d','tasks.*.repeatAnchorStart'=>'nullable|date_format:Y-m-d','tasks.*.repeatAnchorDue'=>'nullable|date_format:Y-m-d',
            'tasks.*.status'=>'required|in:Not Started,In Progress,Pending Approval,Pending Review,Revision Needed,Completed,Denied,Dismissed',
            'tasks.*.submission'=>'nullable|string|max:100000','tasks.*.remarks'=>'nullable|string|max:20000',
            'tasks.*.history'=>'nullable|array','tasks.*.parentId'=>'nullable|integer|min:1',
            'tasks.*.dependsOn'=>'nullable|array|max:100','tasks.*.dependsOn.*'=>'integer|min:1|distinct',
            'tasks.*.pings'=>'nullable|array|max:500','tasks.*.pings.*'=>'array',
            'tasks.*.sharedBranchReport'=>'sometimes|boolean','tasks.*.recurrence'=>'nullable|string|max:30',
            'tasks.*.scheduledDate'=>'nullable|date_format:Y-m-d','tasks.*.weekStart'=>'nullable|date_format:Y-m-d',
            'tasks.*.weekEnd'=>'nullable|date_format:Y-m-d','tasks.*.periodStart'=>'nullable|date_format:Y-m-d','tasks.*.periodEnd'=>'nullable|date_format:Y-m-d',
            'tasks.*.rounds'=>'nullable|array','tasks.*.narrative'=>'nullable|array','tasks.*.operations'=>'nullable|array',
            'tasks.*.customReport'=>'nullable|array','tasks.*.weeklyReport'=>'nullable|array',
            'tasks.*.link'=>'nullable|url:http,https|max:4000',
            'tasks.*._serverVersion'=>'nullable|integer|min:1',
        ]);
        foreach ($validated['tasks'] as $task) abort_if(!empty($task['startDate']) && $task['startDate'] > $task['due'],422,'The starting date must be on or before the deadline.');
        return response()->json(['records'=>$writer->saveMany($request->user(),$validated['tasks'])]);
    }
    public function turnover(Request $request, TaskModuleAccess $access)
    {
        $this->available();
        $input=$request->validate(['key'=>'required|string|max:255','version'=>'required|integer|min:1','action'=>'required|in:request,accept,decline,cancel','recipient'=>'nullable|string|max:255','notes'=>'nullable|string|max:4000']);
        return response()->json(['record'=>app(\App\Services\TaskModuleTurnover::class)->act($request->user(),$input,$access)]);
    }
    public function destroy(Request $request, TaskModuleAccess $access)
    {
        $this->available();
        $data=$request->validate(['keys'=>'required|array|min:1|max:500','keys.*'=>'required|string']);
        $actor=$request->user();
        abort_unless($access->active($actor),403);
        DB::transaction(function () use ($data,$actor,$access) {
            $records=TaskModuleRecord::whereIn('client_key',$data['keys'])->lockForUpdate()->get();
            foreach ($records as $record) {
                abort_unless($access->canDelete($actor,$record),403);
            }
            // A coordinator may not have every descendant loaded in their browser.
            $all=TaskModuleRecord::lockForUpdate()->get();
            $ids=$records->pluck('id')->all();
            do {
                $before=count($ids);
                $clientIds=$all->whereIn('id',$ids)->map(fn($record)=>$record->payload['id'])->all();
                foreach($all as $record) if(in_array($record->payload['parentId'] ?? null,$clientIds,true) && !in_array($record->id,$ids,true))$ids[]=$record->id;
            }while(count($ids)>$before);
            $clientIds=$all->whereIn('id',$ids)->map(fn($record)=>$record->payload['id'])->all();
            foreach($all as $record) if(!in_array($record->id,$ids,true))abort_if(array_intersect($record->payload['dependsOn'] ?? [],$clientIds),422,'Other tasks depend on this work. Delete the containing workflow instead.');
            foreach ($all->whereIn('id', $ids) as $record) {
                $record->delete();
                LoggerService::log('Task Module', 'Delete', 'Deleted task: '.$record->payload['title'], userId: $actor->id);
            }
        });
        return response()->noContent();
    }
}
