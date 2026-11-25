<?php
namespace Tests\Feature;
use Tests\TestCase;
use App\Models\{User,Ticket,TicketPriority};
use App\Services\{TicketSla,TicketResolutionScore,TicketLeaderboard};
use Illuminate\Support\Facades\{DB,Schema,Notification};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;

class TicketPriorityScoringTest extends TestCase {
    private User $leader;
    private User $member;
    protected function setUp(): void {
        parent::setUp();
        foreach(['roles','positions','departments','branches'] as $name) Schema::create($name,function(Blueprint $t){$t->id();$t->string('name');$t->timestamps();});
        Schema::create('users',function(Blueprint $t){$t->id();foreach(['name','email','password','status'] as $key)$t->string($key)->nullable();foreach(['role_id','position_id','department_id','branch_id'] as $key)$t->unsignedBigInteger($key)->nullable();$t->timestamps();});
        Schema::create('branch_user',fn(Blueprint $t)=>[$t->unsignedBigInteger('user_id'),$t->unsignedBigInteger('branch_id')]);
        Schema::create('ticket_preview_users',fn(Blueprint $t)=>$t->unsignedBigInteger('user_id'));
        Schema::create('tickets',function(Blueprint $t){$t->id();foreach(['creator_id','assigned_to','branch_id','ticket_location_id'] as $key)$t->unsignedBigInteger($key)->nullable();foreach(['subject','employee_name','description','category','status','priority','ticket_code'] as $key)$t->string($key)->nullable();$t->boolean('is_preview')->default(true);$t->json('sla_state')->nullable();$t->json('sla_policy')->nullable();$t->timestamp('sla_received_at')->nullable();$t->timestamp('closed_at')->nullable();$t->timestamps();});
        Schema::create('ticket_activities',function(Blueprint $t){$t->id();$t->unsignedBigInteger('ticket_id');$t->unsignedBigInteger('actor_id')->nullable();$t->string('type');$t->text('message');$t->json('details')->nullable();$t->timestamp('created_at');});
        (require database_path('migrations/2026_11_12_000001_create_ticket_priorities_table.php'))->up();
        Schema::table('ticket_priorities',fn(Blueprint $t)=>$t->timestamp('archived_at')->nullable());
        (require database_path('migrations/2026_11_24_000001_add_ticket_priority_scoring.php'))->up();
        (require database_path('migrations/2026_11_24_000002_add_ticket_completion_scoring.php'))->up();
        DB::table('roles')->insert(['id'=>1,'name'=>'employee']);DB::table('branches')->insert(['id'=>1,'name'=>'Makati']);DB::table('departments')->insert(['id'=>1,'name'=>'IT']);
        $make=function($name,$position){$pid=DB::table('positions')->insertGetId(['name'=>$position]);$u=User::withoutEvents(fn()=>User::create(['name'=>$name,'email'=>$name.'@example.invalid','password'=>'test','status'=>'Active','role_id'=>1,'position_id'=>$pid,'department_id'=>1,'branch_id'=>1]));DB::table('ticket_preview_users')->insert(['user_id'=>$u->id]);return $u;};
        $this->leader=$make('Lead','IT Team Leader');$this->member=$make('Member','IT Associate');
        Notification::fake();$this->travelTo(\Carbon\Carbon::parse('2026-11-24 10:00:00','Asia/Manila'));
    }
    private function ticket(string $priority='low'): Ticket {
        $id=DB::table('tickets')->insertGetId(['creator_id'=>$this->member->id,'assigned_to'=>$this->member->id,'branch_id'=>1,'subject'=>'Test service','employee_name'=>'Member','description'=>'Issue','category'=>'Hardware','status'=>'in_progress','priority'=>$priority,'ticket_code'=>'TEST-'.uniqid(),'is_preview'=>true,'created_at'=>now(),'updated_at'=>now()]);
        $ticket=Ticket::findOrFail($id);app(TicketSla::class)->enroll($ticket,$this->member,now()->utc());
        app(TicketSla::class)->apply($ticket,$this->member,'member',['action'=>'acknowledge','assessment'=>'Confirmed','next_steps'=>'Fix']);return $ticket->fresh();
    }
    private function resolve(Ticket $t,?string $priority=null): Ticket {
        $data=['action'=>'save','status'=>'resolved','findings'=>'Cause identified','resolution_details'=>'Fixed and verified'];
        if($priority)$data+=['priority'=>$priority,'priority_reason'=>'Supervisor corrected intake priority.'];
        DB::transaction(fn()=>app(TicketSla::class)->apply($t,$priority?$this->leader:$this->member,$priority?'leader':'member',$data));return $t->fresh();
    }
    public function test_defaults_and_priority_at_resolution_are_frozen(): void {
        $this->assertSame(['critical'=>7,'high'=>4,'medium'=>2,'low'=>0],TicketPriority::orderBy('sort_order')->pluck('score_points','key')->all());
        $t=$this->resolve($this->ticket(),'critical');$score=$t->sla_state['resolution_score'];$this->assertSame('critical',$score['priority']);$this->assertSame(10,$score['points']);
        DB::transaction(fn()=>app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'save','priority'=>'low','priority_reason'=>'Later edit']));
        TicketPriority::where('key','critical')->update(['score_points'=>99]);$this->assertSame($score,$t->fresh()->sla_state['resolution_score']);
        $rows=collect(app(TicketLeaderboard::class)->summary(true)['members'])->keyBy('id');$this->assertSame(10,$rows[$this->leader->id]['points']);$this->assertSame(0,$rows[$this->member->id]['points']);
        $this->assertSame(10,app(TicketLeaderboard::class)->summary(true)['total_points']);
    }
    public function test_reopen_suspends_then_replaces_award_and_duplicate_save_does_not_add_points(): void {
        $t=$this->resolve($this->ticket('high'));$this->assertSame(7,$t->sla_state['resolution_score']['points']);
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'reopen','note'=>'Issue recurred']);$t=$t->fresh();$this->assertArrayNotHasKey('resolution_score',$t->sla_state);$this->assertSame(0,app(TicketLeaderboard::class)->summary(true)['total_points']);
        $t=$this->resolve($t,'medium');$this->assertSame(5,$t->sla_state['resolution_score']['points']);
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'save']);$this->assertSame(5,app(TicketLeaderboard::class)->summary(true)['total_points']);
        $t->status='rejected';$t->save();$this->assertSame(0,app(TicketLeaderboard::class)->summary(true)['total_points']);
    }
    public function test_backfill_recovers_old_priority_from_history_and_is_idempotent(): void {
        $t=$this->resolve($this->ticket('high'));$state=$t->sla_state;unset($state['resolution_score']);$t->sla_state=$state;$t->save();
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'save','priority'=>'low','priority_reason'=>'After resolution']);
        DB::transaction(fn()=>TicketResolutionScore::backfill($t));$this->assertSame(7,$t->fresh()->sla_state['resolution_score']['points']);$this->assertSame('high',$t->fresh()->sla_state['resolution_score']['priority']);
        TicketResolutionScore::backfill($t);$this->assertSame(1,$t->activities()->where('type','resolution_score_backfilled')->count());
    }
    public function test_supervisor_only_settings_validate_points_and_store_description(): void {
        $controller=app(\App\Http\Controllers\TicketPriorityController::class);$p=TicketPriority::where('key','high')->first();
        $request=function(User $user,$points){$r=Request::create('/tickets/admin/priorities','POST',['label'=>'High','sort_order'=>2,'response_hours'=>1,'resolution_hours'=>4,'update_hours'=>null,'score_points'=>$points,'time_completion_points'=>3,'description'=>'Business service impaired']);$r->setUserResolver(fn()=>$user);$r->setLaravelSession(app('session')->driver());return $r;};
        try{$controller->update($request($this->member,6),$p);$this->fail('Member could edit settings');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(403,$e->getStatusCode());}
        foreach([-1,1.5,8] as $invalid){try{$controller->update($request($this->leader,$invalid),$p);$this->fail('Invalid points accepted');}catch(\Illuminate\Validation\ValidationException $e){$this->assertArrayHasKey('score_points',$e->errors());}}
        $controller->update($request($this->leader,6),$p);$this->assertSame(6,$p->fresh()->score_points);$this->assertSame('Business service impaired',\App\Services\TicketPrioritySettings::targets(true)['high']['description']);
        $t=$this->resolve($this->ticket('high'));$this->assertSame(9,$t->sla_state['resolution_score']['points']);
    }

    public function test_points_rank_separately_from_counts_and_exported_details_match(): void {
        $this->resolve($this->ticket('critical'));
        $this->resolve($this->ticket('low'),'low');$this->resolve($this->ticket('low'),'low');
        $service=app(TicketLeaderboard::class);$summary=$service->summary(true);
        $this->assertSame($this->member->id,$summary['members'][0]['id']);$this->assertSame(10,$summary['members'][0]['points']);$this->assertSame(1,$summary['members'][0]['resolved']);
        $this->assertSame(16,$summary['total_points']);$this->assertSame(3,$summary['total_resolved']);
        $detail=$service->summary(true,'all',$this->member->id,'resolved');$this->assertSame(10,$detail['detail']['entries'][0]['ticket']->sla_state['resolution_score']['points']);
        $mock=\Mockery::mock(\App\Services\TicketWorkbook::class);$mock->shouldReceive('download')->once()->withArgs(function($sheets,$file){return in_array('Leaderboard points',$sheets['Leaderboard'][0],true)&&$sheets['Leaderboard'][1][4]===10;})->andReturn('summary-export');app()->instance(\App\Services\TicketWorkbook::class,$mock);
        $this->assertSame('summary-export',$service->export($summary,true));
        $this->travelTo(now()->addMonth());$this->assertSame(0,$service->summary(true,'day')['total_points']);
    }
    public function test_custom_priority_score_applies_and_archival_preserves_completed_award(): void {
        TicketPriority::create(['key'=>'custom','label'=>'Custom','response_seconds'=>900,'resolution_seconds'=>3600,'update_seconds'=>null,'sort_order'=>5,'score_points'=>7,'description'=>'Special service']);
        $t=$this->resolve($this->ticket('custom'));$this->assertSame(10,$t->sla_state['resolution_score']['points']);
        TicketPriority::where('key','custom')->update(['archived_at'=>now(),'score_points'=>0]);
        $this->assertSame(10,app(TicketLeaderboard::class)->summary(true)['total_points']);
        $this->assertArrayNotHasKey('custom',\App\Services\TicketPrioritySettings::targets(true));
    }
    public function test_missing_historical_evidence_is_unscored_and_closure_preserves_award(): void {
        $t=$this->resolve($this->ticket('medium'));$award=$t->sla_state['resolution_score'];
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'close','note'=>'Verified']);$this->assertSame($award,$t->fresh()->sla_state['resolution_score']);
        $t->sla_state=[];$t->save();$t->activities()->delete();TicketResolutionScore::backfill($t);
        $summary=app(TicketLeaderboard::class)->summary(true);$this->assertSame(0,$summary['total_points']);
        $this->assertArrayNotHasKey('resolution_score',$t->fresh()->sla_state);
    }

    public function test_calendar_time_boundaries_and_low_completion_points(): void {
        $deadline=\Carbon\CarbonImmutable::parse('2026-11-24T11:00:00Z');
        foreach([-1=>3,0=>3,1=>2,86400=>2,86401=>1,172800=>1,172801=>0] as $seconds=>$time){
            foreach(['critical'=>7,'high'=>4,'medium'=>2,'low'=>0] as $priority=>$points){
                $s=TicketResolutionScore::capture($priority,$this->member->id,$deadline->addSeconds($seconds)->toIso8601String(),$deadline->toIso8601String());
                $this->assertSame($time,$s['time_points']);$this->assertSame($points+$time,$s['points']);$this->assertSame('calendar_hours',$s['lateness_basis']);
            }
        }
        $s=TicketResolutionScore::capture('critical',$this->member->id,'2026-11-25T00:00:00Z',$deadline->toIso8601String());$this->assertSame(13*3600,$s['lateness_seconds']);$this->assertSame(2,$s['time_points']);
    }
    public function test_priority_correction_changes_deadline_before_resolution_and_freezes_breakdown(): void {
        $t=$this->ticket('low');$this->travelTo(now()->addHours(10));$t=$this->resolve($t,'critical');$s=$t->sla_state['resolution_score'];
        $this->assertSame(7,$s['priority_points']);$this->assertSame(2,$s['time_points']);$this->assertSame(9,$s['points']);
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'save','priority'=>'low','priority_reason'=>'Later correction']);
        $this->assertSame($s,$t->fresh()->sla_state['resolution_score']);
    }
    public function test_missing_deadline_receives_no_invented_time_points_and_custom_cap_is_respected(): void {
        $s=TicketResolutionScore::capture('critical',$this->member->id,now()->toIso8601String());$this->assertSame(7,$s['points']);$this->assertSame('missing_deadline',$s['time_evidence']);
        TicketPriority::where('key','critical')->update(['time_completion_points'=>2]);
        $s=TicketResolutionScore::capture('critical',$this->member->id,'2026-11-24T12:00:00Z','2026-11-24T11:00:00Z');$this->assertSame(1,$s['time_points']);$this->assertSame(8,$s['points']);
    }
    public function test_existing_priority_only_snapshot_upgrades_once_with_audit(): void {
        $t=$this->resolve($this->ticket('critical'));$state=$t->sla_state;
        $state['resolution_score']=['priority'=>'critical','label'=>'Critical','points'=>20,'resolved_by'=>$this->member->id,'resolved_at'=>$state['resolved_at']];$t->sla_state=$state;$t->save();
        TicketResolutionScore::backfill($t,true);TicketResolutionScore::backfill($t,true);$s=$t->fresh()->sla_state['resolution_score'];$this->assertSame(10,$s['points']);$this->assertSame(1,$t->activities()->where('type','resolution_score_recalculated')->count());
        $this->assertSame(20,$t->activities()->where('type','resolution_score_recalculated')->first()->details['before']['points']);
    }

    public function test_revision_hold_does_not_consume_resolution_allowance(): void {
        $t=$this->ticket('critical');$this->travelTo(now()->addHour());
        app(TicketSla::class)->holdForReview($t);$t->status='revision_requested';$t->save();app(TicketSla::class)->activity($t,$this->leader,'revision_requested','Please correct details.');
        $this->travelTo(now()->addDays(3));app(TicketSla::class)->resumeAfterRevision($t);$t->status='in_progress';$t->save();app(TicketSla::class)->activity($t,$this->member,'revision_submitted','Corrected.');
        $this->travelTo(now()->addHour());$t=$this->resolve($t);$this->assertSame(3,$t->sla_state['resolution_score']['time_points']);$this->assertSame(10,$t->sla_state['resolution_score']['points']);
    }

    public function test_time_completion_setting_rejects_out_of_range_and_fractional_points(): void {
        $controller=app(\App\Http\Controllers\TicketPriorityController::class);$priority=TicketPriority::where('key','high')->first();
        foreach([-1,4,1.5] as $invalid){
            $r=Request::create('/tickets/admin/priorities','POST',['label'=>'High','sort_order'=>2,'response_hours'=>1,'resolution_hours'=>4,'update_hours'=>null,'score_points'=>4,'time_completion_points'=>$invalid]);$r->setUserResolver(fn()=>$this->leader);$r->setLaravelSession(app('session')->driver());
            try{$controller->update($r,$priority);$this->fail('Invalid time points accepted.');}catch(\Illuminate\Validation\ValidationException $e){$this->assertArrayHasKey('time_completion_points',$e->errors());}
        }
    }
}
