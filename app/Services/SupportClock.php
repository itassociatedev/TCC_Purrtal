<?php

namespace App\Services;

use Carbon\CarbonImmutable;

class SupportClock
{
    public function __construct(private array $policy) {}

    private function date($value): CarbonImmutable
    {
        return CarbonImmutable::parse($value)->setTimezone($this->policy['timezone']);
    }

    // Every day, including holidays, has the same support window. Intersecting
    // each day's window avoids counting nights and handles after-hours receipt.
    public function seconds($from, $to): int
    {
        $from = $this->date($from);
        $to = $this->date($to);
        if ($to <= $from) return 0;
        $total = 0;
        for ($day = $from->startOfDay(); $day <= $to->startOfDay(); $day = $day->addDay()) {
            $start = max($from->timestamp, $day->setTimeFromTimeString($this->policy['opens'])->timestamp);
            $end = min($to->timestamp, $day->setTimeFromTimeString($this->policy['closes'])->timestamp);
            $total += max(0, $end - $start);
        }
        return $total;
    }

    public function deadline($from, int $seconds): string
    {
        $cursor = $this->date($from);
        while (true) {
            $open = $cursor->setTimeFromTimeString($this->policy['opens']);
            $close = $cursor->setTimeFromTimeString($this->policy['closes']);
            if ($cursor < $open) $cursor = $open;
            if ($cursor >= $close) {
                $cursor = $cursor->addDay()->setTimeFromTimeString($this->policy['opens']);
                continue;
            }
            $available = $close->timestamp - $cursor->timestamp;
            if ($seconds <= $available) return $cursor->addSeconds(max(0, $seconds))->utc()->toIso8601String();
            $seconds -= $available;
            $cursor = $cursor->addDay()->setTimeFromTimeString($this->policy['opens']);
        }
    }
}
