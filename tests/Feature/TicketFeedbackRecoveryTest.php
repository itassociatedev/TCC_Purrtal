<?php
namespace Tests\Feature;
use Tests\TestCase;
use App\Models\{User,Ticket,TicketPriority};
use App\Services\{TicketSla,TicketResolutionScore,TicketLeaderboard};
use Illuminate\Support\Facades\{DB,Schema,Notification};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;

class TicketFeedbackRecoveryTest extends TestCase {
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
    private function employee(string $name='Requester'): User {
        $position=DB::table('positions')->insertGetId(['name'=>'Receptionist']);
        return User::withoutEvents(fn()=>User::create(['name'=>$name,'email'=>$name.'@example.invalid','password'=>'test','status'=>'Active','role_id'=>1,'position_id'=>$position,'department_id'=>1,'branch_id'=>1]));
    }
    private function closed(User $creator, User $resolver): Ticket {
        $id=DB::table('tickets')->insertGetId(['creator_id'=>$creator->id,'assigned_to'=>$resolver->id,'branch_id'=>1,'subject'=>'Review recovery','employee_name'=>$creator->name,'description'=>'Issue','category'=>'Hardware','status'=>'closed','priority'=>'medium','ticket_code'=>'REVIEW-'.uniqid(),'is_preview'=>false,'closed_at'=>now(),'created_at'=>now(),'updated_at'=>now(),'sla_state'=>json_encode(['resolved_by'=>$resolver->id])]);
        return Ticket::findOrFail($id);
    }
    private function action(User $actor,Ticket $ticket,array $data): void {
        $r=Request::create('/tickets/'.$ticket->id,'PATCH',$data);$r->setUserResolver(fn()=>$actor);$r->setLaravelSession(app('session')->driver());
        app(\App\Http\Controllers\TicketController::class)->update($r,$ticket->fresh());
    }
    public function test_skipping_allows_later_review_but_submission_removes_the_option_permanently(): void {
        $employee=$this->employee();$t=$this->closed($employee,$this->member);
        $this->assertTrue(\App\Services\TicketAccess::canLeaveFeedback($t,$employee));
        $this->action($employee,$t,['action'=>'dismiss_feedback']);$this->action($employee,$t,['action'=>'dismiss_feedback']);
        $this->assertSame(1,$t->activities()->where('type','feedback_dismissed')->count());$this->assertTrue(\App\Services\TicketAccess::canLeaveFeedback($t->fresh()->load('activities'),$employee));
        $this->action($employee,$t,['action'=>'feedback','rating'=>2.5,'note'=>'Please communicate sooner.']);
        $this->assertFalse(\App\Services\TicketAccess::canLeaveFeedback($t->fresh()->load('activities'),$employee));
        $this->action($employee,$t,['action'=>'feedback','rating'=>5,'note'=>'Duplicate attempt']);
        $this->assertSame(1,$t->activities()->where('type','feedback')->count());
        $event=$t->activities()->where('type','feedback')->first();$this->assertSame(2.5,$event->details['rating']);$this->assertSame($this->member->id,$event->details['resolved_by']);
        $t->status='in_progress';$t->save();$t->status='closed';$t->save();$this->assertFalse(\App\Services\TicketAccess::canLeaveFeedback($t->fresh(),$employee));
    }
    public function test_only_creator_and_closed_tickets_are_eligible(): void {
        $employee=$this->employee();$other=$this->employee('OtherRequester');$t=$this->closed($employee,$this->member);
        $this->assertFalse(\App\Services\TicketAccess::canLeaveFeedback($t,$other));
        try{$this->action($other,$t,['action'=>'feedback','rating'=>4]);$this->fail('Another requester rated the ticket.');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(403,$e->getStatusCode());}
        $t->status='resolved';$t->save();$this->assertFalse(\App\Services\TicketAccess::canLeaveFeedback($t,$employee));
        try{$this->action($employee,$t,['action'=>'feedback','rating'=>4]);$this->fail('Non-closed ticket rated.');}catch(\Illuminate\Validation\ValidationException $e){$this->assertArrayHasKey('action',$e->errors());}
        $this->assertSame(0,$t->activities()->where('type','feedback')->count());
    }
    public function test_it_peer_and_self_restrictions_still_apply_but_supervisor_can_review_member(): void {
        foreach([[$this->member,$this->member,false],[$this->member,$this->leader,true],[$this->leader,$this->member,true],[$this->leader,$this->leader,false]] as [$creator,$resolver,$allowed]){
            $t=$this->closed($creator,$resolver);$this->assertSame($allowed,\App\Services\TicketAccess::canLeaveFeedback($t,$creator));
        }
        $peer=User::withoutEvents(fn()=>User::create(['name'=>'Peer','email'=>'peer@example.invalid','password'=>'test','status'=>'Active','role_id'=>1,'position_id'=>$this->member->position_id,'department_id'=>1,'branch_id'=>1]));
        $t=$this->closed($this->member,$peer);$this->assertFalse(\App\Services\TicketAccess::canLeaveFeedback($t,$this->member));
        try{$this->action($this->member,$t,['action'=>'feedback','rating'=>4]);$this->fail('IT peer rated ticket.');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(403,$e->getStatusCode());}
        $t=$this->closed($this->leader,$this->member);$this->action($this->leader,$t,['action'=>'dismiss_feedback']);$this->action($this->leader,$t,['action'=>'feedback','rating'=>4.5]);$this->assertSame(1,$t->activities()->where('type','feedback')->count());
    }
    public function test_missing_resolver_is_not_reviewable(): void {
        $employee=$this->employee();$t=$this->closed($employee,$this->member);$t->sla_state=[];$t->save();
        $this->assertFalse(\App\Services\TicketAccess::canLeaveFeedback($t,$employee));
        try{$this->action($employee,$t,['action'=>'feedback','rating'=>4]);$this->fail('Ticket without resolver was rated.');}catch(\Illuminate\Validation\ValidationException $e){$this->assertArrayHasKey('rating',$e->errors());}
    }
}
