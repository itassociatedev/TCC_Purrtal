<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

\Illuminate\Support\Facades\Schedule::call(fn()=>app(\App\Services\TaskModuleRecurrence::class)->generate())->name('task-recurring-occurrences')->everyMinute()->withoutOverlapping();
