<?php
namespace App\Support;
use Carbon\CarbonImmutable;

class TaskScoreCalculator
{
    public const SCALE = 1000000;
    public static function allocations(array $owner, array $transfers, float $percent): array {
        // Reserve one fixed pool, shared equally by distinct accepted recipients.
        // Returning to an earlier owner never creates another share or reduces the original owner's share.
        $ownerKey=(string)$owner['id']; $recipients=[]; $current=$ownerKey;
        foreach ($transfers as $transfer) {
            if ((string)$transfer['from']['id'] !== $current) throw new \RuntimeException('Handover owner evidence is inconsistent.');
            $current=(string)$transfer['to']['id'];
            if ($current !== $ownerKey) $recipients[$current] ??= $transfer['to'];
        }
        if (!$recipients) return [$owner + ['units'=>self::SCALE]];
        $pool=(int)round(self::SCALE*$percent/100);
        $shares=[$owner + ['units'=>self::SCALE-$pool]];
        // Assign residual micro-shares in first-acceptance order so the total stays exactly 100%.
        $each=intdiv($pool,count($recipients)); $remainder=$pool%count($recipients);
        foreach (array_values($recipients) as $i=>$recipient) $shares[]=$recipient + ['units'=>$each+($i<$remainder?1:0)];
        return $shares;
    }
    public static function calculate(array $task, array $evidence, array $policy, bool $hasChildren = false): array {
        $pointModel=($policy['model'] ?? '')==='points_10';
        $submissions = $evidence['submissions'] ?? []; $last = $submissions ? end($submissions) : null;
        $returns = count($evidence['returns'] ?? []);
        $priority = $evidence['completion_priority'] ?? ($task['priority'] ?? '');
        $reason = null;
        if (($task['status'] ?? '') !== 'Completed') $reason = 'not_completed';
        elseif (!empty($task['sample']) || !empty($task['sampleKey']) || str_starts_with($task['id'] ?? '', 'leaderboard-demo-') || str_starts_with($task['title'] ?? '', '[Sample]')
            || in_array($task['template'] ?? '', ['it-opening-rounds','narrative-report','daily-operations','intern-weekly-report']) || str_starts_with($task['template'] ?? '', 'daily-custom-')) $reason = 'excluded_report_or_sample';
        elseif ($hasChildren || (($task['template'] ?? '') === 'collaborative' && empty($task['parentId']))) $reason = 'excluded_coordination';
        elseif (!$pointModel && $priority === 'Low') $reason = 'excluded_low';
        elseif (empty($evidence['complete']) || !$last || empty($evidence['owner']['id']) || empty($evidence['approved_at']) || empty($task['due']) || !in_array($priority, $pointModel?['Critical','High','Medium','Low']:['Critical','High','Medium'])) $reason = 'incomplete_records';
        // Old percentage policies remain reproducible until an explicit audited recalculation.
        $returnScore=$pointModel?0:max(0,20-$returns*$policy['return_deduction']);
        if($pointModel) foreach($policy['return_brackets'] as $bracket){if($bracket['max_returns']===null || $returns<=$bracket['max_returns']){$returnScore=$bracket['score'];break;}}
        $result = ['scoring_model'=>$pointModel?'points_10':'percentage_v1', 'maximum_points'=>$pointModel?10:1, 'allocation_mode'=>$policy['allocation_mode'] ?? 'equal_pool', 'allocation_rule'=>($policy['allocation_mode'] ?? '')==='final_completer'?'final_completer_v1':'equal_handover_pool_v2', 'eligible'=>false, 'reason'=>$reason, 'task_id'=>$task['taskCode'] ?? $task['id'] ?? '', 'title'=>$task['title'] ?? '',
            'priority'=>$priority, 'deadline'=>$task['due'] ?? null, 'submission_at'=>$last['at'] ?? null, 'submissions'=>$submissions,
            'returns'=>$evidence['returns'] ?? [], 'return_count'=>$returns, 'return_deduction'=>($pointModel?1:20)-$returnScore,
            'scores'=>$pointModel?['time'=>0,'priority'=>0,'returns'=>0]:['time'=>0,'priority'=>0,'returns'=>0,'ownership'=>0], 'percentage'=>0, 'earned_units'=>0,
            'allocations'=>[], 'transfers'=>$evidence['transfers'] ?? [], 'review_flags'=>$evidence['flags'] ?? [], 'approved_at'=>$evidence['approved_at'] ?? null];
        if ($reason) return $result;
        try {
            $deadline = CarbonImmutable::parse($task['due'], 'Asia/Manila')->endOfDay();
            $submitted = CarbonImmutable::parse($last['at']);
            $late = max(0, $submitted->getTimestamp() - $deadline->getTimestamp());
        } catch (\Throwable $e) { $result['reason']='incomplete_records'; return $result; }
        $time = $pointModel?2:30;
        if ($late > 0) foreach ($policy['lateness'] as $bracket) {
            if ($bracket['max_hours'] === null || $late <= $bracket['max_hours']*3600) { $time=$bracket['score']; break; }
        }
        $scores = $pointModel ? ['time'=>$time,'priority'=>$policy['priority_scores'][$priority],'returns'=>$returnScore]
            : ['time'=>$time,'priority'=>['Critical'=>30,'High'=>24,'Medium'=>18][$priority],'returns'=>$returnScore,'ownership'=>20];
        $total = array_sum($scores);
        $percentage=$pointModel?$total/10*100:$total;
        // Ten-point policies award their raw sum, without dividing the points by 100.
        $earned = (int)round(($pointModel?$total:$total/100)*self::SCALE);
        if(($policy['allocation_mode'] ?? '')==='final_completer') {
            $transfers=$evidence['transfers'] ?? [];
            $person=$evidence['completer'] ?? ($transfers ? end($transfers)['to'] : $evidence['owner']);
            $shares=[$person+['units'=>self::SCALE]];
        } else $shares = self::allocations($evidence['owner'], $evidence['transfers'] ?? [], $policy['handover_percent']);
        // Allocate whole micro-points by largest remainder; never round shares independently.
        $used=0;
        foreach ($shares as &$share) { $raw=$earned*$share['units']; $share['awarded_units']=(int)floor($raw/self::SCALE); $share['remainder']=$raw%self::SCALE; $used+=$share['awarded_units']; }
        unset($share);
        $order=array_keys($shares); usort($order,fn($a,$b)=>$shares[$b]['remainder']<=>$shares[$a]['remainder'] ?: $shares[$a]['id']<=>$shares[$b]['id']);
        for ($i=0;$i<$earned-$used;$i++) $shares[$order[$i]]['awarded_units']++;
        foreach ($shares as &$share) unset($share['remainder']); unset($share);
        return [...$result,'eligible'=>true,'reason'=>null,'lateness_seconds'=>$late,'scores'=>$scores,'percentage'=>$percentage,'earned_units'=>$earned,'allocations'=>$shares];
    }
}
