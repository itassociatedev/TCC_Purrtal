<?php
// Purchase request controller: manage PR lifecycle

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Supplier;
use App\Models\PurchaseRequest;
use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use App\Notifications\PendingApprovalNotification;
use App\Notifications\PRPOCcStatusUpdate;

class PurchaseRequestController extends Controller
{
    // =====================================================================
    // 1. CREATE REQUEST (Frontend Form)
    // =====================================================================
    public function create()
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $userBranches = $user->branches()->pluck('name')->toArray();

        $suppliers = Supplier::select('id', 'name')->get();
        $products = Product::select('id', 'name', 'supplier_id', 'details', 'unit', 'price')->get();
        $branches = Branch::select('id', 'name')->get();
        $departments = Department::select('id', 'name')->get();
        $employees = User::with('branches:id,name')
                         ->where('id', '!=', Auth::id())
                         ->select('id', 'name')
                         ->orderBy('name')
                         ->get();

        return Inertia::render('PRPO/CreatePR', [
            'suppliers' => $suppliers,
            'products' => $products,
            'branches' => $branches,
            'departments' => $departments,
            'userBranches' => $userBranches,
            'employees' => $employees,
        ]);
    }

    // =====================================================================
    // 2. STORE REQUEST (Save to Database)
    // =====================================================================
   public function store(Request $request)
    {
        // 🔐 ACL CHECK: Verify user can CREATE purchase_requests
        // Permission Hierarchy: Full = Create/Edit/Delete, Edit = Create/Approve/Reject
        $user = Auth::user();
        if (!$user->canCreateModule('purchase_requests')) {
            abort(403, 'You do not have permission to create purchase requests.');
        }

        $validated = $request->validate([
            'branch' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'date_prepared' => 'required|date',
            'request_type' => 'nullable|string|max:255',
            'priority' => 'nullable|string|max:255',
            'date_needed' => 'nullable|date|after_or_equal:today', 
            'budget_status' => 'nullable|string|max:255',
            'budget_ref' => 'nullable|string|max:255',
            'purpose_of_request' => 'nullable|string',
            'impact_if_not_procured' => 'nullable|string',
            'cc_user_id' => 'nullable|exists:users,id',

            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.supplier_id' => 'nullable|exists:suppliers,id',
            'items.*.specifications' => 'nullable|string|max:255',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.qty_requested' => 'required|numeric|min:0',
            'items.*.qty_on_hand' => 'nullable|numeric|min:0',
            'items.*.reorder_level' => 'nullable|numeric|min:0',
            'items.*.est_unit_cost' => 'nullable|numeric|min:0',
            'items.*.total_cost' => 'nullable|numeric|min:0',
        ], [
            'date_needed.after_or_equal' => 'The date needed cannot be a past date.',
        ]);

        // 2. 🟢 DYNAMIC WORKFLOW ROUTING
        $userRole = strtolower(Auth::user()->role->name ?? '');
        $initialStatus = 'pending_inv_tl'; 

        // 🟢 Check if the user is an Inventory Assistant AND the branch is Greenhills
        $isGreenhillsAssistant = str_contains($userRole, 'inventory assist') && $validated['branch'] === 'Greenhills';

        if (str_contains($userRole, 'tl') || $isGreenhillsAssistant) {
            $initialStatus = 'pending_ops_manager'; 
        } 
        elseif (str_contains($userRole, 'director') || str_contains($userRole, 'admin') || str_contains($userRole, 'operations') || str_contains($userRole, 'procurement'))  {
            $initialStatus = 'approved'; 
        }
        
        DB::transaction(function () use ($validated, $initialStatus) {
            
            $pr = PurchaseRequest::create([
                'user_id' => Auth::id(), 
                'branch' => $validated['branch'],
                'department' => $validated['department'],
                'date_prepared' => $validated['date_prepared'],
                'request_type' => $validated['request_type'],
                'priority' => $validated['priority'],
                'date_needed' => $validated['date_needed'],
                'budget_status' => $validated['budget_status'],
                'budget_ref' => $validated['budget_ref'],
                'purpose_of_request' => $validated['purpose_of_request'],
                'impact_if_not_procured' => $validated['impact_if_not_procured'],
                'status' => $initialStatus,
                'cc_user_id' => $validated['cc_user_id'] ?? null,
            ]);

            foreach ($validated['items'] as $item) {
                $pr->items()->create($item);
            }

            $this->notifyNextApprovers($pr);

           // 🟢 1. Initialize a collection for all CC recipients
            $ccRecipients = collect();

            // Add the manual CC user if one was selected
            if ($pr->cc_user_id) {
                $manualCc = User::find($pr->cc_user_id);
                if ($manualCc) {
                    $ccRecipients->push($manualCc);
                }
            }

            // 🟢 2. Automatically fetch all Auditors
            $auditors = User::whereHas('role', function ($query) {
                $query->whereIn('name', ['Auditor TL', 'Audit Assistant']);
            })->get();

            // 🟢 3. Merge them together and remove duplicates 
            $allCcUsers = $ccRecipients->merge($auditors)->unique('id');

            // 🟢 4. Send the notification to everyone in the list
            foreach ($allCcUsers as $recipient) {
                $reason = $recipient->id == $pr->cc_user_id 
                    ? "You were CC'd on a new Purchase Request by " . Auth::user()->name
                    : "A new Purchase Request was submitted for Audit review by " . Auth::user()->name;

                $recipient->notify(new PRPOCcStatusUpdate($pr, 'PR', $reason));
            }
            
        });

        return redirect()->route('prpo.approval-board', ['view' => 'my_requests'])
                         ->with('success', 'Purchase Request submitted successfully!');
    }

    // =====================================================================
    // 3. APPROVAL BOARD (View Requests based on Role)
    // =====================================================================
  public function approvalBoard(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $userRole = strtolower($user->role->name ?? '');
        $userBranches = $user->branches()->pluck('name')->toArray(); 
        
        $isAssistant = str_contains($userRole, 'assist');
        $defaultView = $isAssistant ? 'my_requests' : 'action_needed';
        $view = $request->query('view', $defaultView);

        $query = PurchaseRequest::with(['user', 'cc_user', 'items.product', 'items.supplier'])->latest();
        $isAdmin = str_contains($userRole, 'admin');

        if ($view === 'action_needed') {
            if ($isAdmin) {
                $query->whereIn('status', ['pending_inv_tl', 'pending_ops_manager', 'approved']);
            } 
            elseif (str_contains($userRole, 'inventory tl')) {
                $query->where('status', 'pending_inv_tl');
                if (!empty($userBranches)) {
                    $query->whereIn('branch', $userBranches); 
                }
            } 
            elseif (str_contains($userRole, 'operations') || str_contains($userRole, 'ops manager')) {
                $query->where('status', 'pending_ops_manager');
                if (!empty($userBranches)) {
                    $query->whereIn('branch', $userBranches); 
                }
            } 
            elseif (str_contains($userRole, 'director') || str_contains($userRole, 'procurement')) {
                $query->where('status', 'approved');
            } 
            else {
                $query->whereRaw('1 = 0'); 
            }
        } 
        elseif ($view === 'my_requests') {
            $query->where('user_id', $user->id);
        } 
        else {
            if (!$isAdmin && !empty($userBranches)) {
                $query->whereIn('branch', $userBranches);
            }
        }

        $requests = $query->paginate(15)->withQueryString();

        // 🟢 Fetch lookup data so the Edit Modal can add new items/departments
        $suppliers = Supplier::select('id', 'name')->get();
        $products = Product::select('id', 'name', 'supplier_id', 'details', 'unit', 'price')->get();
        $branches = Branch::select('id', 'name')->get();
        $departments = Department::select('id', 'name')->get();
        $employees =   User::with('branches:id,name')->where('id', '!=', Auth::id())->select('id', 'name')->orderBy('name')->get();

        return Inertia::render('PRPO/ApprovalBoard', [
            'requests' => $requests,
            'currentView' => $view,
            'userBranches' => $userBranches, 
            'isAssistant' => $isAssistant, 
            'canSeeAll' => $isAdmin || str_contains($userRole, 'director'),
            
            // 🟢 Pass data to React
            'suppliers' => $suppliers,
            'products' => $products,
            'branches' => $branches,
            'departments' => $departments,
            'employees' => $employees,
        ]);
    }

    // =====================================================================
    // 4. UPDATE STATUS (Approve / Reject Logic)
    // =====================================================================
    public function updateStatus(Request $request, PurchaseRequest $purchaseRequest)
    {
        // 🔐 ACL CHECK: Verify user can APPROVE/REJECT purchase_requests
        // Permission Hierarchy: Full + Edit can approve/reject
        $user = Auth::user();
        $action = $request->input('action');
        
        // Determine which permission is needed based on action
        if (in_array($action, ['approve'], true)) {
            if (!$user->canApproveModule('purchase_requests')) {
                abort(403, 'You do not have permission to approve purchase requests.');
            }
        } elseif (in_array($action, ['reject', 'return_to_inv_tl', 'return_to_creator'], true)) {
            if (!$user->canRejectModule('purchase_requests')) {
                abort(403, 'You do not have permission to reject purchase requests.');
            }
        } elseif ($action === 'cancel') {
            // Cancel typically requires full permission
            if (!$user->canDeleteModule('purchase_requests')) {
                abort(403, 'You do not have permission to cancel purchase requests.');
            }
        }

        // �🟢 UPDATED: Allow 'return_to_creator' as a valid action
        $validated = $request->validate([
            'action' => 'required|in:approve,reject,cancel,return_to_inv_tl,return_to_creator',
            'rejection_reason' => 'required_if:action,reject|required_if:action,return_to_inv_tl|required_if:action,return_to_creator|nullable|string'
        ]);

        $isGreenhills = $purchaseRequest->branch === 'Greenhills';

        // 🟢 1. Handle Return to Inv TL (Standard Branch)
        if ($validated['action'] === 'return_to_inv_tl') {
            $purchaseRequest->status = 'pending_inv_tl';
            $purchaseRequest->rejection_reason = $validated['rejection_reason']; 
            
            $message = "Purchase request returned to Inventory TL for corrections.";
            
            $purchaseRequest->save();
            
            // --- RETURN NOTIFICATION LOGIC ---
            $notifyList = collect();

            // Fetch Inventory TLs for this specific branch
            $invTeam = User::whereHas('role', function ($q) {
                $q->where('name', 'like', '%Inventory TL%');
            })->whereHas('branches', function ($q) use ($purchaseRequest) {
                $q->where('name', $purchaseRequest->branch);
            })->get();

            $notifyList = $notifyList->merge($invTeam);

            // Send the alert
            if ($notifyList->isNotEmpty()) {
                $alertMessage = "PR from {$purchaseRequest->department} ({$purchaseRequest->branch}) was returned to Inventory TL for corrections.";
                \Illuminate\Support\Facades\Notification::send($notifyList, new PendingApprovalNotification($purchaseRequest, $alertMessage));
            }

            return back()->with('success', $message);
        }

        // 🟢 1.5 Handle Return to Creator (Greenhills Assistant)
        if ($validated['action'] === 'return_to_creator') {
             // In your system, an assistant needs it to be in "pending_inv_tl" status to edit it again
            $purchaseRequest->status = 'pending_inv_tl';
            $purchaseRequest->rejection_reason = $validated['rejection_reason']; 
            $message = "Purchase request returned to the Greenhills Inventory Assistant for corrections.";
            
            $purchaseRequest->save();

            // Send Notification directly to Assistants
            $notifyList = collect();
            $assistants = User::whereHas('role', function ($q) {
                $q->where('name', 'like', '%Inventory Assist%');
            })->whereHas('branches', function ($q) use ($purchaseRequest) {
                $q->where('name', $purchaseRequest->branch);
            })->get();

            $notifyList = $notifyList->merge($assistants);
            
            if ($notifyList->isNotEmpty()) {
                $alertMessage = "Your PR from {$purchaseRequest->department} ({$purchaseRequest->branch}) was returned by the Ops Manager for corrections.";
                \Illuminate\Support\Facades\Notification::send($notifyList->unique('id'), new PendingApprovalNotification($purchaseRequest, $alertMessage));
            }

            return back()->with('success', $message);
        }


        // 🟢 2. Handle Approve
        if ($validated['action'] === 'approve') {
            if ($purchaseRequest->status === 'pending_inv_tl') {
                $purchaseRequest->status = 'pending_ops_manager';
                $purchaseRequest->rejection_reason = null; // Clear any old return notes
            } elseif ($purchaseRequest->status === 'pending_ops_manager') {
                $purchaseRequest->status = 'approved'; 
            }
            $message = 'Purchase request moved to the next approval stage.';
        
        // 🟢 3. Handle Cancel
        } elseif ($validated['action'] === 'cancel') {
            $purchaseRequest->status = 'cancelled';
            $message = 'Purchase request has been cancelled.';
            
        // 🟢 4. Handle Complete Rejection 
        } else {
            // Standard Rejection
            $purchaseRequest->status = 'rejected';
            $purchaseRequest->rejection_reason = $validated['rejection_reason'];
            $message = 'Purchase request has been rejected.';
        }

        $purchaseRequest->save();

        // 🟢 5. Trigger standard workflow notifications for Approve/Reject/Cancel
        $this->notifyNextApprovers($purchaseRequest);

        $ccUser = $purchaseRequest->cc_user;
        if ($ccUser) {
            $ccUser->notify(new PRPOCcStatusUpdate($purchaseRequest, 'PR', "A Purchase Request you are copied on was " . $request->action));
        }

        return back()->with('success', $message);
    }

    public function update(Request $request, $id)
    {
        // 🔐 ACL CHECK: Verify user can EDIT purchase_requests (not just approve)
        // Permission Hierarchy: Full only can edit existing requests
        $user = Auth::user();
        if (!$user->canEditModule('purchase_requests')) {
            abort(403, 'You do not have permission to update purchase requests.');
        }

        $pr = PurchaseRequest::findOrFail($id);

        $validated = $request->validate([
            'branch' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'request_type' => 'nullable|string|max:255',
            'priority' => 'nullable|string|max:255',
            'date_needed' => 'nullable|date',
            'budget_status' => 'nullable|string|max:255',
            'budget_ref' => 'nullable|string|max:255',
            'purpose_of_request' => 'nullable|string',
            'impact_if_not_procured' => 'nullable|string',
            'cc_user_id' => 'nullable|exists:users,id',

            'items' => 'required|array|min:1',
            'items.*.id' => 'nullable|exists:purchase_request_items,id',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.supplier_id' => 'nullable|exists:suppliers,id',
            'items.*.specifications' => 'nullable|string|max:255',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.qty_requested' => 'required|numeric|min:0',
            'items.*.qty_on_hand' => 'nullable|numeric|min:0',
            'items.*.reorder_level' => 'nullable|numeric|min:0',
            'items.*.est_unit_cost' => 'nullable|numeric|min:0',
            'items.*.total_cost' => 'nullable|numeric|min:0',
        ]);

        $userRole = strtolower(Auth::user()->role->name ?? '');
        $isGreenhillsAssistant = str_contains($userRole, 'inventory assist') && $validated['branch'] === 'Greenhills';
        $statusAutoForwarded = false;

        $updateData = [
            'branch' => $validated['branch'],
            'department' => $validated['department'],
            'request_type' => $validated['request_type'],
            'priority' => $validated['priority'],
            'date_needed' => $validated['date_needed'],
            'budget_status' => $validated['budget_status'],
            'budget_ref' => $validated['budget_ref'],
            'purpose_of_request' => $validated['purpose_of_request'],
            'impact_if_not_procured' => $validated['impact_if_not_procured'],
            'cc_user_id' => $validated['cc_user_id'] ?? null,
        ];

        // 🟢 UN-STUCK LOGIC FOR GREENHILLS ASSISTANTS
        // If a Greenhills Assistant edits a returned PR, auto-bump it back to the OM
        if ($isGreenhillsAssistant && $pr->status === 'pending_inv_tl') {
            $updateData['status'] = 'pending_ops_manager';
            $updateData['rejection_reason'] = null;
            $statusAutoForwarded = true;
        }

        // 1. Update the PR header fields
        $pr->update($updateData);

        // 2. Sync items: Delete items that the user removed in the frontend
        $existingItemIds = collect($validated['items'])->pluck('id')->filter()->all();
        $pr->items()->whereNotIn('id', $existingItemIds)->delete();

        // 3. Update existing items or Create new ones
        foreach ($validated['items'] as $itemData) {
            if (isset($itemData['id'])) {
                $pr->items()->where('id', $itemData['id'])->update($itemData);
            } else {
                $pr->items()->create($itemData);
            }
        }

        // 🟢 Re-trigger the OM notification if the PR was auto-forwarded
        if ($statusAutoForwarded) {
            $this->notifyNextApprovers($pr);
        }

        return redirect()->back()->with('success', 'Purchase Request updated successfully.');
    }

    public function print(PurchaseRequest $purchaseRequest)
    {
        $purchaseRequest->load(['user','cc_user', 'items.product', 'items.supplier']);

        return Inertia::render('PRPO/PrintablePR', [
            'pr' => $purchaseRequest
        ]);
    }

    private function notifyNextApprovers(PurchaseRequest $pr)
    {
        // 🟢 1. Always start the list with the original requester!
        $usersToNotify = collect([$pr->user]); 
        $message = '';

        if ($pr->status === 'pending_inv_tl') {
            // Find Inventory TLs
            $approvers = User::whereHas('role', function ($q) {
                $q->where('name', 'like', '%Inventory TL%');
            })->whereHas('branches', function ($q) use ($pr) {
                $q->where('name', $pr->branch);
            })->get();
            
            // Add approvers to our list
            $usersToNotify = $usersToNotify->merge($approvers);
            // Adjusted message to make sense for both parties
            $message = "PR from {$pr->department} ({$pr->branch}) is now pending Inventory TL approval.";

        } elseif ($pr->status === 'pending_ops_manager') {
            // Find Ops Managers
            $approvers = User::whereHas('role', function ($q) {
                $q->where('name', 'like', '%Ops Manager%')->orWhere('name', 'like', '%Operations%');
            })->whereHas('branches', function ($q) use ($pr) {
                $q->where('name', $pr->branch);
            })->get();

            $usersToNotify = $usersToNotify->merge($approvers);
            $message = "PR from {$pr->department} ({$pr->branch}) is now pending Operations Manager approval.";

        } elseif ($pr->status === 'approved') {
            // Find Procurement
            $procurementTeam = User::whereHas('role', function ($q) {
                $q->where('name', 'like', '%Procurement%');
            })->get();

            $usersToNotify = $usersToNotify->merge($procurementTeam);
            $message = "PR from {$pr->department} ({$pr->branch}) is approved. The PO is ready for generation.";
            
        } elseif ($pr->status === 'rejected') {
             $message = "PR from {$pr->department} ({$pr->branch}) was rejected.";
             
        } elseif ($pr->status === 'cancelled') {
             $message = "PR from {$pr->department} ({$pr->branch}) was cancelled.";
        }

        if (!empty($pr->cc_users)) {
            $ccUsers = User::whereIn('id', $pr->cc_users)->get();
            $usersToNotify = $usersToNotify->merge($ccUsers);
        }

        // 🟢 2. Filter out duplicates (Just in case an Inventory TL made their own request!)
        $usersToNotify = $usersToNotify->unique('id');

        // Send the notification to everyone on the final list
        if ($usersToNotify->isNotEmpty()) {
            Notification::send($usersToNotify, new PendingApprovalNotification($pr, $message));
        }
    }
}