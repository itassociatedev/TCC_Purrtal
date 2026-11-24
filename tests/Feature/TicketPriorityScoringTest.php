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
        $this->assertSame(['critical'=>20,'high'=>10,'medium'=>5,'low'=>1],TicketPriority::orderBy('sort_order')->pluck('score_points','key')->all());
        $t=$this->resolve($this->ticket(),'critical');$score=$t->sla_state['resolution_score'];$this->assertSame('critical',$score['priority']);$this->assertSame(20,$score['points']);
        DB::transaction(fn()=>app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'save','priority'=>'low','priority_reason'=>'Later edit']));
        TicketPriority::where('key','critical')->update(['score_points'=>99]);$this->assertSame($score,$t->fresh()->sla_state['resolution_score']);
        $rows=collect(app(TicketLeaderboard::class)->summary(true)['members'])->keyBy('id');$this->assertSame(20,$rows[$this->leader->id]['points']);$this->assertSame(0,$rows[$this->member->id]['points']);
        $this->assertSame(20,app(TicketLeaderboard::class)->summary(true)['total_points']);
    }
    public function test_reopen_suspends_then_replaces_award_and_duplicate_save_does_not_add_points(): void {
        $t=$this->resolve($this->ticket('high'));$this->assertSame(10,$t->sla_state['resolution_score']['points']);
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'reopen','note'=>'Issue recurred']);$t=$t->fresh();$this->assertArrayNotHasKey('resolution_score',$t->sla_state);$this->assertSame(0,app(TicketLeaderboard::class)->summary(true)['total_points']);
        $t=$this->resolve($t,'medium');$this->assertSame(5,$t->sla_state['resolution_score']['points']);
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'save']);$this->assertSame(5,app(TicketLeaderboard::class)->summary(true)['total_points']);
        $t->status='rejected';$t->save();$this->assertSame(0,app(TicketLeaderboard::class)->summary(true)['total_points']);
    }
    public function test_backfill_recovers_old_priority_from_history_and_is_idempotent(): void {
        $t=$this->resolve($this->ticket('high'));$state=$t->sla_state;unset($state['resolution_score']);$t->sla_state=$state;$t->save();
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'save','priority'=>'low','priority_reason'=>'After resolution']);
        DB::transaction(fn()=>TicketResolutionScore::backfill($t));$this->assertSame(10,$t->fresh()->sla_state['resolution_score']['points']);$this->assertSame('high',$t->fresh()->sla_state['resolution_score']['priority']);
        TicketResolutionScore::backfill($t);$this->assertSame(1,$t->activities()->where('type','resolution_score_backfilled')->count());
    }
    public function test_supervisor_only_settings_validate_points_and_store_description(): void {
        $controller=app(\App\Http\Controllers\TicketPriorityController::class);$p=TicketPriority::where('key','high')->first();
        $request=function(User $user,$points){$r=Request::create('/tickets/admin/priorities','POST',['label'=>'High','sort_order'=>2,'response_hours'=>1,'resolution_hours'=>4,'update_hours'=>null,'score_points'=>$points,'description'=>'Business service impaired']);$r->setUserResolver(fn()=>$user);$r->setLaravelSession(app('session')->driver());return $r;};
        try{$controller->update($request($this->member,12),$p);$this->fail('Member could edit settings');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(403,$e->getStatusCode());}
        foreach([-1,1.5,1000001] as $invalid){try{$controller->update($request($this->leader,$invalid),$p);$this->fail('Invalid points accepted');}catch(\Illuminate\Validation\ValidationException $e){$this->assertArrayHasKey('score_points',$e->errors());}}
        $controller->update($request($this->leader,12),$p);$this->assertSame(12,$p->fresh()->score_points);$this->assertSame('Business service impaired',\App\Services\TicketPrioritySettings::targets(true)['high']['description']);
        $t=$this->resolve($this->ticket('high'));$this->assertSame(12,$t->sla_state['resolution_score']['points']);
    }

    public function test_points_rank_separately_from_counts_and_exported_details_match(): void {
        $this->resolve($this->ticket('critical'));
        $this->resolve($this->ticket('low'),'low');$this->resolve($this->ticket('low'),'low');
        $service=app(TicketLeaderboard::class);$summary=$service->summary(true);
        $this->assertSame($this->member->id,$summary['members'][0]['id']);$this->assertSame(20,$summary['members'][0]['points']);$this->assertSame(1,$summary['members'][0]['resolved']);
        $this->assertSame(22,$summary['total_points']);$this->assertSame(3,$summary['total_resolved']);
        $detail=$service->summary(true,'all',$this->member->id,'resolved');$this->assertSame(20,$detail['detail']['entries'][0]['ticket']->sla_state['resolution_score']['points']);
        $mock=\Mockery::mock(\App\Services\TicketWorkbook::class);$mock->shouldReceive('download')->once()->withArgs(function($sheets,$file){return in_array('Leaderboard points',$sheets['Leaderboard'][0],true)&&$sheets['Leaderboard'][1][4]===20;})->andReturn('summary-export');app()->instance(\App\Services\TicketWorkbook::class,$mock);
        $this->assertSame('summary-export',$service->export($summary,true));
        $this->travelTo(now()->addMonth());$this->assertSame(0,$service->summary(true,'day')['total_points']);
    }
    public function test_custom_priority_score_applies_and_archival_preserves_completed_award(): void {
        TicketPriority::create(['key'=>'custom','label'=>'Custom','response_seconds'=>900,'resolution_seconds'=>3600,'update_seconds'=>null,'sort_order'=>5,'score_points'=>7,'description'=>'Special service']);
        $t=$this->resolve($this->ticket('custom'));$this->assertSame(7,$t->sla_state['resolution_score']['points']);
        TicketPriority::where('key','custom')->update(['archived_at'=>now(),'score_points'=>0]);
        $this->assertSame(7,app(TicketLeaderboard::class)->summary(true)['total_points']);
        $this->assertArrayNotHasKey('custom',\App\Services\TicketPrioritySettings::targets(true));
    }
    public function test_missing_historical_evidence_is_unscored_and_closure_preserves_award(): void {
        $t=$this->resolve($this->ticket('medium'));$award=$t->sla_state['resolution_score'];
        app(TicketSla::class)->apply($t,$this->leader,'leader',['action'=>'close','note'=>'Verified']);$this->assertSame($award,$t->fresh()->sla_state['resolution_score']);
        $t->sla_state=[];$t->save();$t->activities()->delete();TicketResolutionScore::backfill($t);
        $summary=app(TicketLeaderboard::class)->summary(true);$this->assertSame(0,$summary['total_points']);
        $this->assertArrayNotHasKey('resolution_score',$t->fresh()->sla_state);
    }
}
