<?php
namespace Tests\Feature;
use App\Models\User;
use App\Models\TaskModuleRecord;
use App\Services\TaskModuleWriter;
use App\Http\Controllers\NotificationController;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema, Notification};
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;
class TaskScoringWorkflowTest extends TestCase
{
    private User $lead;
    private User $manager;
    private User $employee;
    private TaskModuleWriter $writer;
    protected function setUp(): void
    {
        parent::setUp();
        config(['task_module.server_enabled'=>true,'task_module.email_mode'=>'log','task_module.queue_connection'=>'database']);
        foreach (['roles','positions','departments','branches'] as $name) Schema::create($name, function (Blueprint $table) { $table->id();$table->string('name');$table->timestamps(); });
        Schema::create('users',function (Blueprint $table) {
            $table->id();$table->string('name');$table->string('email');$table->string('password');$table->string('status')->nullable();
            foreach(['role_id','position_id','department_id','branch_id'] as $key)$table->unsignedBigInteger($key)->nullable();
            $table->timestamps();
        });
        Schema::create('branch_user',function (Blueprint $table) {$table->unsignedBigInteger('user_id');$table->unsignedBigInteger('branch_id');});
        (require database_path('migrations/2026_10_25_000001_create_task_module_records.php'))->up();
        (require database_path('migrations/2026_11_15_000001_create_task_id_settings.php'))->up();
        $role=DB::table('roles')->insertGetId(['name'=>'Employee']);
        $department=DB::table('departments')->insertGetId(['name'=>'IT']);
        $branch=DB::table('branches')->insertGetId(['name'=>'Makati']);
        $make=function ($name,$position) use ($role,$department,$branch) {
            $positionId=DB::table('positions')->insertGetId(['name'=>$position]);
            return User::withoutEvents(fn () => User::create(['name'=>$name,'email'=>strtolower(str_replace(' ','',$name)).'@example.invalid','password'=>'test','status'=>'Active','role_id'=>$role,'department_id'=>$department,'branch_id'=>$branch,'position_id'=>$positionId]));
        };
        $this->lead=$make('Test IT Lead','IT Team Leader');
        $this->manager=$make('Test Branch Manager','Operations Manager');
        $this->employee=$make('Test IT Employee','IT Associate');
        $make('Test EVP','Executive Vice President');
        (require database_path('migrations/2026_11_21_000001_create_task_scoring_records.php'))->up();
        Schema::create('system_logs',function(Blueprint $t){$t->id();$t->unsignedBigInteger('user_id')->nullable();foreach(['module','action','description','ip_address','user_agent','status'] as $key)$t->text($key)->nullable();$t->timestamps();});
        $this->travelTo(\Carbon\Carbon::parse('2026-11-21 10:00:00','Asia/Manila'));
        $this->writer=app(TaskModuleWriter::class);
        Notification::fake();
    }

