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

        $pendingParticipants = DutyMealParticipant::with('dutyMeal')->where('user_id', $user->id)->where('choice', 'none')->get();

        foreach ($pendingParticipants as $participant) {
            if ($participant->dutyMeal) {
                // Find the Monday of the week this meal belongs to
                $mealDate = Carbon::parse($participant->dutyMeal->duty_date);
                $startOfWeek = $mealDate->copy()->startOfWeek(); 
                
                // The deadline is 3 days before Monday (Friday 23:59:59)
                $deadline = $startOfWeek->copy()->subDays(3)->endOfDay(); 

                // If we are past the deadline, force the choice to 'main'
                if ($now->greaterThanOrEqualTo($deadline)) {
                    $participant->update(['choice' => 'main']);
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
                    'duty_date' => $participant->dutyMeal->duty_date,
                    'main_meal' => $participant->dutyMeal->main_meal,
                    'alt_meal' => $participant->dutyMeal->alt_meal,
                    'is_locked' => $participant->dutyMeal->is_locked,
                    'branch_name' => $participant->dutyMeal->branch->name ?? 'Unknown',
                    'branch_id' => $participant->dutyMeal->branch_id, // 🟢 Required for the Branch Request feature
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

    // 🟢 NEW: Handles submissions from the Multi-Branch Swap Request Dropdown
    public function storeBranchRequest(Request $request)
    {
        $request->validate([
            'duty_date' => 'required|date',
            'original_branch_id' => 'required|exists:branches,id',
            'requested_branch_id' => 'required|exists:branches,id|different:original_branch_id',
            'reason' => 'nullable|string|max:500',
        ]);

        $userId = Auth::id();
        
        // 🟢 FIXED: Strip timezone and time data to force a strict Y-m-d format
        $formattedDate = \Carbon\Carbon::parse($request->duty_date)->format('Y-m-d');

        // Prevent users from spamming the same request
        $existingRequest = \App\Models\DutyMealBranchRequest::where('user_id', $userId)
            ->whereDate('duty_date', $formattedDate)
            ->first();

        if ($existingRequest) {
            if ($existingRequest->status === 'pending') {
                return back()->with('error', 'You already have a pending branch change request for this date.');
            } else {
                return back()->with('error', 'A branch change request for this date was already processed.');
            }
        }

        // Store the request
        \App\Models\DutyMealBranchRequest::create([
            'user_id' => $userId,
            'duty_date' => $formattedDate, // 🟢 FIXED: Save strictly as Y-m-d
            'original_branch_id' => $request->original_branch_id,
            'requested_branch_id' => $request->requested_branch_id,
            'reason' => $request->reason,
            'status' => 'pending',
        ]);

        try {
            SystemLog::create([
                'user_id' => $userId,
                'action' => 'Create',
                'module' => 'Duty Meal Participant',
                'description' => "Requested a branch change for duty meal on {$formattedDate}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', 'Branch change request submitted successfully. It is now awaiting approval.');
    }

    // 🟢 View the Branch Request Approval Board
    public function branchRequests(Request $request)
    {
        // Require ACL View Access
        if (!\Illuminate\Support\Facades\Auth::user()->canViewModule('duty_meal_branch_requests')) {
            abort(403, 'Unauthorized access to Branch Requests.');
        }

        $requests = \App\Models\DutyMealBranchRequest::with(['user', 'originalBranch', 'requestedBranch', 'handler'])
            ->orderByRaw("FIELD(status, 'pending', 'approved', 'rejected')")
            ->orderBy('duty_date', 'asc')
            ->get()->map(function($req) {
                return [
                    'id' => $req->id,
                    'duty_date' => $req->duty_date->format('Y-m-d'),
                    'user_name' => $req->user->name,
                    'original_branch' => $req->originalBranch->name ?? 'Unknown',
                    'requested_branch' => $req->requestedBranch->name ?? 'Unknown',
                    'reason' => $req->reason,
                    'status' => $req->status,
                    'handled_by' => $req->handler->name ?? null,
                ];
            });

        return \Inertia\Inertia::render('DutyMeals/BranchRequests', [
            'requests' => $requests
        ]);
    }

    // 🟢 Handle Approve / Reject
    public function handleBranchRequest(Request $request, $id)
    {
        // Require ACL Edit Access
        if (!\Illuminate\Support\Facades\Auth::user()->canEditModule('duty_meal_branch_requests')) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'status' => 'required|in:approved,rejected'
        ]);

        $branchRequest = \App\Models\DutyMealBranchRequest::findOrFail($id);
        
        if ($branchRequest->status !== 'pending') {
            return back()->with('error', 'This request has already been processed.');
        }

        \Illuminate\Support\Facades\DB::transaction(function() use ($request, $branchRequest) {
            // 1. Update the request status
            $branchRequest->update([
                'status' => $request->status,
                'handled_by' => \Illuminate\Support\Facades\Auth::id(),
                'handled_at' => now()
            ]);

            // 2. If approved, migrate the user to the new branch's duty meal
            if ($request->status === 'approved') {
                // Find or create the target Duty Meal for the new branch on that date
                $targetDutyMeal = \App\Models\DutyMeal::firstOrCreate(
                    ['duty_date' => $branchRequest->duty_date, 'branch_id' => $branchRequest->requested_branch_id],
                    ['main_meal' => 'TBD', 'alt_meal' => null, 'is_locked' => false]
                );
                
                // Move the participant and reset their choices so they can vote on the new menu
                \App\Models\DutyMealParticipant::where('user_id', $branchRequest->user_id)
                    ->whereHas('dutyMeal', function($q) use ($branchRequest) {
                        $q->where('duty_date', $branchRequest->duty_date);
                    })
                    ->update([
                        'duty_meal_id' => $targetDutyMeal->id,
                        'choice' => 'none',
                        'site' => null,
                        'custom_request' => null
                    ]);
            }
        });

        // 🟢 Notify User
        try {
            $userToNotify = \App\Models\User::find($branchRequest->user_id);
            $action = $request->status === 'approved' ? 'approved ✅' : 'rejected ❌';
            $message = "Your branch change request for {$branchRequest->duty_date->format('M d, Y')} was {$action}.";
            
            \Illuminate\Support\Facades\Notification::send($userToNotify, new \App\Notifications\ScheduleAssigned($message));
        } catch (\Exception $e) {}

        // 🟢 System Log
        try {
            \App\Models\SystemLog::create([
                'user_id' => \Illuminate\Support\Facades\Auth::id(),
                'action' => 'Update',
                'module' => 'Duty Meal Branch Requests',
                'description' => ucfirst($request->status) . " branch change request for user ID {$branchRequest->user_id}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', 'Request ' . $request->status . ' successfully.');
    }
}