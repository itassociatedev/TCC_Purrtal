<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// The host must run Laravel's scheduler every minute. Row locks and persisted
// alert markers prevent duplicate website notifications across repeated runs.
Schedule::command('tickets:check-sla')->everyMinute()->withoutOverlapping();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
