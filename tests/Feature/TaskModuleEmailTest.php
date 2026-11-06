<?php

namespace Tests\Feature;

use App\Models\TaskModuleRecord;
use App\Models\User;
use App\Notifications\TaskModuleEmail;
use App\Services\TaskModuleAccess;
use App\Services\TaskModuleWriter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class TaskModuleEmailTest extends TestCase
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
    public function test_report_owner_can_choose_an_allowed_branch_without_transferring_the_report(): void
    {
        $branch=DB::table('branches')->insertGetId(['name'=>'Alabang']);
        $this->employee->branches()->attach($branch);
        $this->employee->refresh();
        [$report]=$this->writer->saveMany($this->lead,[[...$this->draft(9981),'template'=>'narrative-report','recurrence'=>'daily','scheduledDate'=>'2026-10-30']]);
        [$saved]=$this->writer->saveMany($this->employee,[[...$report,'branch'=>'Alabang','status'=>'In Progress','narrative'=>['problems'=>'None']]]);
        $this->assertSame('Alabang',$saved['branch']);
        $this->assertSame($this->employee->name,$saved['assignee']);
    }

    public function test_standard_task_branch_cannot_be_changed_to_bypass_handover(): void
    {
        [$task]=$this->writer->saveMany($this->lead,[$this->draft(9982)]);
        $this->expectException(HttpException::class);
        $this->writer->saveMany($this->lead,[[...$task,'branch'=>'Alabang']]);
    }

    public function test_recurring_schedule_uses_its_original_owner_after_temporary_recipient_becomes_inactive(): void
    {
        $this->travelTo(\Carbon\Carbon::parse('2026-10-31 12:00:00','Asia/Manila'));
        try {
            [$task]=$this->writer->saveMany($this->lead,[[...$this->draft(9983),'frequency'=>'daily','startDate'=>'2026-10-30']]);
            $record=TaskModuleRecord::where('client_key','task:9983')->firstOrFail();
            $payload=$record->payload;
            $payload['frequencyChangedAt']='2026-10-30T00:00:00+08:00';
            $payload['recurrenceOwner']=['id'=>$this->employee->id,'name'=>$this->employee->name,'role'=>'Employee'];
            $payload['assignee']=$this->manager->name;
            $record->update(['payload'=>$payload,'assignee_id'=>$this->manager->id]);
            $this->manager->update(['status'=>'Inactive']);
            app(\App\Services\TaskModuleRecurrence::class)->generate();
            $next=TaskModuleRecord::where('client_key','repeat:9983:2026-10-31')->firstOrFail();
            $this->assertSame($this->employee->id,$next->assignee_id);
            $this->assertSame($this->employee->name,$next->payload['assignee']);
        } finally {$this->travelBack();}
    }

    private function draft(int $id=9001): array
    {
        return ['id'=>$id,'title'=>'Check branch equipment','description'=>'Check systems and record findings.','template'=>'standard','assignee'=>$this->employee->name,'department'=>'IT','branch'=>'Makati','priority'=>'Medium','due'=>'2026-10-30','kind'=>'Assigned task','status'=>'Not Started','submission'=>''];
    }
    public function test_creation_approval_submission_and_decision_are_persisted_and_generate_local_mail_notifications(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        $this->assertSame('Pending Approval',$created['status']);
        $this->assertDatabaseCount('task_module_records',1);
        Notification::assertSentTo($this->manager,TaskModuleEmail::class,fn($mail)=>$mail->mode==='log'&&$mail->queue==='task-mail');
        [$approved]=$this->writer->saveMany($this->manager,[[...$created,'status'=>'Not Started']]);
        [$submitted]=$this->writer->saveMany($this->employee,[[...$approved,'status'=>'Pending Review','submission'=>'https://example.invalid/output']]);
        Notification::assertSentTo($this->lead,TaskModuleEmail::class,fn($mail)=>$mail->event==='Submitted for review');
        [$completed]=$this->writer->saveMany($this->lead,[[...$submitted,'status'=>'Completed']]);
        $this->assertSame('Completed',$completed['status']);
        $this->assertDatabaseCount('task_module_events',4);
        Notification::assertSentTo($this->employee,TaskModuleEmail::class,fn($mail)=>$mail->event==='Task approved');
    }
    public function test_stale_updates_and_unapproved_submissions_cannot_send_duplicate_mail(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        try {$this->writer->saveMany($this->employee,[[...$created,'status'=>'Pending Review','submission'=>'Bypass']]);$this->fail('Approval bypass accepted.');}catch(HttpException $error){$this->assertSame(403,$error->getStatusCode());}
        [$approved]=$this->writer->saveMany($this->manager,[[...$created,'status'=>'Not Started']]);
        try {$this->writer->saveMany($this->manager,[[...$created,'status'=>'Not Started']]);$this->fail('Stale version accepted.');}catch(HttpException $error){$this->assertSame(409,$error->getStatusCode());}
        $this->assertDatabaseCount('task_module_events',2);
    }
    public function test_only_current_actor_may_submit_and_samples_never_generate_mail(): void
    {
        try {$this->writer->saveMany($this->employee,[$this->draft()]);$this->fail('Employee created a standard task.');}catch(HttpException $error){$this->assertSame(403,$error->getStatusCode());}
        try {$this->writer->saveMany($this->lead,[[...$this->draft(),'title'=>'[Sample] Test']]);$this->fail('Sample persisted.');}catch(HttpException $error){$this->assertSame(422,$error->getStatusCode());}
        Notification::assertNothingSent();$this->assertDatabaseCount('task_module_records',0);
    }
    public function test_denial_requires_feedback_and_emails_the_assignee(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        [$denied]=$this->writer->saveMany($this->manager,[[...$created,'status'=>'Denied','remarks'=>'Not needed at this time.']]);
        $this->assertSame('Denied',$denied['status']);
        Notification::assertSentTo($this->employee,TaskModuleEmail::class,fn($mail)=>$mail->event==='Task denied');
    }
    public function test_local_email_preview_uses_log_transport_even_if_default_mailer_is_smtp(): void
    {
        config(['mail.default'=>'smtp']);
        $task=$this->draft();$mail=new TaskModuleEmail($task,'Task created',$this->lead->name,'log');
        $message=$mail->toMail($this->employee);
        $this->assertSame('task-preview',$message->mailer);
        $html=(string)$message->render();
        $this->assertStringContainsString('Check branch equipment',$html);
        $this->assertStringContainsString('Open Task Module',$html);
        if(!is_dir(base_path('outputs/task-email-preview')))mkdir(base_path('outputs/task-email-preview'),0777,true);
        file_put_contents(base_path('outputs/task-email-preview/task-created.html'),$html);
        Mail::mailer('task-preview')->html($html,fn($message)=>$message->to('local-preview@example.invalid')->subject('Task notification local preview'));
    }
    public function test_unrelated_employee_cannot_read_a_private_standard_task(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        $other=User::withoutEvents(fn()=>User::create(['name'=>'Other employee','email'=>'other@example.invalid','password'=>'test','status'=>'Active','role_id'=>$this->employee->role_id,'department_id'=>$this->employee->department_id,'branch_id'=>$this->employee->branch_id,'position_id'=>$this->employee->position_id]));
        $access=app(TaskModuleAccess::class);
        $this->assertSame(0,$access->visible($other)->count());
        $this->assertSame(1,$access->visible($this->employee)->count());
        $this->assertSame(1,$access->visible($this->manager)->count());
    }
    public function test_repeated_identical_version_does_not_create_another_event(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        [$same]=$this->writer->saveMany($this->lead,[$created]);
        $this->assertSame($created['_serverVersion'],$same['_serverVersion']);
        $this->assertDatabaseCount('task_module_events',1);
    }
    public function test_branch_opening_submission_waits_for_approval_and_has_one_shared_key(): void
    {
        $report=[...$this->draft(),'id'=>8001,'title'=>'Opening Rounds','template'=>'it-opening-rounds','recurrence'=>'daily','sharedBranchReport'=>true,'assignee'=>'IT team','status'=>'Pending Review','submission'=>'Systems checked.','scheduledDate'=>'2026-10-25'];
        [$submitted]=$this->writer->saveMany($this->employee,[$report]);
        $this->assertSame('Pending Review',$submitted['status']);
        [$approved]=$this->writer->saveMany($this->lead,[[...$submitted,'status'=>'Completed']]);
        $this->assertSame('Completed',$approved['status']);
        $this->assertStringContainsString(': approved.',$approved['history'][0]['text']);
        $this->assertDatabaseCount('task_module_records',1);
    }
    public function test_store_endpoint_uses_authenticated_identity_instead_of_claimed_sender(): void
    {
        $request=\Illuminate\Http\Request::create('/task-module/records','POST',['tasks'=>[[...$this->draft(),'requestedBy'=>'Someone else']]]);
        $request->setUserResolver(fn()=>$this->lead);
        $response=(new \App\Http\Controllers\TaskModuleController)->store($request,$this->writer);
        $document=$response->getData(true)['records'][0];
        $this->assertSame($this->lead->name,$document['requestedBy']);
        $this->assertSame('Pending Approval',$document['status']);
    }
    public function test_real_test_send_rejects_the_mailtrap_sandbox_without_sending(): void
    {
        config(['task_module.test_email'=>'test-recipient@example.com','task_module.mailer'=>'smtp','mail.mailers.smtp'=>['transport'=>'smtp','host'=>'sandbox.smtp.mailtrap.io']]);
        $this->artisan('tasks:email-test',['--send'=>true])->assertExitCode(1);
        Notification::assertNothingSent();
    }
    public function test_explicit_test_send_targets_only_the_test_address_and_leaves_task_mode_in_log(): void
    {
        config(['task_module.test_email'=>'test-recipient@example.com','task_module.mailer'=>'smtp','mail.mailers.smtp'=>['transport'=>'smtp','host'=>'smtp.example.com']]);
        $this->artisan('tasks:email-test',['--send'=>true])->assertExitCode(0);
        Notification::assertSentOnDemand(TaskModuleEmail::class,fn($notification,$channels,$notifiable)=>$notification->mode==='send'&&$notifiable->routes['mail']==='test-recipient@example.com');
        Notification::assertCount(1);
        $this->assertSame('log',config('task_module.email_mode'));
    }

    public function test_frontend_submission_timestamp_is_accepted_but_server_sets_audit_times(): void
    {
        [$created]=$this->writer->saveMany($this->manager,[$this->draft()]);
        [$submitted]=$this->writer->saveMany($this->employee,[[...$created,'status'=>'Pending Review','submission'=>'Equipment checked.','submittedAt'=>'2001-01-01T00:00:00Z','submittedBy'=>'Forged']]);
        $this->assertNotSame('2001-01-01T00:00:00Z',$submitted['submittedAt']);
        $this->assertSame($this->employee->name,$submitted['submittedBy']);
        $evp=User::where('name','Test EVP')->first();
        [$completed]=$this->writer->saveMany($evp,[[...$submitted,'status'=>'Completed','completedAt'=>'2001-01-01T00:00:00Z']]);
        $this->assertSame($submitted['submittedAt'],$completed['submittedAt']);
        $this->assertNotSame('2001-01-01T00:00:00Z',$completed['completedAt']);
    }
    public function test_visible_non_assignee_cannot_overwrite_draft_work(): void
    {
        [$created]=$this->writer->saveMany($this->manager,[$this->draft()]);
        $this->expectException(HttpException::class);
        $this->writer->saveMany($this->lead,[[...$created,'submission'=>'Someone else wrote this.']]);
    }
    public function test_existing_task_cannot_be_retyped_to_bypass_approval(): void
    {
        [$created]=$this->writer->saveMany($this->lead,[$this->draft()]);
        $this->expectException(HttpException::class);
        $this->writer->saveMany($this->lead,[[...$created,'template'=>'collaborative','approvalRequired'=>false]]);
    }
    public function test_corporate_services_cannot_read_other_interns_weekly_reports(): void
    {
        $report=[...$this->draft(),'template'=>'intern-weekly-report','weekStart'=>'2026-10-24'];
        $this->writer->saveMany($this->employee,[$report]);
        $position=DB::table('positions')->insertGetId(['name'=>'HR Manager']);
        $corporate=$this->manager->replicate();$corporate->name='Corporate viewer';$corporate->email='corporate@example.invalid';$corporate->position_id=$position;User::withoutEvents(fn()=>$corporate->save());
        $this->assertSame(0,app(TaskModuleAccess::class)->visible($corporate)->count());
        $this->assertSame(1,app(TaskModuleAccess::class)->visible($this->lead)->count());
    }
    public function test_collaborative_owner_cannot_close_an_empty_workflow(): void
    {
        [$root]=$this->writer->saveMany($this->manager,[[...$this->draft(9910),'template'=>'collaborative','assignee'=>$this->lead->name]]);
        $this->expectException(HttpException::class);
        $this->writer->saveMany($this->lead,[[...$root,'status'=>'Completed','submission'=>'No child work.']]);
    }
    public function test_parent_coordinator_owns_delegation_and_dependencies_block_starting(): void
    {
        [$root]=$this->writer->saveMany($this->manager,[[...$this->draft(9920),'template'=>'collaborative','assignee'=>$this->lead->name]]);
        $child=[...$this->draft(9921),'parentId'=>$root['id'],'due'=>'2026-10-28'];
        try{$this->writer->saveMany($this->manager,[$child]);$this->fail('Non-coordinator delegated.');}catch(HttpException $error){$this->assertSame(403,$error->getStatusCode());}
        [$first]=$this->writer->saveMany($this->lead,[$child]);
        [$second]=$this->writer->saveMany($this->lead,[[...$child,'id'=>9922,'due'=>'2026-10-29','dependsOn'=>[$first['id']]]]);
        try{$this->writer->saveMany($this->employee,[[...$second,'status'=>'In Progress']]);$this->fail('Unfinished prerequisite bypassed.');}catch(HttpException $error){$this->assertSame(422,$error->getStatusCode());}
        try{$this->writer->saveMany($this->lead,[[...$child,'id'=>9923,'due'=>$root['due']]]);$this->fail('Child deadline accepted.');}catch(HttpException $error){$this->assertSame(422,$error->getStatusCode());}
    }
    public function test_follow_up_can_be_sent_and_acknowledged_without_forging_sender(): void
    {
        [$task]=$this->writer->saveMany($this->manager,[$this->draft()]);
        $ping=['id'=>'ping-1','message'=>'Please update this task.','sender'=>'Forged','senderRole'=>'EVP','assignee'=>$this->employee->name,'createdAt'=>'2001-01-01','acknowledgedAt'=>null];
        [$sent]=$this->writer->saveMany($this->lead,[[...$task,'pings'=>[$ping]]]);
        $this->assertSame($this->lead->name,$sent['pings'][0]['sender']);
        [$acknowledged]=$this->writer->saveMany($this->employee,[[...$sent,'pings'=>[[...$sent['pings'][0],'acknowledgedAt'=>'2001-01-01','acknowledgedBy'=>'Forged']]]]);
        $this->assertSame($this->employee->name,$acknowledged['pings'][0]['acknowledgedBy']);
        $this->assertNotSame('2001-01-01',$acknowledged['pings'][0]['acknowledgedAt']);
    }

    public function test_deleting_parent_also_deletes_server_children_missing_from_request(): void
    {
        [$root]=$this->writer->saveMany($this->manager,[[...$this->draft(9930),'template'=>'collaborative','assignee'=>$this->lead->name]]);
        $this->writer->saveMany($this->lead,[[...$this->draft(9931),'parentId'=>$root['id'],'due'=>'2026-10-29']]);
        $request=\Illuminate\Http\Request::create('/task-module/records','DELETE',['keys'=>[$root['_serverKey']]]);
        $request->setUserResolver(fn()=>$this->lead);
        (new \App\Http\Controllers\TaskModuleController)->destroy($request,app(TaskModuleAccess::class));
        $this->assertSame(0,TaskModuleRecord::count());
        $this->assertSame(2,TaskModuleRecord::onlyTrashed()->count());
    }
    public function test_final_workflow_needs_all_child_submissions_and_can_request_revision_before_closing(): void
    {
        [$root]=$this->writer->saveMany($this->manager,[[...$this->draft(9940),'template'=>'collaborative','assignee'=>$this->lead->name]]);
        [$child]=$this->writer->saveMany($this->lead,[[...$this->draft(9941),'parentId'=>$root['id'],'due'=>'2026-10-29']]);
        [$submission]=$this->writer->saveMany($this->employee,[[...$child,'status'=>'Pending Review','submission'=>'Work completed.']]);
        [$approved]=$this->writer->saveMany($this->lead,[[...$submission,'status'=>'Completed']]);
        [$revision]=$this->writer->saveMany($this->lead,[[...$approved,'status'=>'Revision Needed','remarks'=>'Please add evidence.']]);
        $this->assertSame('Revision Needed',$revision['status']);
        try{$this->writer->saveMany($this->lead,[[...$root,'status'=>'Completed','submission'=>'Consolidated output']]);$this->fail('Parent closed before revision.');}catch(HttpException $error){$this->assertSame(422,$error->getStatusCode());}
        [$resubmitted]=$this->writer->saveMany($this->employee,[[...$revision,'status'=>'Pending Review','submission'=>'Evidence added.']]);
        $this->writer->saveMany($this->lead,[[...$resubmitted,'status'=>'Completed']]);
        [$closed]=$this->writer->saveMany($this->lead,[[...$root,'status'=>'Completed','submission'=>'Consolidated output']]);
        $this->assertSame('Completed',$closed['status']);
        $this->assertNotEmpty($closed['submittedAt']);
    }

    public function test_http_payload_round_trip_preserves_metadata_and_accepts_employee_submission(): void
    {
        $save=function(User $actor,array $task){
            $request=\Illuminate\Http\Request::create('/task-module/records','POST',['tasks'=>[$task]]);
            $request->setUserResolver(fn()=>$actor);
            return (new \App\Http\Controllers\TaskModuleController)->store($request,$this->writer)->getData(true)['records'][0];
        };
        $created=$save($this->lead,$this->draft());
        $this->assertSame('Medium',$created['priority']);
        $approved=$save($this->manager,[...$created,'status'=>'Not Started']);
        $submitted=$save($this->employee,[...$approved,'status'=>'Pending Review','submission'=>'Actual browser payload.','submittedAt'=>'2001-01-01']);
        $this->assertSame('Pending Review',$submitted['status']);
        $this->assertSame('Assigned task',$submitted['kind']);
        $this->assertNotEmpty($submitted['submittedAt']);
    }

}
