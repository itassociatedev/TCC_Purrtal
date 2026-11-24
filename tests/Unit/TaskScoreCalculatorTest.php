<?php
namespace Tests\Unit;
use PHPUnit\Framework\TestCase;
use App\Support\TaskScoreCalculator as Score;
class TaskScoreCalculatorTest extends TestCase
{
    private function task(array $changes=[]): array { return [...['id'=>1,'taskCode'=>'IT-1126-00001','title'=>'Check service','template'=>'standard','priority'=>'Critical','status'=>'Completed','due'=>'2026-11-20'],...$changes]; }
    private function evidence(array $changes=[]): array { return [...['complete'=>true,'owner'=>['id'=>1,'name'=>'A','department'=>'IT','branch'=>'Makati'],'submissions'=>[['at'=>'2026-11-20T08:00:00Z','actor_id'=>1]],'returns'=>[],'transfers'=>[],'approved_at'=>'2026-11-25T08:00:00Z'],...$changes]; }
    private function policy(): array { return require __DIR__.'/../../config/task-scoring.php'; }
    public function test_time_uses_final_submission_and_strict_brackets(): void {
        foreach (['2026-11-20T15:59:59Z'=>30,'2026-11-21T15:59:59Z'=>15,'2026-11-21T16:00:00Z'=>6,'2026-11-23T15:59:59Z'=>6,'2026-11-23T16:00:00Z'=>0] as $at=>$expected) {
            $result=Score::calculate($this->task(),$this->evidence(['submissions'=>[['at'=>'2026-11-20T08:00:00Z'],['at'=>$at]]]),$this->policy());
            $this->assertSame($expected,$result['scores']['time']);
        }
    }
    public function test_priority_scores_and_low_excludes_every_allocation(): void {
        foreach (['Critical'=>1000000,'High'=>940000,'Medium'=>880000,'Low'=>0] as $priority=>$units) {
            $result=Score::calculate($this->task(['priority'=>$priority]),$this->evidence(),$this->policy());
            $this->assertSame($units,$result['earned_units']);
            if ($priority==='Low')$this->assertSame([],$result['allocations']);
        }
    }
    public function test_formal_returns_are_capped_and_do_not_use_approval_delay(): void {
        $r=Score::calculate($this->task(),$this->evidence(['returns'=>array_fill(0,7,['at'=>'x'])]),$this->policy());
        $this->assertSame(0,$r['scores']['returns']); $this->assertSame(20,$r['return_deduction']);$this->assertSame(30,$r['scores']['time']);
    }
    public function test_successive_transfers_preserve_shares_and_do_not_double_deduct(): void {
        $a=$this->evidence()['owner'];$b=[...$a,'id'=>2,'name'=>'B'];$c=[...$a,'id'=>3,'name'=>'C'];
        $r=Score::calculate($this->task(),$this->evidence(['transfers'=>[['from'=>$a,'to'=>$b],['from'=>$b,'to'=>$c]]]),$this->policy());
        $this->assertSame([500000,250000,250000],array_column($r['allocations'],'awarded_units'));
        $this->assertSame(20,$r['scores']['ownership']);
        for($i=0;$i<=100;$i++) {
            $p=[...$this->policy(),'handover_percent'=>$i/3];
            $r=Score::calculate($this->task(['priority'=>'Medium']),$this->evidence(['transfers'=>[['from'=>$a,'to'=>$b],['from'=>$b,'to'=>$c],['from'=>$c,'to'=>$a]]]),$p);
            $this->assertSame($r['earned_units'],array_sum(array_column($r['allocations'],'awarded_units')));
            $this->assertSame(1000000,array_sum(array_column($r['allocations'],'units')));
        }
    }
    public function test_fixed_pool_is_equal_for_three_recipients_and_does_not_reward_repeat_transfers(): void {
        $a=$this->evidence()['owner'];$b=[...$a,'id'=>2,'name'=>'B'];$c=[...$a,'id'=>3,'name'=>'C'];$d=[...$a,'id'=>4,'name'=>'D'];
        $transfers=[['from'=>$a,'to'=>$b],['from'=>$b,'to'=>$c],['from'=>$c,'to'=>$d]];
        $r=Score::calculate($this->task(),$this->evidence(['transfers'=>$transfers]),$this->policy());
        $this->assertSame([500000,166667,166667,166666],array_column($r['allocations'],'units'));
        $this->assertSame(1000000,array_sum(array_column($r['allocations'],'awarded_units')));
        $transfers[]=['from'=>$d,'to'=>$b];$transfers[]=['from'=>$b,'to'=>$a];
        $again=Score::allocations($a,$transfers,50);$this->assertSame([500000,166667,166667,166666],array_column($again,'units'));
        $this->assertCount(4,$again);
        $low=Score::calculate($this->task(['priority'=>'Low']),$this->evidence(['transfers'=>$transfers]),$this->policy());$this->assertSame([],$low['allocations']);
        $this->assertSame([1000000],array_column(Score::allocations($a,[],50),'units'));
    }
    public function test_unfinished_legacy_reports_sample_and_parent_receive_no_points(): void {
        foreach(['Pending Approval','Not Started','In Progress','Pending Review','Revision Needed','Denied','Dismissed'] as $status)$this->assertSame(0,Score::calculate($this->task(['status'=>$status]),$this->evidence(),$this->policy())['earned_units']);
        $this->assertSame('incomplete_records',Score::calculate($this->task(),$this->evidence(['complete'=>false]),$this->policy())['reason']);
        foreach(['narrative-report','daily-operations','intern-weekly-report','daily-custom-example','it-opening-rounds'] as $template)$this->assertSame(0,Score::calculate($this->task(['template'=>$template]),$this->evidence(),$this->policy())['earned_units']);
        $this->assertSame(0,Score::calculate($this->task(['title'=>'[Sample] Task']),$this->evidence(),$this->policy())['earned_units']);
        $this->assertSame(0,Score::calculate($this->task(['template'=>'collaborative']),$this->evidence(),$this->policy())['earned_units']);
        $this->assertSame(1000000,Score::calculate($this->task(['template'=>'collaborative','parentId'=>9]),$this->evidence(),$this->policy())['earned_units']);
        $this->assertSame(0,Score::calculate($this->task(['parentId'=>9]),$this->evidence(),$this->policy(),true)['earned_units']);
    }
}