    private function draft(): array
    {
        return ['id'=>99001,'title'=>'Release check','description'=>'Check equipment.','template'=>'standard','assignee'=>$this->employee->name,'department'=>'IT','branch'=>'Makati','priority'=>'Medium','due'=>now('Asia/Manila')->toDateString(),'kind'=>'Assigned task','status'=>'Not Started','submission'=>''];
    }
    private function createTask(string $priority='High'): array {
        return $this->writer->saveMany($this->lead,[[...$this->draft(),'id'=>random_int(100000,999999),'priority'=>$priority]])[0];
    }
    private function submit(array $task, ?User $actor=null): array {
        $actor??=$this->employee;
        if ($task['status']==='Not Started')$task=$this->writer->saveMany($actor,[[...$task,'status'=>'In Progress']])[0];
        return $this->writer->saveMany($actor,[[...$task,'status'=>'Pending Review','submission'=>'Work checked and submitted.']])[0];
    }
    private function approve(array $task): array { return $this->writer->saveMany($this->lead,[[...$task,'status'=>'Completed']])[0]; }
    public function test_award_uses_submission_not_approval_and_is_idempotent(): void {
        $task=$this->submit($this->createTask());$this->assertSame(0,$task['scoring']['earned_units']);
        $this->travelTo(\Carbon\Carbon::parse('2026-11-25 10:00:00','Asia/Manila'));
        $done=$this->approve($task);$this->assertSame(7000000,$done['scoring']['earned_units']);
        $count=DB::table('task_scoring_audits')->count();
        $again=$this->writer->saveMany($this->lead,[$done])[0];
        $this->assertSame(7000000,$again['scoring']['earned_units']);$this->assertSame($count,DB::table('task_scoring_audits')->count());
    }
    public function test_revision_is_recorded_once_and_final_submission_determines_time(): void {
        $task=$this->submit($this->createTask());
        $task=$this->writer->saveMany($this->lead,[[...$task,'status'=>'Revision Needed','remarks'=>'Correct the finding.']])[0];
        $task=$this->writer->saveMany($this->lead,[[...$task,'remarks'=>'Please correct the finding.']])[0];
        $this->travelTo(\Carbon\Carbon::parse('2026-11-22 10:00:00','Asia/Manila'));
        $task=$this->submit($task);$done=$this->approve($task);
        $this->assertSame(1,$done['scoring']['return_count']);$this->assertCount(2,$done['scoring']['submissions']);
        $this->assertSame(1,$done['scoring']['scores']['time']);$this->assertSame(5500000,$done['scoring']['earned_units']);
    }
    public function test_accepted_handover_reserves_but_only_completion_awards_points(): void {
        $peer=User::withoutEvents(fn()=>User::create(['name'=>'Test IT Peer','email'=>'peer@example.invalid','password'=>'test','status'=>'Active','role_id'=>$this->employee->role_id,'position_id'=>$this->employee->position_id,'department_id'=>$this->employee->department_id,'branch_id'=>$this->employee->branch_id]));
        $task=$this->createTask('Critical');$service=app(\App\Services\TaskModuleTurnover::class);$access=app(\App\Services\TaskModuleAccess::class);
        $pending=$service->act($this->employee,['key'=>$task['_serverKey'],'version'=>$task['_serverVersion'],'action'=>'request','recipient'=>$peer->name,'notes'=>'Finish verification.'],$access);
        $this->assertSame(0,$pending['scoring']['earned_units']);
        $accepted=$service->act($peer,['key'=>$pending['_serverKey'],'version'=>$pending['_serverVersion'],'action'=>'accept'],$access);
        $this->assertSame(0,$accepted['scoring']['earned_units']);
        $done=$this->approve($this->submit($accepted,$peer));
        $this->assertSame([10000000],array_column($done['scoring']['allocations'],'awarded_units'));
        $this->assertSame([$peer->id],array_column($done['scoring']['allocations'],'id'));
        $this->assertArrayNotHasKey('ownership',$done['scoring']['scores']);
    }
    public function test_reversal_and_recalculation_are_audited_without_inventing_legacy_evidence(): void {
        $done=$this->approve($this->submit($this->createTask()));$record=TaskModuleRecord::first();$old=$record->payload;
        // Scoring observes an authorized workflow's state change; it does not introduce a new reopen permission.
        $payload=$record->payload;$payload['status']='In Progress';$record->update(['payload'=>$payload,'version'=>$record->version+1]);
        app(\App\Services\TaskScoring::class)->observe($record,$this->lead,$old,false);
        $this->assertSame(0,\App\Services\TaskScoring::snapshot($record)['earned_units']);
        $this->assertDatabaseHas('task_scoring_audits',['event'=>'reversal']);

    }

