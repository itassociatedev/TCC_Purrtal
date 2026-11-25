<?php
return [
    'model' => 'points_10',
    'weights' => ['time'=>2, 'priority'=>7, 'returns'=>1],
    'priority_scores' => ['Critical'=>7, 'High'=>4, 'Medium'=>2, 'Low'=>0],
    'lateness' => [['max_hours'=>48, 'score'=>1], ['max_hours'=>null, 'score'=>0]],
    'return_brackets' => [['max_returns'=>0, 'score'=>1], ['max_returns'=>2, 'score'=>0.5], ['max_returns'=>null, 'score'=>0]],
    'allocation_mode' => 'final_completer',
    // Compatibility for legacy equal-pool policies only; final-completer awards do not use a cut.
    'handover_percent' => 50,
];
