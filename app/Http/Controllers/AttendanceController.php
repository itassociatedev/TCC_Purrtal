<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class AttendanceController extends Controller
{
    public function overview()
    {
        return Inertia::render('Attendance/Overview');
    }

    public function setupSchedule()
    {
        return Inertia::render('Attendance/SetupSchedule');
    }

    public function scheduleView()
    {
        return Inertia::render('Attendance/ScheduleView');
    }

    public function calendar()
    {
        return Inertia::render('Attendance/Calendar');
    }
}