    private function admin(): User {
        $id=DB::table('roles')->insertGetId(['name'=>'Admin']);
        $this->manager->role_id=$id;$this->manager->save();return $this->manager->fresh();
    }
    private function settingsRequest(User $actor, array $changes=[]): Request {
        $r=Request::create('/task-module/settings/scoring','POST',array_replace(config('task-scoring'),['version'=>1,'application'=>'new'],$changes));
        $r->setUserResolver(fn()=>$actor);return $r;
    }
    public function test_settings_versions_preserve_existing_tasks_until_explicit_recalculation(): void {
        $task=$this->submit($this->createTask());
        $task=$this->writer->saveMany($this->lead,[[...$task,'status'=>'Revision Needed','remarks'=>'Correct it.']])[0];
        $task=$this->approve($this->submit($task));$this->assertSame(6500000,$task['scoring']['earned_units']);
        $admin=$this->admin();$controller=app(\App\Http\Controllers\TaskScoringController::class);
        $controller->update($this->settingsRequest($admin,['return_brackets'=>[['max_returns'=>0,'score'=>1],['max_returns'=>2,'score'=>0.25],['max_returns'=>null,'score'=>0]]]));
        $record=TaskModuleRecord::first();$this->assertSame(6500000,\App\Services\TaskScoring::snapshot($record)['earned_units']);
        $new=$this->createTask();$this->assertSame(2,$new['scoring']['policy_version']);
        $controller->update($this->settingsRequest($admin,['version'=>2,'application'=>'recalculate','return_brackets'=>[['max_returns'=>0,'score'=>1],['max_returns'=>2,'score'=>0.25],['max_returns'=>null,'score'=>0]]]));
        $score=\App\Services\TaskScoring::snapshot($record);
        $this->assertSame(6250000,$score['earned_units']);$this->assertSame(3,$score['policy_version']);
        $this->assertDatabaseHas('task_scoring_audits',['event'=>'recalculation']);
        $this->assertDatabaseHas('system_logs',['action'=>'Scoring settings']);
    }
    public function test_bad_brackets_and_stale_settings_are_rejected(): void {
        $controller=app(\App\Http\Controllers\TaskScoringController::class);$admin=$this->admin();
        try {$controller->update($this->settingsRequest($admin,['lateness'=>[['max_hours'=>72,'score'=>0.5],['max_hours'=>24,'score'=>1],['max_hours'=>null,'score'=>0]]]));$this->fail('Invalid bracket order accepted.');}
        catch(\Illuminate\Validation\ValidationException $e){$this->assertArrayHasKey('lateness',$e->errors());}
        $controller->update($this->settingsRequest($admin));
        try {$controller->update($this->settingsRequest($admin));$this->fail('Stale settings accepted.');}
        catch(HttpException $e){$this->assertSame(409,$e->getStatusCode());}
        $this->assertSame(2,DB::table('task_scoring_policies')->count());
    }
    public function test_employee_and_intern_cannot_access_leaderboard_or_settings(): void {
        $controller=app(\App\Http\Controllers\TaskModuleController::class);$access=app(\App\Services\TaskModuleAccess::class);
        foreach(['IT Associate','IT Intern'] as $position){
            $id=DB::table('positions')->insertGetId(['name'=>$position]);$this->employee->position_id=$id;$this->employee->save();$user=$this->employee->fresh();
            $r=Request::create('/task-module/leaderboard','GET',['today'=>'2026-11-21']);$r->setUserResolver(fn()=>$user);
            $this->assertFalse(\App\Services\TaskScoring::canView($user));
            try{$controller->leaderboard($r,$access);$this->fail('Leaderboard access permitted.');}catch(HttpException $e){$this->assertSame(403,$e->getStatusCode());}
            try{app(\App\Http\Controllers\TaskScoringController::class)->show($r);$this->fail('Settings access permitted.');}catch(HttpException $e){$this->assertSame(403,$e->getStatusCode());}
        }
        $this->assertTrue(\App\Services\TaskScoring::canView($this->lead));
    }
    public function test_completed_priority_cannot_be_increased_and_transaction_rolls_back(): void {
        $done=$this->approve($this->submit($this->createTask('Medium')));
        try{$this->writer->saveMany($this->lead,[[...$done,'priority'=>'Critical']]);$this->fail('Completed priority increased.');}
        catch(\Illuminate\Validation\ValidationException|HttpException $e){$this->assertNotEmpty($e->getMessage());}
        $record=TaskModuleRecord::first();$this->assertSame('Medium',$record->payload['priority']);$this->assertSame(5000000,\App\Services\TaskScoring::snapshot($record)['earned_units']);
    }
    public function test_legacy_recalculation_does_not_invent_a_perfect_score(): void {
        $record=TaskModuleRecord::create(['client_key'=>'task:999','creator_id'=>$this->lead->id,'assignee_id'=>$this->employee->id,'reviewer_id'=>$this->lead->id,'department'=>'IT','branch'=>'Makati','version'=>1,'payload'=>[...$this->draft(),'id'=>999,'status'=>'Completed','completedAt'=>now()->toIso8601String()]]);
        $controller=app(\App\Http\Controllers\TaskScoringController::class);$controller->update($this->settingsRequest($this->admin(),['application'=>'recalculate']));
        $score=\App\Services\TaskScoring::snapshot($record);$this->assertSame('incomplete_records',$score['reason']);$this->assertSame(0,$score['earned_units']);
    }

