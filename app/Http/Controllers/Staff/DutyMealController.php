<?php

namespace App\Http\Controllers\Staff;

use App\Models\User;
use App\Http\Controllers\Controller;
use App\Models\DutyMealParticipant;
use App\Models\SystemLog; // 🟢 INJECTED FOR LOGGING
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;
use App\Notifications\MealChoiceUpdated;

class DutyMealController extends Controller
{
    public function index(Request $request)
    {
        // 🟢 NEW: Enforce ACL Security for Personal Meals
        if (!\Illuminate\Support\Facades\Auth::user()->canViewModule('duty_meal_personal')) {
            abort(403, 'You do not have permission to access Personal Duty Meals.');
        }

        $user = $request->user();
        $now = now();

        // 🟢 Eager load user.branches so we can check if they are multi-branch
        $pendingParticipants = DutyMealParticipant::with(['dutyMeal.branch', 'user.branches'])
            ->where('user_id', $user->id)
            ->where('choice', 'none')
            ->get();

        foreach ($pendingParticipants as $participant) {
            if ($participant->dutyMeal) {
                // Find the Monday of the week this meal belongs to
                $mealDate = Carbon::parse($participant->dutyMeal->duty_date);
                $startOfWeek = $mealDate->copy()->startOfWeek(); 
                
                // The deadline is 3 days before Monday (Friday 23:59:59)
                $deadline = $startOfWeek->copy()->subDays(3)->endOfDay(); 

                // If we are past the deadline, force the choice to 'main'
                if ($now->greaterThanOrEqualTo($deadline)) {
                    
                    $isMakati = str_contains(strtolower($participant->dutyMeal->branch->name ?? ''), 'makati');
                    $site = null;
                    
                    if ($isMakati && $participant->user) {
                        // Combine their primary branch_id with any assigned pivot branches to get their total branch count
                        $assignedBranchIds = $participant->user->branches->pluck('id')->push($participant->user->branch_id)->filter()->unique();
                        $isMultiBranch = $assignedBranchIds->count() > 1;
                        
                        // If multi-branch, default to Back Office; else Clinic
                        $site = $isMultiBranch ? 'Back Office' : 'Clinic';
                    }
                    
                    $participant->update([
                        'choice' => 'main',
                        'site' => $site
                    ]);
                }
            }
        }

        // 🟢 2. Fetch the updated meals for the React view
        $myDutyMeals = DutyMealParticipant::with('dutyMeal.branch')
            ->where('user_id', $user->id)
            ->whereHas('dutyMeal', function ($query) {
                $query->whereDate('duty_date', '>=', now()->startOfWeek());
            })->get()->map(function ($participant) {
                return [
                    'participant_id' => $participant->id,
                    'choice' => $participant->choice,
                    'site' => $participant->site, 
                    'custom_request' => $participant->custom_request,
                    'duty_date' => Carbon::parse($participant->dutyMeal->duty_date)->format('Y-m-d'), // 🟢 FIXED: Force Y-m-d string here
                    'main_meal' => $participant->dutyMeal->main_meal,
                    'alt_meal' => $participant->dutyMeal->alt_meal,
                    'is_locked' => $participant->dutyMeal->is_locked,
                    'branch_name' => $participant->dutyMeal->branch->name ?? 'Unknown',
                    'branch_id' => $participant->dutyMeal->branch_id,
                ];
            })->sortByDesc('duty_date')->values();

        return Inertia::render('Staff/Duty Meals/Index', [
            'myDutyMeals' => $myDutyMeals,
        ]);
    }

    // 🟢 3. The New Weekly Bulk Lock-In Method
    public function bulkLockIn(Request $request)
    {
        $request->validate([
            'selections' => 'required|array',
            'selections.*.participant_id' => 'required|exists:duty_meal_participants,id',
            // ADDED 'special' to the allowed choices below!
            'selections.*.choice' => 'required|in:main,alt,special',
            'selections.*.site' => 'nullable|string|in:Back Office,Clinic', 
            'selections.*.custom_request' => 'nullable|string|max:255',
        ]);

        $userId = Auth::id();
        $participantIds = collect($request->selections)->pluck('participant_id');
        
        $participants = DutyMealParticipant::with('dutyMeal')->whereIn('id', $participantIds)->where('user_id', $userId)->get()->keyBy('id');

        $updatedCount = 0;
        $firstUpdated = null;

        // Use a transaction so if one fails, they all fail (keeps data clean)
        DB::transaction(function () use ($request, $participants, &$updatedCount, &$firstUpdated) {
            foreach ($request->selections as $selection) {
                $participant = $participants->get($selection['participant_id']);

                // Security check: ensure it isn't locked by admin and hasn't been chosen yet
                if ($participant && !$participant->dutyMeal->is_locked && $participant->choice === 'none') {
                    $participant->update([
                        'choice' => $selection['choice'],
                        'site' => $selection['site'] ?? null, 
                        'custom_request' => $selection['custom_request'],
                    ]);
                    $updatedCount++;

                    // Grab the first one to use for the notification reference
                    if (!$firstUpdated) {
                        $firstUpdated = $participant;
                    }
                }
            }
        });

        // 🟢 SYSTEM LOGGING (Tracks User Self-Service)
        if ($updatedCount > 0) {
            try {
                SystemLog::create([
                    'user_id' => Auth::id(),
                    'action' => 'Update',
                    'module' => 'Duty Meal Participant',
                    'description' => "User self-locked {$updatedCount} duty meal choices for the week.",
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent()
                ]);
            } catch (\Exception $e) {}
        }

        if ($updatedCount > 0 && $firstUpdated) {
            $firstUpdated->load('user'); 
            
            $adminUsers = User::whereHas('role', function ($q) {
                $q->whereIn('name', ['Admin', 'Duty Meal Custodian', 'Director of Corporate Services and Operations']);
            })->get();

            if ($adminUsers->isNotEmpty()) {
                Notification::send($adminUsers, new MealChoiceUpdated($firstUpdated));
            }
        }

        return back()->with('success', "Successfully locked in {$updatedCount} meal choices for the week!");
    }
}