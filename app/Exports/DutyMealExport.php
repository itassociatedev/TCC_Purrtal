<?php

namespace App\Exports;

use App\Models\DutyMeal;
use Carbon\Carbon;
use Illuminate\Contracts\View\View;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class DutyMealExport implements FromView, ShouldAutoSize, WithStyles
{
    protected $dutyMealIds;

    public function __construct($dutyMealIds)
    {
        $this->dutyMealIds = is_string($dutyMealIds) ? explode(',', $dutyMealIds) : $dutyMealIds;
    }

    public function view(): View
    {
        // Fetch the selected meals with their participants
        $meals = DutyMeal::with(['participants.user', 'branch'])
            ->whereIn('id', $this->dutyMealIds)
            ->orderBy('duty_date')
            ->get();

        $weeks = [];

        foreach ($meals as $meal) {
            // 🟢 BUG FIX: Prevent Carbon crash if duty_date is corrupted
            if (empty($meal->duty_date)) {
                continue;
            }

            try {
                $date = Carbon::parse($meal->duty_date);
            } catch (\Exception $e) {
                continue;
            }

            // Group everything by the start of the week (Monday)
            $weekStart = $date->copy()->startOfWeek()->format('M d, Y');
            
            if (!isset($weeks[$weekStart])) {
                $weeks[$weekStart] = [
                    'dates' => [],
                    'days' => []
                ];
                
                // Build the 7 columns for Monday -> Sunday
                for ($i = 0; $i < 7; $i++) {
                    $dayDate = $date->copy()->startOfWeek()->addDays($i);
                    $dayKey = $dayDate->format('Y-m-d');
                    
                    $weeks[$weekStart]['dates'][$dayKey] = $dayDate->format('D, M d');
                    
                    // Initialize the tallies for the 4 specific template categories
                    $weeks[$weekStart]['days'][$dayKey] = [
                        'clinic_lunch' => ['total' => 0, 'main' => 0, 'alt' => 0, 'special' => 0, 'notes' => []],
                        'clinic_dinner' => ['total' => 0, 'main' => 0, 'alt' => 0, 'special' => 0, 'notes' => []],
                        'clinic_whole' => ['total' => 0, 'main' => 0, 'alt' => 0, 'special' => 0, 'notes' => []],
                        'back_office' => ['total' => 0, 'main' => 0, 'alt' => 0, 'special' => 0, 'notes' => []],
                    ];
                }
            }

            $dayKey = $date->format('Y-m-d');
            
            foreach ($meal->participants as $p) {
                // Safely extract and validate the choice
                $choice = strtolower(trim((string)($p->choice ?? '')));
                if (!in_array($choice, ['main', 'alt', 'special'])) {
                    continue;
                }

                $site = strtolower(trim((string)($p->site ?? 'Clinic')));
                $shift = strtolower(trim((string)($p->shift_type ?? 'day')));

                $catsToIncrement = [];
                
                // 🟢 ROUTING: Match the database row to the correct Template Section
                if ($site === 'back office') {
                    $catsToIncrement[] = 'back_office';
                } else {
                    if ($shift === 'graveyard') {
                        $catsToIncrement[] = 'clinic_dinner';
                    } elseif ($shift === 'straight') {
                        $catsToIncrement[] = 'clinic_lunch';
                        $catsToIncrement[] = 'clinic_dinner';
                    } else {
                        $catsToIncrement[] = 'clinic_lunch'; // Default for day shifts
                    }
                }

                $rawRequest = trim((string)($p->custom_request ?? ''));

                // Increment the counters
                foreach ($catsToIncrement as $cat) {
                    $weeks[$weekStart]['days'][$dayKey][$cat]['total']++;
                    $weeks[$weekStart]['days'][$dayKey][$cat][$choice]++;
                    
                    // Format any special requests or notes
                    if ($rawRequest !== '') {
                        $rawName = 'Staff';
                        
                        // 🟢 BUG FIX: Verify the user account wasn't deleted before attempting to read the name
                        if (!empty($p->user) && !empty($p->user->name)) {
                            $nameParts = explode(' ', trim((string)$p->user->name));
                            $rawName = count($nameParts) > 1 ? $nameParts[0] . ' ' . end($nameParts) : $nameParts[0];
                        }
                        
                        // 🟢 CRITICAL FIX: Convert "&" symbols and "ñ" characters into safe HTML entities
                        // This prevents PhpSpreadsheet's DOMDocument from crashing violently when parsing the View
                        $safeName = htmlspecialchars($rawName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $safeRequest = htmlspecialchars($rawRequest, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        
                        $weeks[$weekStart]['days'][$dayKey][$cat]['notes'][] = $safeName . ': ' . $safeRequest;
                    }
                }
            }
        }

        // 🟢 FIXED: "For the Whole Day" is now a perfect mathematical sum of Lunch + Dinner
        foreach ($weeks as &$week) {
            foreach ($week['days'] as &$day) {
                $day['clinic_whole']['total'] = $day['clinic_lunch']['total'] + $day['clinic_dinner']['total'];
                $day['clinic_whole']['main'] = $day['clinic_lunch']['main'] + $day['clinic_dinner']['main'];
                $day['clinic_whole']['alt'] = $day['clinic_lunch']['alt'] + $day['clinic_dinner']['alt'];
                $day['clinic_whole']['special'] = $day['clinic_lunch']['special'] + $day['clinic_dinner']['special'];
                $day['clinic_whole']['notes'] = array_merge($day['clinic_lunch']['notes'], $day['clinic_dinner']['notes']);
            }
        }
        unset($week);
        unset($day);

        return view('exports.duty_meals', [
            'weeks' => $weeks
        ]);
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 14]],
            // 🟢 NEW: Tell Excel to wrap text and align to the top so cells automatically expand vertically!
            'A:Z' => [
                'alignment' => [
                    'wrapText' => true,
                    'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_TOP
                ]
            ],
        ];
    }
}