    public function test_declined_and_cancelled_handover_requests_do_not_allocate_points(): void {
        $peer=User::withoutEvents(fn()=>User::create(['name'=>'Decline Peer','email'=>'decline@example.invalid','password'=>'test','status'=>'Active','role_id'=>$this->employee->role_id,'position_id'=>$this->employee->position_id,'department_id'=>$this->employee->department_id,'branch_id'=>$this->employee->branch_id]));
        $task=$this->createTask('Critical');$service=app(\App\Services\TaskModuleTurnover::class);$access=app(\App\Services\TaskModuleAccess::class);
        foreach(['decline','cancel'] as $action){
            $task=$service->act($this->employee,['key'=>$task['_serverKey'],'version'=>$task['_serverVersion'],'action'=>'request','recipient'=>$peer->name,'notes'=>'Please help.'],$access);
            $task=$service->act($action==='decline'?$peer:$this->employee,['key'=>$task['_serverKey'],'version'=>$task['_serverVersion'],'action'=>$action],$access);
        }
        $done=$this->approve($this->submit($task));$this->assertSame(10000000,$done['scoring']['earned_units']);$this->assertEmpty($done['scoring']['transfers']);
        $this->assertSame([$this->employee->id],array_column($done['scoring']['allocations'],'id'));
    }
    public function test_successive_accepted_handovers_preserve_earlier_shares_and_flag_review(): void {
        $make=fn($name)=>User::withoutEvents(fn()=>User::create(['name'=>$name,'email'=>$name.'@example.invalid','password'=>'test','status'=>'Active','role_id'=>$this->employee->role_id,'position_id'=>$this->employee->position_id,'department_id'=>$this->employee->department_id,'branch_id'=>$this->employee->branch_id]));
        $peer=$make('Peer1');$last=$make('Peer2');$owner=$this->employee;$task=$this->createTask('Critical');
        $service=app(\App\Services\TaskModuleTurnover::class);$access=app(\App\Services\TaskModuleAccess::class);
        foreach([$peer,$last] as $recipient){
            $task=$service->act($owner,['key'=>$task['_serverKey'],'version'=>$task['_serverVersion'],'action'=>'request','recipient'=>$recipient->name,'notes'=>'Continue the work.'],$access);
            $task=$service->act($recipient,['key'=>$task['_serverKey'],'version'=>$task['_serverVersion'],'action'=>'accept'],$access);$owner=$recipient;
        }
        $done=$this->approve($this->submit($task,$last));$this->assertSame([10000000],array_column($done['scoring']['allocations'],'awarded_units'));$this->assertSame([$last->id],array_column($done['scoring']['allocations'],'id'));
        $this->assertNotEmpty($done['scoring']['review_flags']);$this->assertSame(2,DB::table('task_scoring_audits')->where('event','accepted_handover')->count());
    }

    public function test_pool_migration_keeps_legacy_evidence_and_is_idempotent(): void {
        $legacy=['lateness'=>[['max_hours'=>24,'score'=>15],['max_hours'=>72,'score'=>6],['max_hours'=>null,'score'=>0]],'return_deduction'=>5,'handover_percent'=>50];
        DB::table('task_scoring_policies')->where('id',1)->update(['policy'=>json_encode($legacy)]);
        $done=$this->approve($this->submit($this->createTask()));$record=TaskModuleRecord::first();$payload=$record->payload;$version=$record->version;
        $state=DB::table('task_scoring_states')->where('task_record_id',$record->id)->first();$result=json_decode($state->result,true);unset($result['allocation_rule']);
        DB::table('task_scoring_states')->where('task_record_id',$record->id)->update(['result'=>json_encode($result)]);
        $migration=require database_path('migrations/2026_11_23_000001_equalize_task_handover_pool.php');$migration->up();$migration->up();
        $score=\App\Services\TaskScoring::snapshot($record);$this->assertSame('equal_handover_pool_v2',$score['allocation_rule']);$this->assertSame(940000,$score['earned_units']);
        $this->assertSame(1,DB::table('task_scoring_audits')->where('event','ownership_pool_recalculation')->count());$this->assertSame($version,$record->fresh()->version);$this->assertSame($payload,$record->fresh()->payload);
    }

    public function test_ten_point_settings_reject_invalid_maxima_and_return_brackets(): void {
        $controller=app(\App\Http\Controllers\TaskScoringController::class);$admin=$this->admin();
        foreach([
            ['weights'=>['time'=>30,'priority'=>30,'returns'=>20,'ownership'=>20]],
            ['return_brackets'=>[['max_returns'=>0,'score'=>1],['max_returns'=>2,'score'=>1.5],['max_returns'=>null,'score'=>0]]],
            ['return_brackets'=>[['max_returns'=>0,'score'=>0.5],['max_returns'=>2,'score'=>0.5],['max_returns'=>null,'score'=>0]]],
            ['return_brackets'=>[['max_returns'=>0,'score'=>1],['max_returns'=>null,'score'=>0.5],['max_returns'=>2,'score'=>0]]]
        ] as $changes){try{$controller->update($this->settingsRequest($admin,$changes));$this->fail('Invalid rubric settings accepted.');}catch(\Illuminate\Validation\ValidationException $e){$this->assertNotEmpty($e->errors());}}
        $this->assertSame(1,DB::table('task_scoring_policies')->count());
    }
}
