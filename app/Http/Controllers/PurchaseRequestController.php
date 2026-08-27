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
    // CREATE REQUEST (Frontend Form)
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
    // STORE REQUEST (Save to Database)
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

$userRoleId = $user->role_id;

$initialStatus = 'pending_inv_tl';

$isGreenhillsAssistant =
    $userRoleId === 19 &&
    $validated['branch'] === 'Greenhills';

$isInventoryTL = $userRoleId === 15;

if ($isGreenhillsAssistant || $isInventoryTL) {
    $initialStatus = 'pending_ops_manager';
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
    // APPROVAL BOARD (View Requests based on Role)
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
    // UPDATE STATUS (Approve / Reject Logic)
    // =====================================================================
    public function updateStatus(Request $request, PurchaseRequest $purchaseRequest)
{
    // =====================================================================
    // 1. AUTHENTICATED USER + ACTION
    // =====================================================================
    $user = Auth::user();
    $action = $request->input('action');

    // =====================================================================
    // 2. VALIDATE REQUEST
    // =====================================================================
    $validated = $request->validate([
        'action' => 'required|in:approve,reject,cancel,return_to_inv_tl,return_to_creator,approve_as_om_fallback',

        'rejection_reason' =>
            'required_if:action,reject' .
            '|required_if:action,return_to_inv_tl' .
            '|required_if:action,return_to_creator' .
            '|nullable|string',
    ]);

    // =====================================================================
    // 3. PERMISSION CHECK
    // =====================================================================

    if (in_array($action, ['approve', 'approve_as_om_fallback'], true)) {

        if (!$user->canApproveModule('purchase_requests')) {
            abort(
                403,
                'You do not have permission to approve purchase requests.'
            );
        }

    } elseif (in_array(
        $action,
        ['reject', 'return_to_inv_tl', 'return_to_creator'],
        true
    )) {

        if (!$user->canRejectModule('purchase_requests')) {
            abort(
                403,
                'You do not have permission to reject purchase requests.'
            );
        }

    } elseif ($action === 'cancel') {

        if (!$user->canDeleteModule('purchase_requests')) {
            abort(
                403,
                'You do not have permission to cancel purchase requests.'
            );
        }
    }

    // =====================================================================
    // 4. EVP APPROVAL ON BEHALF OF UNAVAILABLE OM
    // =====================================================================
    //
    // This is NOT a separate workflow.
    //
    // The PR is already:
    //
    // pending_ops_manager
    //
    // The EVP (role_id 9) chooses:
    //
    // "Approve on behalf of OM"
    //
    // after confirming that the OM is unavailable.
    //
    // The PR then moves directly to:
    //
    // pending_procurement
    //
    // =====================================================================

    if ($action === 'approve_as_om_fallback') {

        // Only EVP can perform this action.
        if ($user->role_id !== 9) {
            abort(
                403,
                'Only the Executive Vice President can approve on behalf of the Operations Manager.'
            );
        }

        // This action is only valid when the PR is waiting for OM approval.
        if ($purchaseRequest->status !== 'pending_ops_manager') {
            abort(
                403,
                'This Purchase Request is not awaiting Operations Manager approval.'
            );
        }

        // EVP approves on behalf of unavailable OM.
        $purchaseRequest->status = 'pending_procurement';
        $purchaseRequest->rejection_reason = null;

        $purchaseRequest->save();

        // Notify Procurement TL + requester.
        $this->notifyNextApprovers($purchaseRequest);

        return back()->with(
            'success',
            'Purchase request approved on behalf of the unavailable Operations Manager and forwarded to Procurement.'
        );
    }

    // =====================================================================
    // 5. RETURN TO INVENTORY TL
    // =====================================================================

    if ($action === 'return_to_inv_tl') {

        $purchaseRequest->status = 'pending_inv_tl';
        $purchaseRequest->rejection_reason = $validated['rejection_reason'];

        $message = 'Purchase request returned to Inventory TL for corrections.';

        $purchaseRequest->save();

        // Find Inventory TLs for this branch.
        $invTeam = User::whereHas('role', function ($q) {
            $q->where('name', 'Inventory TL');
        })
        ->whereHas('branches', function ($q) use ($purchaseRequest) {
            $q->where('name', $purchaseRequest->branch);
        })
        ->get();

        if ($invTeam->isNotEmpty()) {

            $alertMessage =
                "PR from {$purchaseRequest->department} ({$purchaseRequest->branch}) "
                . "was returned to Inventory TL for corrections.";

            Notification::send(
                $invTeam->unique('id'),
                new PendingApprovalNotification(
                    $purchaseRequest,
                    $alertMessage
                )
            );
        }

        return back()->with('success', $message);
    }

    // =====================================================================
    // 6. RETURN TO GREENHILLS INVENTORY ASSISTANT
    // =====================================================================

    if ($action === 'return_to_creator') {

        $purchaseRequest->status = 'pending_inv_tl';
        $purchaseRequest->rejection_reason = $validated['rejection_reason'];

        $message =
            'Purchase request returned to the Greenhills Inventory Assistant for corrections.';

        $purchaseRequest->save();

        // Find Inventory Assistants for this branch.
        $assistants = User::whereHas('role', function ($q) {
            $q->where('name', 'like', '%Inventory Assist%');
        })
        ->whereHas('branches', function ($q) use ($purchaseRequest) {
            $q->where('name', $purchaseRequest->branch);
        })
        ->get();

        if ($assistants->isNotEmpty()) {

            $alertMessage =
                "Your PR from {$purchaseRequest->department} ({$purchaseRequest->branch}) "
                . "was returned by the Operations Manager for corrections.";

            Notification::send(
                $assistants->unique('id'),
                new PendingApprovalNotification(
                    $purchaseRequest,
                    $alertMessage
                )
            );
        }

        return back()->with('success', $message);
    }

    // =====================================================================
    // 7. STANDARD APPROVE
    // =====================================================================

    if ($action === 'approve') {

        switch ($purchaseRequest->status) {

            // -------------------------------------------------------------
            // Inventory TL
            // -------------------------------------------------------------
            case 'pending_inv_tl':

                $purchaseRequest->status = 'pending_ops_manager';
                $purchaseRequest->rejection_reason = null;

                $message =
                    'Purchase request approved by Inventory Team Lead and forwarded to the Operations Manager.';

                break;


            // -------------------------------------------------------------
            // Operations Manager
            // -------------------------------------------------------------
            case 'pending_ops_manager':

                $purchaseRequest->status = 'pending_procurement';
                $purchaseRequest->rejection_reason = null;

                $message =
                    'Purchase request approved by Operations Manager and forwarded to Procurement Team Leader.';

                break;


            // -------------------------------------------------------------
            // Procurement TL
            // -------------------------------------------------------------
            case 'pending_procurement':

                $purchaseRequest->status = 'pending_evp_final';
                $purchaseRequest->rejection_reason = null;

                $message =
                    'Purchase request approved by Procurement Team Lead and forwarded to the Executive Vice President for final approval.';

                break;


            // -------------------------------------------------------------
            // EVP FINAL APPROVAL
            // -------------------------------------------------------------
            case 'pending_evp_final':

                // Only EVP can perform the final approval.
                if ($user->role_id !== 9) {
                    abort(
                        403,
                        'Only the Executive Vice President can give final approval.'
                    );
                }

                $purchaseRequest->status = 'approved';
                $purchaseRequest->rejection_reason = null;

                $message =
                    'Purchase request has received final approval.';

                break;


            default:

                return back()->with(
                    'error',
                    'Purchase request cannot be approved from its current status.'
                );
        }

        $purchaseRequest->save();

        $this->notifyNextApprovers($purchaseRequest);

        return back()->with('success', $message);
    }

    // =====================================================================
    // 8. CANCEL
    // =====================================================================

    if ($action === 'cancel') {

        $purchaseRequest->status = 'cancelled';

        $purchaseRequest->save();

        $this->notifyNextApprovers($purchaseRequest);

        return back()->with(
            'success',
            'Purchase request has been cancelled.'
        );
    }

    // =====================================================================
    // 9. STANDARD REJECTION
    // =====================================================================

    if ($action === 'reject') {

        $purchaseRequest->status = 'rejected';
        $purchaseRequest->rejection_reason = $validated['rejection_reason'];

        $message = 'Purchase request has been rejected.';

        $purchaseRequest->save();

        $this->notifyNextApprovers($purchaseRequest);

        return back()->with('success', $message);
    }

    // =====================================================================
    // 10. CC USER STATUS NOTIFICATION
    // =====================================================================

    $ccUser = $purchaseRequest->cc_user;

    if ($ccUser) {

        $ccUser->notify(
            new PRPOCcStatusUpdate(
                $purchaseRequest,
                'PR',
                "A Purchase Request you are copied on was {$action}."
            )
        );
    }

    return back()->with(
        'success',
        'Purchase Request status updated successfully.'
    );
}


    // public function update(Request $request, $id)
    // {
    //     // 🔐 ACL CHECK: Verify user can EDIT purchase_requests (not just approve)
    //     // Permission Hierarchy: Full only can edit existing requests
    //     $user = Auth::user();
    //     if (!$user->canEditModule('purchase_requests')) {
    //         abort(403, 'You do not have permission to update purchase requests.');
    //     }

    //     $pr = PurchaseRequest::findOrFail($id);

    //     $validated = $request->validate([
    //         'branch' => 'required|string|max:255',
    //         'department' => 'required|string|max:255',
    //         'request_type' => 'nullable|string|max:255',
    //         'priority' => 'nullable|string|max:255',
    //         'date_needed' => 'nullable|date',
    //         'budget_status' => 'nullable|string|max:255',
    //         'budget_ref' => 'nullable|string|max:255',
    //         'purpose_of_request' => 'nullable|string',
    //         'impact_if_not_procured' => 'nullable|string',
    //         'cc_user_id' => 'nullable|exists:users,id',

    //         'items' => 'required|array|min:1',
    //         'items.*.id' => 'nullable|exists:purchase_request_items,id',
    //         'items.*.product_id' => 'required|exists:products,id',
    //         'items.*.supplier_id' => 'nullable|exists:suppliers,id',
    //         'items.*.specifications' => 'nullable|string|max:255',
    //         'items.*.unit' => 'nullable|string|max:50',
    //         'items.*.qty_requested' => 'required|numeric|min:0',
    //         'items.*.qty_on_hand' => 'nullable|numeric|min:0',
    //         'items.*.reorder_level' => 'nullable|numeric|min:0',
    //         'items.*.est_unit_cost' => 'nullable|numeric|min:0',
    //         'items.*.total_cost' => 'nullable|numeric|min:0',
    //     ]);

    //     $userRole = strtolower(Auth::user()->role->name ?? '');
    //     $isGreenhillsAssistant = str_contains($userRole, 'inventory assist') && $validated['branch'] === 'Greenhills';
    //     $statusAutoForwarded = false;

    //     $updateData = [
    //         'branch' => $validated['branch'],
    //         'department' => $validated['department'],
    //         'request_type' => $validated['request_type'],
    //         'priority' => $validated['priority'],
    //         'date_needed' => $validated['date_needed'],
    //         'budget_status' => $validated['budget_status'],
    //         'budget_ref' => $validated['budget_ref'],
    //         'purpose_of_request' => $validated['purpose_of_request'],
    //         'impact_if_not_procured' => $validated['impact_if_not_procured'],
    //         'cc_user_id' => $validated['cc_user_id'] ?? null,
    //     ];

    //     // 🟢 UN-STUCK LOGIC FOR GREENHILLS ASSISTANTS
    //     // If a Greenhills Assistant edits a returned PR, auto-bump it back to the OM
    //     if ($isGreenhillsAssistant && $pr->status === 'pending_inv_tl') {
    //         $updateData['status'] = 'pending_ops_manager';
    //         $updateData['rejection_reason'] = null;
    //         $statusAutoForwarded = true;
    //     }

    //     // 1. Update the PR header fields
    //     $pr->update($updateData);

    //     // 2. Sync items: Delete items that the user removed in the frontend
    //     $existingItemIds = collect($validated['items'])->pluck('id')->filter()->all();
    //     $pr->items()->whereNotIn('id', $existingItemIds)->delete();

    //     // 3. Update existing items or Create new ones
    //     foreach ($validated['items'] as $itemData) {
    //         if (isset($itemData['id'])) {
    //             $pr->items()->where('id', $itemData['id'])->update($itemData);
    //         } else {
    //             $pr->items()->create($itemData);
    //         }
    //     }

    //     // 🟢 Re-trigger the OM notification if the PR was auto-forwarded
    //     if ($statusAutoForwarded) {
    //         $this->notifyNextApprovers($pr);
    //     }

    //     return redirect()->back()->with('success', 'Purchase Request updated successfully.');
    // }

    // public function print(PurchaseRequest $purchaseRequest)
    // {
    //     $purchaseRequest->load(['user','cc_user', 'items.product', 'items.supplier']);

    //     return Inertia::render('PRPO/PrintablePR', [
    //         'pr' => $purchaseRequest
    //     ]);
    // }

    private function notifyNextApprovers(PurchaseRequest $pr)
{
    // Always notify the original requester
    $usersToNotify = collect([$pr->user]);
    $message = '';

    if ($pr->status === 'pending_inv_tl') {

        // Standard branches:
        // Inventory Assistant → Inventory TL
        $approvers = User::whereHas('role', function ($q) {
            $q->where('name', 'Inventory TL');
        })
        ->whereHas('branches', function ($q) use ($pr) {
            $q->where('name', $pr->branch);
        })
        ->get();

        $usersToNotify = $usersToNotify->merge($approvers);

        $message = "PR from {$pr->department} ({$pr->branch}) is now pending Inventory Team Lead approval.";

    } elseif ($pr->status === 'pending_ops_manager') {

        // Greenhills skips Inventory TL and goes directly here.
        // Standard branches arrive here after Inventory TL approval.

        $approvers = User::whereHas('role', function ($q) {
            $q->where('name', 'Operations Manager');
        })
        ->whereHas('branches', function ($q) use ($pr) {
            $q->where('name', $pr->branch);
        })
        ->get();

        $usersToNotify = $usersToNotify->merge($approvers);

        $message = "PR from {$pr->department} ({$pr->branch}) is now pending Operations Manager approval.";

    } elseif ($pr->status === 'pending_procurement') {

    // Procurement Team Lead is the actual approver.
    // Procurement Assistant only reviews/supports the PR.
    $procurementTeam = User::where('role_id', 17)->get();

    $usersToNotify = $usersToNotify->merge($procurementTeam);

    $message = "PR from {$pr->department} ({$pr->branch}) is now pending Procurement Team Lead approval.";

    } elseif ($pr->status === 'pending_evp_final') {

        // EVP Final approval
        $evp = User::where('role_id', 9)->get();

        $usersToNotify = $usersToNotify->merge($evp);

        $message = "PR from {$pr->department} ({$pr->branch}) is now pending EVP Final approval.";

    } elseif ($pr->status === 'approved') {

        // Fully approved PR.
        $message = "PR from {$pr->department} ({$pr->branch}) has received final approval.";

    } elseif ($pr->status === 'rejected') {

        $message = "PR from {$pr->department} ({$pr->branch}) was rejected.";

    } elseif ($pr->status === 'cancelled') {

        $message = "PR from {$pr->department} ({$pr->branch}) was cancelled.";
    }

    // Keep CC notifications
    if (!empty($pr->cc_users)) {
        $ccUsers = User::whereIn('id', $pr->cc_users)->get();
        $usersToNotify = $usersToNotify->merge($ccUsers);
    }

    // Remove duplicate users
    $usersToNotify = $usersToNotify->unique('id');

    // Send notifications
    if ($usersToNotify->isNotEmpty()) {
        Notification::send(
            $usersToNotify,
            new PendingApprovalNotification($pr, $message)
        );
        }
    }
}