<?php

return [
    // Snapshot this policy onto new tickets so later configuration changes do not
    // silently rewrite the targets of tickets already in progress.
    'version' => 'TCC-2026-10-27',
    'timezone' => 'Asia/Manila',
    'opens' => '07:30',
    'closes' => '19:00',
    'warning_remaining' => 0.20,
    'targets' => [
        'critical' => ['label' => 'P1 Critical', 'response' => 900, 'resolution' => 14400, 'update' => 1800],
        'high' => ['label' => 'P2 High', 'response' => 1800, 'resolution' => 28800, 'update' => 7200],
        'medium' => ['label' => 'P3 Medium', 'response' => 14400, 'resolution' => 124200, 'update' => null],
        'low' => ['label' => 'P4 Low', 'response' => 41400, 'resolution' => 207000, 'update' => null],
    ],
    'pause_reasons' => ['requester_information', 'requester_availability', 'vendor', 'parts_or_servicing', 'approved_decision'],
];
