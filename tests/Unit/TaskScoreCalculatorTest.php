<?php
namespace Tests\Unit;
use PHPUnit\Framework\TestCase;
use App\Support\TaskScoreCalculator as Score;
class TaskScoreCalculatorTest extends TestCase {
 private function task(array $c=[]): array {return [...['id'=>1,'title'=>'Service check','template'=>'standard','status'=>'Completed','priority'=>'Critical','due'=>'2026-11-20'],...$c];}
 private function evidence(array $c=[]): array {return [...['complete'=>true,'owner'=>['id'=>1,'name'=>'A'],'submissions'=>[['at'=>'2026-11-20T08:00:00Z']],'returns'=>[],'transfers'=>[],'approved_at'=>'2026-11-25T08:00:00Z'],...$c];}
 private function policy(): array {return require __DIR__.'/../../config/task-scoring.php';}
 public function test_time_boundaries_use_final_submission_not_approval(): void {
  foreach(['2026-11-20T15:59:59Z'=>2,'2026-11-20T16:00:00Z'=>1,'2026-11-21T15:59:59Z'=>1,'2026-11-22T15:59:59Z'=>1,'2026-11-22T16:00:00Z'=>0] as $at=>$score){
   $r=Score::calculate($this->task(),$this->evidence(['submissions'=>[['at'=>'2026-11-20T08:00:00Z'],['at'=>$at]]]),$this->policy());$this->assertSame($score,$r['scores']['time']);$this->assertSame(($score+8)*1000000,$r['earned_units']);
  }
 }
 public function test_each_priority_is_raw_points_including_low(): void {
  foreach(['Critical'=>10,'High'=>7,'Medium'=>5,'Low'=>3] as $priority=>$total){$r=Score::calculate($this->task(['priority'=>$priority]),$this->evidence(),$this->policy());$this->assertSame($total*1000000,$r['earned_units']);$this->assertTrue($r['eligible']);$this->assertSame(10,$r['maximum_points']);$this->assertArrayNotHasKey('ownership',$r['scores']);}
 }
 public function test_return_brackets_count_formal_actions(): void {
  foreach([0=>1,1=>0.5,2=>0.5,3=>0,8=>0] as $count=>$score){$r=Score::calculate($this->task(),$this->evidence(['returns'=>array_fill(0,$count,['at'=>'2026-11-20'])]),$this->policy());$this->assertSame($score,$r['scores']['returns']);$this->assertEquals(1-$score,$r['return_deduction']);$this->assertEquals((9+$score)*1000000,$r['earned_units']);}
 }
 public function test_all_points_follow_final_completer_after_successive_and_returning_handovers(): void {
  $a=['id'=>1,'name'=>'A'];$b=['id'=>2,'name'=>'B'];$c=['id'=>3,'name'=>'C'];$transfers=[['from'=>$a,'to'=>$b],['from'=>$b,'to'=>$c]];
  $r=Score::calculate($this->task(),$this->evidence(['transfers'=>$transfers,'completer'=>$c]),$this->policy());$this->assertSame([3],array_column($r['allocations'],'id'));$this->assertSame([10000000],array_column($r['allocations'],'awarded_units'));
  $transfers[]=['from'=>$c,'to'=>$a];$r=Score::calculate($this->task(),$this->evidence(['transfers'=>$transfers,'completer'=>$a]),$this->policy());$this->assertSame([1],array_column($r['allocations'],'id'));$this->assertSame($r['earned_units'],array_sum(array_column($r['allocations'],'awarded_units')));
 }
 public function test_legacy_policies_and_equal_pool_allocations_remain_reproducible(): void {
  $a=['id'=>1,'name'=>'A'];$b=['id'=>2,'name'=>'B'];$c=['id'=>3,'name'=>'C'];$old=['lateness'=>[['max_hours'=>24,'score'=>15],['max_hours'=>72,'score'=>6],['max_hours'=>null,'score'=>0]],'return_deduction'=>5,'handover_percent'=>50];
  $r=Score::calculate($this->task(['priority'=>'High']),$this->evidence(['returns'=>[['at'=>'x']],'transfers'=>[['from'=>$a,'to'=>$b]]]),$old);$this->assertSame(890000,$r['earned_units']);$this->assertSame([445000,445000],array_column($r['allocations'],'awarded_units'));
  $this->assertSame(0,Score::calculate($this->task(['priority'=>'Low']),$this->evidence(),$old)['earned_units']);
  for($i=0;$i<=100;$i++){$policy=[...$this->policy(),'allocation_mode'=>'equal_pool','handover_percent'=>$i/3];$r=Score::calculate($this->task(),$this->evidence(['transfers'=>[['from'=>$a,'to'=>$b],['from'=>$b,'to'=>$c],['from'=>$c,'to'=>$a]]]),$policy);$this->assertSame($r['earned_units'],array_sum(array_column($r['allocations'],'awarded_units')));$this->assertSame(1000000,array_sum(array_column($r['allocations'],'units')));}
 }
 public function test_unfinished_missing_history_reports_samples_and_parent_are_unscored(): void {
  foreach(['Pending Approval','Not Started','In Progress','Pending Review','Revision Needed','Denied','Dismissed'] as $status)$this->assertSame(0,Score::calculate($this->task(['status'=>$status]),$this->evidence(),$this->policy())['earned_units']);
  $this->assertSame('incomplete_records',Score::calculate($this->task(),$this->evidence(['complete'=>false]),$this->policy())['reason']);
  foreach(['narrative-report','daily-operations','intern-weekly-report','daily-custom-example','it-opening-rounds'] as $template)$this->assertSame(0,Score::calculate($this->task(['template'=>$template]),$this->evidence(),$this->policy())['earned_units']);
  $this->assertSame(0,Score::calculate($this->task(['sample'=>true]),$this->evidence(),$this->policy())['earned_units']);$this->assertSame(0,Score::calculate($this->task(['template'=>'collaborative']),$this->evidence(),$this->policy())['earned_units']);
  $this->assertSame(10000000,Score::calculate($this->task(['parentId'=>9]),$this->evidence(),$this->policy())['earned_units']);$this->assertSame(0,Score::calculate($this->task(['parentId'=>9]),$this->evidence(),$this->policy(),true)['earned_units']);
 }
}
