<?php
// Handles HR request submissions, approvals, and related workflows

namespace App\Http\Controllers;

use App\Models\HrRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use App\Notifications\DocumentRequestAlert;
use Inertia\Inertia;

class HrRequestController extends Controller
{
    // --- USER (STAFF) FUNCTIONS ---

    public function index()
    {
        $requests = HrRequest::where('user_id', Auth::id())->latest()->get();
        return Inertia::render('HR/Staff/StaffOverview', ['requests' => $requests]);
    }

    public function store(Request $request)
    {
        // 🔐 ACL CHECK: Verify user can CREATE/SUBMIT documents
        // Permission Hierarchy: Full = Create/Edit/Delete, Edit = Create/Approve/Reject
        $user = Auth::user();
        if (!$user->canCreateModule('documents')) {
            abort(403, 'You do not have permission to submit document requests.');
        }

        $request->validate([
            'type' => 'required|in:2316,COE',
            'name' => 'required_if:type,COE|nullable|string|max:255',
            'reason' => 'required_if:type,COE|nullable|string|max:255',
            'specific_details' => 'nullable|string|max:255',
        ]);

        // 1. Save the request to a variable so we can pass it to the notification
        $hrRequest = HrRequest::create([
            'user_id' => Auth::id(),
            'type' => $request->type,
            'status' => 'Pending HR', 
            'name' => $request->name,
            'reason' => $request->reason,
            'specific_details' => $request->specific_details,
        ]);

        // 2. Find all HR Personnel
        $hrUsers = User::whereHas('role', function ($q) {
            $q->whereIn('name', ['Admin', 'HR', 'HRBP', 'Human Resources']);
        })->orWhereHas('position', function ($q) {
            $q->where('name', 'Human Resources');
        })->get();

        // 3. Send the in-app notification!
        if ($hrUsers->isNotEmpty()) {
            Notification::send($hrUsers, new DocumentRequestAlert($hrRequest, Auth::user()->name));
        }

        return back()->with('success', 'Your request has been submitted to HR.');
    }


    // --- HR ADMIN FUNCTIONS ---

    // 🟢 GATEKEEPER 1: For VIEWING the page (HR Assistants, HRBP, Admin)
    private function checkHrAccess()
    {
        $user = Auth::user();

        if (!$user || (!$user->canViewModule('documents') && !$user->canApproveModule('form_2316_approvals') && !$user->canViewModule('hr_overview'))) {
            abort(403, 'UNAUTHORIZED ACCESS. ONLY HR PERSONNEL WITH DOCUMENT REQUEST ACCESS CAN VIEW THIS PAGE.');
        }
    }

    // 🟢 GATEKEEPER 2: For ACTIONS (Only HRBP & Admin)
    private function checkHrbpAccess()
    {
        $user = Auth::user();

        if (!$user || !$user->canApproveModule('form_2316_approvals')) {
            abort(403, 'UNAUTHORIZED ACCESS. ONLY HRBP CAN APPROVE OR ENDORSE REQUESTS.');
        }
    }

    public function adminIndex()
    {
        // HR Assistants can pass this gate and see the data
        $this->checkHrAccess();

        $requests = HrRequest::with('user')->latest()->get();
        
        return Inertia::render('HR/Admin/HRAdminOverview', [
            'requests' => $requests
        ]);
    }

   public function updateStatus(Request $request, HrRequest $hrRequest)
    {
        // � HR Assistants will hit a brick wall here and get a 403 error!
        $this->checkHrbpAccess();

        // 🔐 UPDATED: Verify ACL permissions for form_2316_approvals - Must be able to APPROVE
        // Permission Hierarchy: Full + Edit can approve
        $user = Auth::user();
        if (!$user->canApproveModule('form_2316_approvals')) {
            abort(403, 'You do not have permission to approve document requests.');
        }

        // 🟢 Validation updated to strictly expect "approve"
        $request->validate([
            'action' => 'required|in:approve', 
        ]);

        $originalRequester = $hrRequest->user;

        if ($hrRequest->type === '2316') {
            $hrRequest->update(['status' => 'General Accounting']);
            
            if ($originalRequester) {
                $originalRequester->notify(new \App\Notifications\DocumentStatusUpdate($hrRequest, "Forwarded to General Accounting."));
            }
            
            return back()->with('success', '2316 Request forwarded to General Accounting.');
        
        } else {
            $hrRequest->update(['status' => 'Released']);
            
            if ($originalRequester) {
                $originalRequester->notify(new \App\Notifications\DocumentStatusUpdate($hrRequest, "Your COE is ready for release!"));
            }
            
            return back()->with('success', 'COE Request marked as Released.');
        }
    }
    
    // --- ACCOUNTING FUNCTIONS ---

    private function checkAccountingAccess()
    {
        $user = Auth::user();

        if (!$user || !$user->canViewModule('form_2316_approvals')) {
            abort(403, 'UNAUTHORIZED ACCESS. ONLY ACCOUNTING OR AUTHORIZED PERSONNEL CAN VIEW THIS.');
        }
    }

    public function accountingApprovals()
    {
        $this->checkAccountingAccess();

        $requests = HrRequest::with('user') 
                        ->where('type', '2316')
                        // 🟢 Removed 'Rejected' from the filter array
                        ->whereIn('status', ['General Accounting', 'Released'])
                        ->latest()
                        ->get();

        return inertia('HR/AccountingApprovals', [
            'requests' => $requests
        ]);
    }

    public function updateAccountingStatus(Request $request, $id)
    {
        // 🔐 Verify user has Accounting access
        $this->checkAccountingAccess();

        // 🔐 UPDATED: Verify ACL permissions for form_2316_approvals - Must be able to APPROVE
        // Permission Hierarchy: Full + Edit can approve
        $user = Auth::user();
        if (!$user->canApproveModule('form_2316_approvals')) {
            abort(403, 'You do not have permission to approve 2316 forms.');
        }

        // 🟢 Validation strictly expects "Released"
        $request->validate([
            'status' => 'required|in:Released'
        ]);

        $docRequest = HrRequest::findOrFail($id);
        $docRequest->status = $request->status;
        $docRequest->save();

        $originalRequester = $docRequest->user;

        // Notify user of release
        if ($originalRequester && $request->status === 'Released') {
            $originalRequester->notify(new \App\Notifications\DocumentStatusUpdate($docRequest, "Your 2316 is ready for release!"));
        }

        return redirect()->back()->with('success', 'Document status updated successfully.');
    }
}