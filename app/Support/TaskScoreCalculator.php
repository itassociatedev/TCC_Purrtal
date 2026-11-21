<?php
namespace App\Support;
use Carbon\CarbonImmutable;

class TaskScoreCalculator
{
    public const SCALE = 1000000;
    public static function allocations(array $owner, array $transfers, float $percent): array {
        $shares = [(string)$owner['id'] => $owner + ['units'=>self::SCALE]];
        foreach ($transfers as $transfer) {
            $from = (string)$transfer['from']['id']; $to = (string)$transfer['to']['id'];
            if (!isset($shares[$from])) throw new \RuntimeException('Handover owner evidence is inconsistent.');
            $units = (int)floor($shares[$from]['units'] * $percent / 100);
            $shares[$from]['units'] -= $units;
            $shares[$to] ??= $transfer['to'] + ['units'=>0];
            $shares[$to]['units'] += $units;
        }
        return array_values($shares);
    }
    public static function calculate(array $task, array $evidence, array $policy, bool $hasChildren = false): array {
        $submissions = $evidence['submissions'] ?? []; $last = $submissions ? end($submissions) : null;
        $returns = count($evidence['returns'] ?? []);
        $priority = $evidence['completion_priority'] ?? ($task['priority'] ?? '');
        $reason = null;
        if (($task['status'] ?? '') !== 'Completed') $reason = 'not_completed';
        elseif (!empty($task['sample']) || !empty($task['sampleKey']) || str_starts_with($task['id'] ?? '', 'leaderboard-demo-') || str_starts_with($task['title'] ?? '', '[Sample]')
            || in_array($task['template'] ?? '', ['it-opening-rounds','narrative-report','daily-operations','intern-weekly-report']) || str_starts_with($task['template'] ?? '', 'daily-custom-')) $reason = 'excluded_report_or_sample';
        elseif ($hasChildren || (($task['template'] ?? '') === 'collaborative' && empty($task['parentId']))) $reason = 'excluded_coordination';
        elseif ($priority === 'Low') $reason = 'excluded_low';
        elseif (empty($evidence['complete']) || !$last || empty($evidence['owner']['id']) || empty($evidence['approved_at']) || empty($task['due']) || !in_array($priority, ['Critical','High','Medium'])) $reason = 'incomplete_records';
        $result = ['eligible'=>false, 'reason'=>$reason, 'task_id'=>$task['taskCode'] ?? $task['id'] ?? '', 'title'=>$task['title'] ?? '',
            'priority'=>$priority, 'deadline'=>$task['due'] ?? null, 'submission_at'=>$last['at'] ?? null, 'submissions'=>$submissions,
            'returns'=>$evidence['returns'] ?? [], 'return_count'=>$returns, 'return_deduction'=>min(20,$returns*$policy['return_deduction']),
            'scores'=>['time'=>0,'priority'=>0,'returns'=>0,'ownership'=>0], 'percentage'=>0, 'earned_units'=>0,
            'allocations'=>[], 'transfers'=>$evidence['transfers'] ?? [], 'review_flags'=>$evidence['flags'] ?? [], 'approved_at'=>$evidence['approved_at'] ?? null];
        if ($reason) return $result;
        try {
            $deadline = CarbonImmutable::parse($task['due'], 'Asia/Manila')->endOfDay();
            $submitted = CarbonImmutable::parse($last['at']);
            $late = max(0, $submitted->getTimestamp() - $deadline->getTimestamp());
        } catch (\Throwable $e) { $result['reason']='incomplete_records'; return $result; }
        $time = 30;
        if ($late > 0) foreach ($policy['lateness'] as $bracket) {
            if ($bracket['max_hours'] === null || $late <= $bracket['max_hours']*3600) { $time=$bracket['score']; break; }
        }
        $scores = ['time'=>$time, 'priority'=>['Critical'=>30,'High'=>24,'Medium'=>18][$priority], 'returns'=>max(0,20-$returns*$policy['return_deduction']), 'ownership'=>20];
        $percentage = array_sum($scores); $earned = (int)round($percentage/100*self::SCALE);
        $shares = self::allocations($evidence['owner'], $evidence['transfers'] ?? [], $policy['handover_percent']);
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
