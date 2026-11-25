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
class TaskReleaseSafetyTest extends TestCase
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
        $this->writer=app(TaskModuleWriter::class);
        Notification::fake();
    }

    private function draft(): array
    {
        return ['id'=>99001,'title'=>'Release check','description'=>'Check equipment.','template'=>'standard','assignee'=>$this->employee->name,'department'=>'IT','branch'=>'Makati','priority'=>'Medium','due'=>now('Asia/Manila')->toDateString(),'kind'=>'Assigned task','status'=>'Not Started','submission'=>''];
    }
    public function test_assigned_work_is_shared_and_reviewer_completes_it(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        $this->assertSame('Not Started',$created['status']);
        [$started]=$this->writer->saveMany($this->employee,[[...$created,'status'=>'In Progress']]);
        $this->assertNotEmpty($started['startedAt']);
        [$submitted]=$this->writer->saveMany($this->employee,[[...$started,'status'=>'Pending Review','submission'=>'Equipment checked.']]);
        [$completed]=$this->writer->saveMany($this->lead,[[...$submitted,'status'=>'Completed']]);
        $this->assertSame('Completed',$completed['status']);
        $this->assertNotEmpty($completed['submittedAt']);
        $this->assertNotEmpty($completed['completedAt']);
        $this->assertDatabaseCount('task_module_records',1);
        $this->assertDatabaseCount('task_module_events',4);
    }
    public function test_stale_save_does_not_overwrite_started_work(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        $this->writer->saveMany($this->employee,[[...$created,'status'=>'In Progress']]);
        try { $this->writer->saveMany($this->lead,[[...$created,'description'=>'Stale edit']]); $this->fail('Stale save accepted'); }
        catch (HttpException $e) { $this->assertSame(409,$e->getStatusCode()); }
        $this->assertSame('In Progress',TaskModuleRecord::first()->payload['status']);
    }
    public function test_manager_cannot_start_another_persons_work(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        $this->expectException(HttpException::class);
        $this->writer->saveMany($this->manager,[[...$created,'status'=>'In Progress']]);
    }
    public function test_submission_requires_starting_work(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        $this->expectException(HttpException::class);
        $this->writer->saveMany($this->employee,[[...$created,'status'=>'Pending Review','submission'=>'Bypass attempt']]);
    }
    public function test_import_cannot_create_a_completed_task(): void
    {
        [$saved]=$this->writer->saveMany($this->lead,[[...$this->draft(),'status'=>'Completed','submission'=>'Imported completion']]);
        $this->assertSame('Not Started',$saved['status']);
        $this->assertEmpty($saved['completedAt'] ?? null);
    }
    public function test_production_rejects_preview_notification_identity(): void
    {
        $this->app->instance('env','production');
        config(['task_module.preview_enabled'=>true]);
        $admin=DB::table('roles')->insertGetId(['name'=>'Admin']);
        $this->lead->role_id=$admin;$this->lead->saveQuietly();$this->lead->unsetRelation('role');
        $request=Request::create('/notifications/ticketing-feed','GET',['preview_person'=>$this->employee->name]);
        $request->setUserResolver(fn()=>$this->lead);
        $this->expectException(HttpException::class);
        NotificationController::ticketRecipient($request);
    }
    public function test_task_ids_follow_the_department_month_year_and_five_digit_sequence(): void
    {
        $date=\Carbon\CarbonImmutable::parse('2026-11-15','Asia/Manila');
        $this->assertSame('IT-1126-00001',\App\Services\TaskIdSettings::reserve('IT','Employee',$date));
        $this->assertSame('IT-1126-00002',\App\Services\TaskIdSettings::reserve('IT','Employee',$date));
        $this->assertSame('IT-1226-00001',\App\Services\TaskIdSettings::reserve('IT','Employee',$date->addMonth()));
    }
    public function test_id_limit_stops_before_overflow_and_larger_format_allows_new_tasks(): void
    {
        DB::table('task_id_sequences')->insert(['scope'=>'IT-1126:5','last_number'=>99999,'created_at'=>now(),'updated_at'=>now()]);
        try { \App\Services\TaskIdSettings::reserve('IT','Employee',new \DateTimeImmutable('2026-11-15')); $this->fail('Overflow accepted'); }
        catch (\Illuminate\Validation\ValidationException $error) { $this->assertStringContainsString('limit', $error->getMessage()); }
        DB::table('task_module_settings')->insert(['key'=>'task_ids','value'=>json_encode([...\App\Services\TaskIdSettings::defaults(),'digits'=>6]),'version'=>1]);
        $this->assertSame('IT-1126-000001',\App\Services\TaskIdSettings::reserve('IT','Employee',new \DateTimeImmutable('2026-11-15')));
    }

    public function test_id_format_can_preserve_or_update_existing_records(): void
    {
        Schema::create('system_logs',function(Blueprint $table) { $table->id(); $table->unsignedBigInteger('user_id')->nullable(); foreach(['module','action','description','ip_address','user_agent','status'] as $name)$table->text($name)->nullable(); $table->timestamps(); });
        [$task]=$this->writer->saveMany($this->lead,[$this->draft()]);
        $admin=DB::table('roles')->insertGetId(['name'=>'Admin']);
        $this->lead->role_id=$admin; $this->lead->saveQuietly(); $this->lead->unsetRelation('role');
        $save=function($applyTo) {
            $request=Request::create('/task-module/settings/task-ids','POST',[...\App\Services\TaskIdSettings::defaults(),'separator'=>'_','applyTo'=>$applyTo]);
            $request->setUserResolver(fn()=>$this->lead);
            return (new \App\Http\Controllers\TaskIdSettingsController)->update($request)->getData(true);
        };
        $save('new');
        $record=TaskModuleRecord::first();
        $this->assertSame($task['taskCode'],$record->payload['taskCode']);
        $result=$save('all'); $record->refresh();
        $this->assertStringContainsString('_',$record->payload['taskCode']);
        $this->assertSame($task['_serverKey'],$record->client_key);
        $this->assertSame($task['assignee'],$record->payload['assignee']);
        $this->assertSame($task['_serverVersion']+1,$record->version);
        $this->assertCount(1,$result['records']);
        $this->assertStringContainsString($task['taskCode'],end($result['records'][0]['history'])['text']);
    }

    public function test_multiple_handovers_only_allow_owned_tasks_and_roll_back_on_failure(): void
    {
        [$first]=$this->writer->saveMany($this->lead,[$this->draft()]);
        [$second]=$this->writer->saveMany($this->lead,[[...$this->draft(),'id'=>99002,'title'=>'Second task']]);
        $recipient=$this->employee->replicate(); $recipient->name='Other IT Employee';$recipient->email='other@example.invalid';$recipient->saveQuietly();
        $record=TaskModuleRecord::where('client_key',$second['_serverKey'])->first();
        $record->assignee_id=$this->manager->id; $record->saveQuietly();
        $request=Request::create('/task-module/turnover-batch','POST',['tasks'=>[['key'=>$first['_serverKey'],'version'=>$first['_serverVersion']],['key'=>$second['_serverKey'],'version'=>$second['_serverVersion']]],'recipient'=>$recipient->name,'notes'=>'Please finish the equipment checks.']);
        $request->setUserResolver(fn()=>$this->employee);
        try { (new \App\Http\Controllers\TaskModuleController)->turnoverBatch($request,app(\App\Services\TaskModuleAccess::class)); $this->fail('Non-owned task accepted'); }
        catch(HttpException $error) { $this->assertSame(403,$error->getStatusCode()); }
        $this->assertArrayNotHasKey('handover',TaskModuleRecord::where('client_key',$first['_serverKey'])->first()->payload);
        $record->assignee_id=$this->employee->id; $record->saveQuietly();
        $originalDepartment=$recipient->department_id; $originalPosition=$recipient->position_id;
        $recipient->department_id=DB::table('departments')->insertGetId(['name'=>'HR']); $recipient->position_id=DB::table('positions')->insertGetId(['name'=>'HR Assistant']); $recipient->saveQuietly();
        try { (new \App\Http\Controllers\TaskModuleController)->turnoverBatch($request,app(\App\Services\TaskModuleAccess::class)); $this->fail('Disallowed department accepted'); }
        catch(HttpException $error) { $this->assertSame(403,$error->getStatusCode()); }
        $this->assertArrayNotHasKey('handover',TaskModuleRecord::where('client_key',$first['_serverKey'])->first()->payload);
        $recipient->department_id=$originalDepartment; $recipient->position_id=$originalPosition; $recipient->saveQuietly();
        $result=(new \App\Http\Controllers\TaskModuleController)->turnoverBatch($request,app(\App\Services\TaskModuleAccess::class))->getData(true);
        $this->assertCount(2,$result['records']);
        foreach($result['records'] as $task) { $this->assertSame('pending',$task['handover']['status']); $this->assertSame($this->employee->name,$task['assignee']); }
    }

}
