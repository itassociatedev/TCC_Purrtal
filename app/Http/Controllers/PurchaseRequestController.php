<?php


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
    public function create()
    {
        $user = Auth::user();
        $userBranches = $user->branches()->pluck('name')->toArray();

        $suppliers = Supplier::select('id', 'name')->get();
        $products = Product::select('id', 'name', 'supplier_id', 'details', 'unit', 'price')->get();
        $branches = Branch::select('id', 'name')->get();
        $departments = Department::select('id', 'name')->get();
        $employees = User::with('branches:id,name')
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

    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user->canCreateModule('purchase_requests')) {
            abort(403, 'You do not have permission to create purchase requests.');
        }

        $ccData = $request->input('cc_users');
        if (empty($ccData) && $request->has('cc_user_id')) {
            $legacyCc = $request->input('cc_user_id');
            $request->merge([
                'cc_users' => is_array($legacyCc) ? $legacyCc : (!empty($legacyCc) ? [$legacyCc] : [])
            ]);
        }

        $validated = $request->validate([
            'branch' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'date_prepared' => 'required|date',
            'request_type' => 'nullable|string|max:255',
            'priority' => 'required|string|max:255',
            'date_needed' => 'required|date|after_or_equal:today',
            'budget_status' => 'nullable|string|max:255',
            'budget_ref' => 'nullable|string|max:255',
            'purpose_of_request' => 'nullable|string',
            'impact_if_not_procured' => 'nullable|string',
            'cc_users' => 'nullable|array',
            'cc_users.*' => 'exists:users,id',
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
        $branchName = trim($validated['branch']);
        $isInventoryAssist = str_contains(strtolower(trim($user->role->name ?? '')), 'inventory assist');


        $targetBranches = ['makati', 'greenhills', 'alabang'];
        $isTargetBranch = in_array(strtolower($branchName), $targetBranches);

        $hasInvTL = false;
        if ($isTargetBranch) {
            $hasInvTL = User::whereHas('role', function ($q) {
                $q->where('name', 'LIKE', '%Inventory TL%')
                    ->orWhere('name', 'LIKE', '%Inventory Team Lead%');
            })->whereHas('branches', function ($q) use ($branchName) {
                $q->where('name', $branchName);
            })->exists();
        }

        if (($isTargetBranch && !$hasInvTL && $isInventoryAssist) || $userRoleId === 15) {
            $initialStatus = 'pending_ops_manager';
        } else {
            $initialStatus = 'pending_inv_tl';
        }

        DB::transaction(function () use ($validated, $initialStatus) {
            $pr = PurchaseRequest::create([
                'user_id' => Auth::id(),
                'prepared_by_name' => Auth::user()->name,
                'prepared_by_role' => Auth::user()->role->name ?? 'Employee',
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
                'cc_users' => $validated['cc_users'] ?? null,
            ]);

            foreach ($validated['items'] as $item) {
                $pr->items()->create($item);
            }

            $this->notifyNextApprovers($pr);

            $ccRecipients = collect();
            $ccUserIds = $validated['cc_users'] ?? [];

            if (!empty($ccUserIds)) {
                $manualCcs = User::whereIn('id', $ccUserIds)->get();
                $ccRecipients = $ccRecipients->merge($manualCcs);
            }

            $auditors = User::whereHas('role', function ($query) {
                $query->whereIn('name', ['Auditor TL', 'Audit Assistant']);
            })->get();

            $allCcUsers = $ccRecipients->merge($auditors)->unique('id');

            foreach ($allCcUsers as $recipient) {
                $reason = in_array($recipient->id, $ccUserIds)
                    ? "You were CC'd on a new Purchase Request by " . Auth::user()->name
                    : "A new Purchase Request was submitted for Audit review by " . Auth::user()->name;

                $recipient->notify(new PRPOCcStatusUpdate($pr, 'PR', $reason));
            }
        });

        return redirect()->route('prpo.approval-board', ['view' => 'my_requests'])
                        ->with('success', 'Purchase Request submitted successfully!');
    }

public function update(Request $request, $id)
    {

        $purchaseRequest = PurchaseRequest::findOrFail($id);

        $user = Auth::user();
        if (!$user->canEditModule('purchase_requests')) {
            abort(403, 'You do not have permission to edit purchase requests.');
        }

        $validated = $request->validate([
            'branch' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'request_type' => 'nullable|string|max:255',
            'priority' => 'nullable|string|max:255',
            'date_needed' => 'nullable|date|after_or_equal:today',
            'budget_status' => 'nullable|string|max:255',
            'budget_ref' => 'nullable|string|max:255',
            'purpose_of_request' => 'nullable|string',
            'impact_if_not_procured' => 'nullable|string',
            'cc_users' => 'nullable|array',
            'cc_users.*' => 'exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.id' => 'nullable',
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

        DB::transaction(function () use ($validated, $purchaseRequest) {
            $purchaseRequest->update([
                'branch' => $validated['branch'],
                'department' => $validated['department'],
                'request_type' => $validated['request_type'],
                'priority' => $validated['priority'],
                'date_needed' => $validated['date_needed'],
                'budget_status' => $validated['budget_status'],
                'budget_ref' => $validated['budget_ref'],
                'purpose_of_request' => $validated['purpose_of_request'],
                'impact_if_not_procured' => $validated['impact_if_not_procured'],
                'cc_users' => $validated['cc_users'] ?? [],
            ]);

            $incomingItemIds = collect($validated['items'])->pluck('id')->filter()->toArray();
            $purchaseRequest->items()->whereNotIn('id', $incomingItemIds)->delete();

            foreach ($validated['items'] as $itemData) {
                $product = Product::find($itemData['product_id']);
                $itemData['product_name'] = $product ? $product->name : 'Unknown Product';

                if (!empty($itemData['id'])) {
                    $purchaseRequest->items()->where('id', $itemData['id'])->update([
                        'product_id' => $itemData['product_id'],
                        'product_name' => $itemData['product_name'],
                        'supplier_id' => $itemData['supplier_id'] ?? null,
                        'specifications' => $itemData['specifications'] ?? null,
                        'unit' => $itemData['unit'] ?? null,
                        'qty_requested' => $itemData['qty_requested'],
                        'qty_on_hand' => $itemData['qty_on_hand'] ?? 0,
                        'reorder_level' => $itemData['reorder_level'] ?? 0,
                        'est_unit_cost' => $itemData['est_unit_cost'],
                        'total_cost' => $itemData['total_cost'],
                    ]);
                } else {
                    $purchaseRequest->items()->create($itemData);
                }
            }
        });

        return back()->with('success', 'Purchase Request updated successfully.');
    }

    public function approvalBoard(Request $request)
    {
        $user = Auth::user();
        $userRole = strtolower(trim($user->role->name ?? ''));
        $userBranches = $user->branches()->pluck('name')->toArray();

        $isAssistant = str_contains($userRole, 'assist');
        $isAdmin = str_contains($userRole, 'admin');
        $isEVP = str_contains($userRole, 'evp') || str_contains($userRole, 'president') || $user->role_id === 9;

        $defaultView = $isAssistant ? 'my_requests' : 'for_approval';
        $view = $request->query('view', $defaultView);

        $query = PurchaseRequest::with(['user', 'cc_user', 'items.product', 'items.supplier', 'purchaseOrders'])->latest();

        if ($view === 'my_requests') {
            $query->where('user_id', $user->id);
        }
        elseif ($view === 'for_approval') {
            $query->where(function ($q) use ($userRole, $isEVP, $isAdmin) {
                if ($isAdmin || $isEVP) {
                    $q->whereIn('status', ['pending_inv_tl', 'pending_ops_manager', 'pr_generated', 'pending_procurement']);
                } else {
                    if (str_contains($userRole, 'inventory tl')) {
                        $q->orWhere('status', 'pending_inv_tl');
                    }
                    if (str_contains($userRole, 'operations') || str_contains($userRole, 'ops manager') || $isEVP) {
                        $q->orWhere('status', 'pending_ops_manager');
                    }
                    if (str_contains($userRole, 'procurement assist') || $isEVP) {
                        $q->orWhereIn('status', ['pr_generated', 'pending_procurement']);
                    }
                }
            });

            if (!$isAdmin && !$isEVP && !empty($userBranches)) {
                $query->whereIn('branch', $userBranches);
            }
        }
        elseif ($view === 'for_generation') {
            $query->whereRaw('1 = 0');
        }
        elseif ($view === 'po_generated') {
            if ($isAdmin || str_contains($userRole, 'procurement') || $isEVP) {
                $query->where('status', 'po_generated');
            } else {
                $query->whereRaw('1 = 0');
            }
        }
        elseif ($view === 'history') {
            $query->whereIn('status', ['pr_generated', 'pending_procurement', 'pending_procurement_tl', 'po_generated', 'pending_evp_final', 'approved', 'rejected', 'cancelled']);

            if (!$isAdmin && !$isEVP && !empty($userBranches)) {
                $query->whereIn('branch', $userBranches);
            }
        }
        else {
            $query->whereRaw('1 = 0');
        }

        $requests = $query->paginate(15)->withQueryString();

        $suppliers = Supplier::select('id', 'name')->get();
        $products = Product::select('id', 'name', 'supplier_id', 'details', 'unit', 'price')->get();
        $branches = Branch::select('id', 'name')->get();
        $departments = Department::select('id', 'name')->get();
        $employees = User::with('branches:id,name')->select('id', 'name')->orderBy('name')->get();

        return Inertia::render('PRPO/ApprovalBoard', [
            'requests' => $requests,
            'currentView' => $view,
            'userBranches' => $userBranches,
            'isAssistant' => $isAssistant,
            'canSeeAll' => $isAdmin || str_contains($userRole, 'director'),
            'suppliers' => $suppliers,
            'products' => $products,
            'branches' => $branches,
            'departments' => $departments,
            'employees' => $employees,
        ]);
    }

    public function updateStatus(Request $request, PurchaseRequest $purchaseRequest)
    {
        $user = Auth::user();
        $action = $request->input('action');
        $userRole = strtolower(trim($user->role->name ?? ''));
        $isExecutive = str_contains($userRole, 'evp') || str_contains($userRole, 'president') || $userRole === 'admin';

        $validated = $request->validate([
            'action' => 'required|in:approve,generate_pr,generate_pr_as_om_fallback,review_pr,endorse,reject,cancel,return_to_inv_tl,return_to_creator',
            'rejection_reason' => 'required_if:action,reject|required_if:action,return_to_inv_tl|required_if:action,return_to_creator|nullable|string',
        ]);


        if (in_array($action, ['reject', 'return_to_inv_tl', 'return_to_creator', 'cancel'])) {
            if ($action === 'reject') {
                $purchaseRequest->status = 'rejected';
                $purchaseRequest->rejection_reason = $validated['rejection_reason'];
                $message = 'Purchase request has been rejected.';
            } elseif ($action === 'cancel') {
                $purchaseRequest->status = 'cancelled';
                $message = 'Purchase request has been cancelled.';
            } elseif ($action === 'return_to_inv_tl') {
                $purchaseRequest->status = 'pending_inv_tl';
                $purchaseRequest->rejection_reason = $validated['rejection_reason'];
                $message = 'Purchase request returned to Inventory TL for corrections.';
            } elseif ($action === 'return_to_creator') {
                $branchName = trim($purchaseRequest->branch);
                $targetBranches = ['makati', 'greenhills', 'alabang'];
                $isTargetBranch = in_array(strtolower($branchName), $targetBranches);

                $hasInvTL = false;
                if ($isTargetBranch) {
                    $hasInvTL = User::whereHas('role', function ($q) {
                        $q->where('name', 'LIKE', '%Inventory TL%')
                            ->orWhere('name', 'LIKE', '%Inventory Team Lead%');
                    })->whereHas('branches', function ($q) use ($branchName) {
                        $q->where('name', $branchName);
                    })->exists();
                }

                $purchaseRequest->status = ($isTargetBranch && !$hasInvTL) ? 'pending_ops_manager' : 'pending_inv_tl';
                $purchaseRequest->rejection_reason = $validated['rejection_reason'];
                $message = 'Purchase request returned for corrections.';
            }

            $purchaseRequest->save();
            $this->notifyNextApprovers($purchaseRequest);
            return back()->with('success', $message);
        }


        if ($action === 'approve') {
            if ($purchaseRequest->status === 'pending_inv_tl') {
                $userRole = strtolower(trim($user->role->name ?? ''));
                $isInventoryTL = str_contains($userRole, 'inventory tl');
                $isGreenhills = strtolower(trim($purchaseRequest->branch ?? '')) === 'greenhills';

                if (!$isInventoryTL && !($isExecutive && $isGreenhills) && $user->role_id !== 1) {
                    abort(403, 'Only the Inventory Team Leader can approve this request.');
                }

                $purchaseRequest->status = 'pending_ops_manager';
                $purchaseRequest->reviewed_by_id = $user->id;
                $purchaseRequest->reviewed_by_name = $user->name;
                $purchaseRequest->reviewed_by_role = $user->role->name ?? 'Inventory TL';
                $purchaseRequest->rejection_reason = null;
                $purchaseRequest->save();

                $this->notifyNextApprovers($purchaseRequest);

                return back()->with('success', 'Purchase request approved by Inventory Team Lead and forwarded to the Operations Manager.');
            }

            abort(403, 'You do not have permission to approve the request at its current stage.');
        }

        if ($action === 'generate_pr_as_om_fallback') {
            if (!$isExecutive) abort(403, 'Only the EVP can approve on behalf of the Operations Manager.');
            if ($purchaseRequest->status !== 'pending_ops_manager') abort(403, 'Invalid status.');

            $purchaseRequest->status = 'pr_generated';
            $purchaseRequest->is_evp_override = true;
            $purchaseRequest->approved_by_id = $user->id;
            $purchaseRequest->approved_by_name = $user->name;
            $purchaseRequest->approved_by_role = $user->role->name ?? 'Executive Vice President';
            $purchaseRequest->rejection_reason = null;
            $purchaseRequest->save();

            $this->notifyNextApprovers($purchaseRequest);
            return back()->with('success', 'Purchase Request generated on behalf of the unavailable Operations Manager.');
        }

        if ($action === 'generate_pr') {
            if (!str_contains($userRole, 'operations') && !str_contains($userRole, 'ops manager') && !$isExecutive) abort(403, 'Unauthorized.');
            if ($purchaseRequest->status !== 'pending_ops_manager') abort(403, 'Invalid status.');

            $purchaseRequest->status = 'pr_generated';
            $purchaseRequest->approved_by_id = $user->id;
            $purchaseRequest->approved_by_name = $user->name;
            $purchaseRequest->approved_by_role = $user->role->name ?? 'Operations Manager';
            $purchaseRequest->rejection_reason = null;
            $purchaseRequest->save();

            $this->notifyNextApprovers($purchaseRequest);
            return back()->with('success', 'Purchase Request document generated successfully. Forwarded to Procurement Assistant.');
        }

        if ($action === 'review_pr') {
            if (!str_contains($userRole, 'procurement assist') && !$isExecutive) abort(403, 'Unauthorized.');
            if ($purchaseRequest->status !== 'pr_generated') abort(403, 'Invalid status.');

            $purchaseRequest->status = 'pending_procurement';
            $purchaseRequest->save();
            return back()->with('success', 'Initial review of Purchase Request started.');
        }

        if ($action === 'endorse') {
            if (!str_contains($userRole, 'procurement assist') && !$isExecutive) abort(403, 'Unauthorized.');
            if (!in_array($purchaseRequest->status, ['pr_generated', 'pending_procurement'])) abort(403, 'Invalid status.');

            $purchaseRequest->status = 'pending_procurement_tl';
            $purchaseRequest->save();
            $this->notifyNextApprovers($purchaseRequest);
            return back()->with('success', 'Purchase Request endorsed to Procurement Team Leader.');
        }

        return back()->with('error', 'Invalid action or status.');
    }

    public function index(Request $request)
    {
        $user = Auth::user();
        $userRole = strtolower(trim($user->role->name ?? ''));
        $view = $request->query('view', 'active_prs');

        $query = PurchaseRequest::with(['user', 'items.product', 'purchaseOrders']);

        if ($view === 'active_prs') {
            $query->where('user_id', $user->id)
                ->whereNotIn('status', ['po_generated', 'cancelled', 'rejected']);
        } elseif ($view === 'for_approval') {
            if (str_contains($userRole, 'inventory tl')) {
                $query->where('status', 'pending_inv_tl');
            } elseif (str_contains($userRole, 'operations') || str_contains($userRole, 'evp') || $userRole === 'admin') {
                $query->where('status', 'pending_ops_manager');
            }
        } elseif ($view === 'for_generation') {
            $query->where('status', 'pending_procurement_tl');
        } elseif ($view === 'approved_prs') {
            $query->whereIn('status', ['po_generated']);
        }

        $requests = $query->latest()->paginate(15)->withQueryString();
        $employees = User::select('id', 'name')->orderBy('name')->get();

        return Inertia::render('PRPO/ApprovalBoard', [
            'requests' => $requests,
            'currentView' => $view,
            'employees' => $employees,
        ]);
    }

    public function print(PurchaseRequest $purchaseRequest)
    {
        $purchaseRequest->load([
            'user.role',
            'reviewedBy.role',
            'approvedBy.role',
            'cc_user',
            'items.product',
            'items.supplier'
        ]);

        $branchOM = null;
        if ($purchaseRequest->is_evp_override) {
            $omUser = User::whereHas('role', function ($q) {
                $q->where('name', 'LIKE', '%Operations Manager%')
                  ->orWhere('name', 'LIKE', '%Ops Manager%');
            })->whereHas('branches', function ($q) use ($purchaseRequest) {
                $q->where('name', $purchaseRequest->branch);
            })->first();

            $branchOM = $omUser ? $omUser->name : 'Operations Manager';
        }

        return Inertia::render('PRPO/PrintablePR', [
            'pr' => $purchaseRequest,
            'branchOM' => $branchOM
        ]);
    }

    private function notifyNextApprovers(PurchaseRequest $pr)
    {
        $usersToNotify = collect([$pr->user]);
        $message = '';

        if ($pr->status === 'pending_inv_tl') {
            $approvers = User::whereHas('role', function ($q) {
                $q->where('name', 'LIKE', '%Inventory TL%')
                    ->orWhere('name', 'LIKE', '%Inventory Team Lead%');
            })->whereHas('branches', function ($q) use ($pr) {
                $q->where('name', $pr->branch);
            })->get();
            $usersToNotify = $usersToNotify->merge($approvers);
            $message = "PR from {$pr->department} ({$pr->branch}) is now pending Inventory Team Lead approval.";

        } elseif ($pr->status === 'pending_ops_manager') {
            $approvers = User::whereHas('role', function ($q) { $q->where('name', 'Operations Manager'); })
                ->whereHas('branches', function ($q) use ($pr) { $q->where('name', $pr->branch); })->get();
            $usersToNotify = $usersToNotify->merge($approvers);
            $message = "PR from {$pr->department} ({$pr->branch}) is now pending Operations Manager approval.";

        } elseif ($pr->status === 'pr_generated') {
            $procurementAssistants = User::whereHas('role', function($q) { $q->where('name', 'like', '%procurement assist%'); })->get();
            $usersToNotify = $usersToNotify->merge($procurementAssistants);
            $message = "Purchase Request from {$pr->department} ({$pr->branch}) has been generated and awaits your initial review.";

        } elseif ($pr->status === 'pending_procurement_tl') {
            $procurementTeam = User::whereHas('role', function($q) { $q->where('name', 'like', '%procurement tl%'); })->get();
            $usersToNotify = $usersToNotify->merge($procurementTeam);
            $message = "PR from {$pr->department} ({$pr->branch}) has been endorsed and is ready for Purchase Order generation.";

        } elseif ($pr->status === 'rejected') {
            $message = "PR from {$pr->department} ({$pr->branch}) was rejected.";
        } elseif ($pr->status === 'cancelled') {
            $message = "PR from {$pr->department} ({$pr->branch}) was cancelled.";
        }

        if (!empty($pr->cc_users)) {
            $ccUsers = User::whereIn('id', $pr->cc_users)->get();
            $usersToNotify = $usersToNotify->merge($ccUsers);
        }

        $usersToNotify = $usersToNotify->unique('id');

        if ($usersToNotify->isNotEmpty() && $message !== '') {
            Notification::send($usersToNotify, new PendingApprovalNotification($pr, $message));
        }
    }
}
