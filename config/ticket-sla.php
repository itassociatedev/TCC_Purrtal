<?php

// Enable the short targets only for local SLA testing.
$testMode = env('APP_ENV') === 'local' && env('TICKET_SLA_TEST_MODE', false);

return [
    // Snapshot this policy onto new tickets so later configuration changes do not
    // silently rewrite the targets of tickets already in progress.
    'version' => $testMode ? 'TCC-LOCAL-TEST-2026-11-11' : 'TCC-2026-10-27',
    'timezone' => 'Asia/Manila',
    'opens' => '07:30',
    'closes' => '19:00',
    'warning_remaining' => 0.20,
    'targets' => [
        'critical' => ['label' => 'P1 Critical', 'response' => $testMode ? 120 : 900, 'resolution' => $testMode ? 120 : 14400, 'update' => 1800],
        'high' => ['label' => 'P2 High', 'response' => $testMode ? 300 : 1800, 'resolution' => $testMode ? 300 : 28800, 'update' => 7200],
        'medium' => ['label' => 'P3 Medium', 'response' => $testMode ? 600 : 14400, 'resolution' => $testMode ? 600 : 124200, 'update' => null],
        'low' => ['label' => 'P4 Low', 'response' => $testMode ? 1200 : 41400, 'resolution' => $testMode ? 1200 : 207000, 'update' => null],
    ],
    'pause_reasons' => ['requester_information', 'requester_availability', 'vendor', 'parts_or_servicing', 'approved_decision'],
];
