<?php
return [
    'weights' => ['time'=>30, 'priority'=>30, 'returns'=>20, 'ownership'=>20],
    'lateness' => [['max_hours'=>24, 'score'=>15], ['max_hours'=>72, 'score'=>6], ['max_hours'=>null, 'score'=>0]],
    'return_deduction' => 5,
    'handover_percent' => 20,
];
