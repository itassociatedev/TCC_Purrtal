<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Shift;
use App\Models\AttendanceSetting;

class AttendanceDefaultsSeeder extends Seeder
{
    public function run()
    {
        // 1. Seed the Cut-Off Rules
        AttendanceSetting::firstOrCreate(
            ['setting_key' => 'cutoff_1_start'],
            ['setting_value' => '21', 'description' => 'Start day for the first cut-off period (e.g., 21st)']
        );
        
        AttendanceSetting::firstOrCreate(
            ['setting_key' => 'cutoff_1_end'],
            ['setting_value' => '5', 'description' => 'End day for the first cut-off period (e.g., 5th)']
        );

        AttendanceSetting::firstOrCreate(
            ['setting_key' => 'cutoff_2_start'],
            ['setting_value' => '6', 'description' => 'Start day for the second cut-off period (e.g., 6th)']
        );

        AttendanceSetting::firstOrCreate(
            ['setting_key' => 'cutoff_2_end'],
            ['setting_value' => '20', 'description' => 'End day for the second cut-off period (e.g., 20th)']
        );

        // 2. Seed your existing 15 hardcoded shifts
        $defaultShifts = [
            ['name' => '7:30AM - 4:30PM (07:30-16:30)', 'start_time' => '07:30:00', 'end_time' => '16:30:00', 'shift_type' => 'Day Shift'],
            ['name' => '8:00AM - 5:00PM (08:00-17:00)', 'start_time' => '08:00:00', 'end_time' => '17:00:00', 'shift_type' => 'Day Shift'],
            ['name' => '9:00AM - 6:00PM (09:00-18:00)', 'start_time' => '09:00:00', 'end_time' => '18:00:00', 'shift_type' => 'Day Shift'],
            ['name' => '10:00AM - 7:00PM (10:00-19:00)', 'start_time' => '10:00:00', 'end_time' => '19:00:00', 'shift_type' => 'Day Shift'],
            ['name' => '12:00PM - 9:00PM (12:00-21:00)', 'start_time' => '12:00:00', 'end_time' => '21:00:00', 'shift_type' => 'Day Shift'],
            ['name' => '12:30PM - 9:30PM (12:30-21:30)', 'start_time' => '12:30:00', 'end_time' => '21:30:00', 'shift_type' => 'Day Shift'],
            ['name' => '5:30AM - 2:30 PM (05:30-14:30)', 'start_time' => '05:30:00', 'end_time' => '14:30:00', 'shift_type' => 'Day Shift'],
            ['name' => '11:00AM - 8:00PM (11:00-20:00)', 'start_time' => '11:00:00', 'end_time' => '20:00:00', 'shift_type' => 'Day Shift'],
            ['name' => '1:00PM - 10:00PM (13:00-22:00)', 'start_time' => '13:00:00', 'end_time' => '22:00:00', 'shift_type' => 'Day Shift'],
            ['name' => '6:00AM - 3:00PM (06:00-15:00)', 'start_time' => '06:00:00', 'end_time' => '15:00:00', 'shift_type' => 'Day Shift'],
            ['name' => '7:00AM - 4:00PM (07:00-16:00)', 'start_time' => '07:00:00', 'end_time' => '16:00:00', 'shift_type' => 'Day Shift'],
            ['name' => '9:30AM - 6:30PM (09:30-18:30)', 'start_time' => '09:30:00', 'end_time' => '18:30:00', 'shift_type' => 'Day Shift'],
            ['name' => '9:00PM - 6:00AM (Graveyard Shift)', 'start_time' => '21:00:00', 'end_time' => '06:00:00', 'shift_type' => 'Graveyard Shift'],
            ['name' => '7:00AM - 11:00PM (Straight Duty)', 'start_time' => '07:00:00', 'end_time' => '23:00:00', 'shift_type' => 'Straight Duty'],
            ['name' => '8:00AM - 12:00AM (Straight Duty)', 'start_time' => '08:00:00', 'end_time' => '00:00:00', 'shift_type' => 'Straight Duty'],
        ];

        foreach ($defaultShifts as $shift) {
            Shift::firstOrCreate(
                ['start_time' => $shift['start_time'], 'end_time' => $shift['end_time']],
                $shift
            );
        }
    }
}