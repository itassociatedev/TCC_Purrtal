<?php

namespace App\Http\Controllers;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use App\Notifications\POStatusUpdate;
use App\Notifications\PRStatusUpdate;
use App\Notifications\PRPOCcStatusUpdate;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();

        if (!$user || !$user->canViewModule('purchase_orders')) {
            abort(403, 'Unauthorized Action. Only authorized personnel can access the PO Dashboard.');
        }

        $userRole = strtolower(trim($user->role->name ?? ''));
        $restrictedRoles = ['operations manager', 'inventory assist', 'inventory tl'];
        $isRestricted = in_array($userRole, $restrictedRoles);

        $view = $request->query('view', 'action_needed');
        if ($isRestricted) {
            $view = 'my_request';
        }

        $query = PurchaseOrder::with([
            'supplier', 'preparedBy', 'items.product',
            'purchaseRequest.user', 'purchaseRequest.items.product', 'purchaseRequest.items.supplier'
        ])->latest();


        if ($view === 'action_needed') {

            $query->whereRaw('1 = 0');
        } elseif ($view === 'po_generation') {

            $query->where('status', 'po_generated');
        } elseif ($view === 'po_generated') {

            $query->where('status', 'pending_evp_final');
        } elseif ($view === 'all') {

            $query->where('status', 'approved');
        } elseif ($view === 'my_request') {
            $query->whereHas('purchaseRequest', function ($q) {
                $q->where('user_id', Auth::id());
            });
        } else {

            $query->whereRaw('1 = 0');
        }

        $purchaseOrders = $query->paginate(15)->withQueryString();


        $pendingPRs = [];
        if ($view === 'action_needed') {
            $pendingPRs = PurchaseRequest::with(['user', 'items.product', 'items.supplier'])
                ->where('status', 'pending_procurement_tl')
                ->whereDoesntHave('purchaseOrders') // 🟢 FIX: Prevent duplicate PO generation and bleed
                ->latest()
                ->get();
        }

        $employees = User::select('id', 'name')->orderBy('name')->get();

        return Inertia::render('PRPO/PurchaseOrdersIndex', [
            'purchaseOrders' => $purchaseOrders,
            'currentView' => $view,
            'isRestrictedRole' => $isRestricted,
            'pendingPRs' => $pendingPRs,
            'employees' => $employees
        ]);
    }


    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        $user = Auth::user();
        if (!$user->canEditModule('purchase_orders')) {
            abort(403, 'You do not have permission to update purchase orders.');
        }

        $userRole = strtolower(trim(Auth::user()->role->name ?? ''));
        $requestedStatus = $request->input('status');

        if ($requestedStatus === 'approved' && !str_contains($userRole, 'evp') && !str_contains($userRole, 'president') && $userRole !== 'admin') {
            return back()->withErrors(['status' => 'Unauthorized Action. Only the Executive Vice President can give final approval for Purchase Orders.']);
        }

        $validated = $request->validate([
            'delivery_date' => 'nullable|date',
            'payment_terms' => 'nullable|string|max:255',
            'ship_to' => 'nullable|string|max:255',
            'no_of_quotations' => 'required|integer|min:0',
            'discount_total' => 'nullable|numeric|min:0',
            'vat_rate' => 'nullable|numeric|min:0|max:100',
            'status' => 'required|in:po_generated,pending_evp_final,approved,cancelled',
            'remarks' => 'nullable|string',
            'removed_item_ids' => 'nullable',
            'new_attachments' => 'nullable',
            'new_attachments.*' => 'file|max:10240',
            'items' => 'nullable|array',
            'items.*.id' => 'required_with:items',
            'items.*.notes' => 'nullable|string|max:255',
        ]);

        if ($request->filled('removed_item_ids')) {
            $removedIds = is_array($request->removed_item_ids) ? $request->removed_item_ids : explode(',', $request->removed_item_ids);
            $purchaseOrder->items()->whereIn('id', $removedIds)->update(['status' => 'removed']);
        }

        if ($request->has('items')) {
            foreach ($request->items as $itemData) {
                PurchaseOrderItem::where('id', $itemData['id'])
                    ->where('purchase_order_id', $purchaseOrder->id)
                    ->update(['notes' => $itemData['notes'] ?? null]);
            }
        }

        $attachments = $purchaseOrder->attachments ?? [];
        if ($request->hasFile('new_attachments')) {
            $files = $request->file('new_attachments');
            if (!is_array($files)) $files = [$files];
            foreach ($files as $file) {
                if ($file->isValid()) {
                    $path = $file->store('po_attachments', 'public');
                    $attachments[] = [
                        'original_name' => $file->getClientOriginalName(),
                        'path' => $path,
                        'url' => Storage::url($path)
                    ];
                }
            }
        }

        $activeItems = $purchaseOrder->items()->where('status', 'active')->get();
        $grossAmount = $activeItems->sum('net_payable');
        $discount = $validated['discount_total'] ?? 0;
        $netOfDiscount = $grossAmount - $discount;
        $vatDecimal = ($validated['vat_rate'] ?? 12) / 100;
        $vatTotal = $netOfDiscount * $vatDecimal;
        $grandTotal = $netOfDiscount + $vatTotal;

        $purchaseOrder->update([
            'delivery_date' => $validated['delivery_date'],
            'payment_terms' => $validated['payment_terms'],
            'ship_to' => $validated['ship_to'],
            'no_of_quotations' => $validated['no_of_quotations'],
            'gross_amount' => $grossAmount,
            'discount_total' => $discount,
            'net_of_discount' => $netOfDiscount,
            'vat_total' => $vatTotal,
            'grand_total' => $grandTotal,
            'status' => $validated['status'],
            'remarks' => $validated['remarks'] ?? $purchaseOrder->remarks,
            'attachments' => empty($attachments) ? null : $attachments,
        ]);

        $status = $validated['status'];
        $originalRequester = $purchaseOrder->purchaseRequest->user ?? null;

        if ($status === 'pending_evp_final') {
            $message = 'Purchase Order submitted to the Executive Vice President for final approval.';
            $evpUsers = User::whereHas('role', function($q) {
                $q->where('name', 'like', '%evp%')->orWhere('name', 'like', '%president%')->orWhere('name', 'admin');
            })->get();
            if ($evpUsers->isNotEmpty()) {
                Notification::send($evpUsers, new POStatusUpdate($purchaseOrder, "Requires Executive Vice President Final Approval"));
            }
        } elseif ($status === 'approved') {
            $message = 'Purchase Order has been officially Approved by the Executive Vice President!';
            $procurementUsers = User::whereHas('role', function($q) {
                $q->where('name', 'like', '%procurement%')->orWhere('name', 'admin');
            })->get();
            if ($procurementUsers->isNotEmpty()) {
                Notification::send($procurementUsers, new POStatusUpdate($purchaseOrder, "Officially Approved by the Executive Vice President!"));
            }
            if ($originalRequester) {
                $originalRequester->notify(new POStatusUpdate($purchaseOrder, "Great news! Your items have been officially ordered."));
            }
        } elseif ($status === 'cancelled') {
            $message = 'Purchase Order has been cancelled.';
            if ($originalRequester) {
                $originalRequester->notify(new POStatusUpdate($purchaseOrder, "Notice: The Purchase Order for your items was cancelled."));
            }
        } else {
            $message = 'Purchase Order draft updated successfully.';
        }

        $ccUser = $purchaseOrder->purchaseRequest->cc_user ?? null;
        if ($status === 'approved' && $ccUser) {
            $ccUser->notify(new PRPOCcStatusUpdate($purchaseOrder, 'PO', "Items on a request you are copied on have been officially ordered."));
        } elseif ($status === 'cancelled' && $ccUser) {
            $ccUser->notify(new PRPOCcStatusUpdate($purchaseOrder, 'PO', "Notice: Your Purchase Order request was cancelled."));
        }

        return back()->with('success', $message);
    }

    public function generateFromPR(Request $request, PurchaseRequest $purchaseRequest)
    {
        $user = Auth::user();
        if (!$user->canCreateModule('purchase_orders')) {
            abort(403, 'You do not have permission to generate purchase orders.');
        }

        $userRole = strtolower(trim(Auth::user()->role->name ?? ''));
        $allowedRoles = ['procurement tl', 'president', 'admin', 'evp'];

        if (!in_array($userRole, $allowedRoles)) {
            abort(403, 'Unauthorized Action. Only the Procurement Team Leader or Executive Vice President can generate Purchase Orders.');
        }

        try {
            DB::transaction(function () use ($purchaseRequest) {
                $lockedPR = PurchaseRequest::where('id', $purchaseRequest->id)->lockForUpdate()->first();

                if (!$lockedPR || $lockedPR->status !== 'pending_procurement_tl') {
                    throw new \Exception('This Purchase Request is no longer in the correct status for PO generation.');
                }

                if (PurchaseOrder::where('purchase_request_id', $lockedPR->id)->exists()) {
                    throw new \Exception('Purchase Orders have already been generated for this request.');
                }

                $items = $lockedPR->items()->with('product')->get();
                $groupedBySupplier = $items->groupBy('supplier_id');

                foreach ($groupedBySupplier as $supplierId => $supplierItems) {
                    if (!$supplierId) continue;


                    $year = date('Y');
                    $poNumber = 'PO' . $year . '-' . str_pad($purchaseRequest->id, 5, '0', STR_PAD_LEFT);

                    $po = PurchaseOrder::create([
                        'purchase_request_id' => $lockedPR->id,
                        'supplier_id' => $supplierId,
                        'prepared_by_id' => Auth::id(),
                        'po_number' => $poNumber,
                        'po_date' => now()->toDateString(),
                        'delivery_date' => $lockedPR->date_needed,
                        'purpose' => $lockedPR->purpose_of_request,
                        'department' => $lockedPR->department,
                        'no_of_quotations' => 0,
                        'status' => 'po_generated'
                    ]);

                    $grossAmount = 0;

                    foreach ($supplierItems as $prItem) {
                        $description = $prItem->product ? $prItem->product->name : 'Custom Item';
                        if ($prItem->specifications) {
                            $description .= ' - ' . $prItem->specifications;
                        }

                        $qty = $prItem->qty_requested;
                        $unitPrice = $prItem->est_unit_cost ?? 0;
                        $lineTotal = $qty * $unitPrice;
                        $grossAmount += $lineTotal;

                        PurchaseOrderItem::create([
                            'purchase_order_id' => $po->id,
                            'product_id' => $prItem->product_id,
                            'description' => $description,
                            'qty' => $qty,
                            'unit' => $prItem->unit,
                            'unit_price' => $unitPrice,
                            'vat_rate' => 12.00,
                            'net_payable' => $lineTotal
                        ]);
                    }

                    $vatTotal = $grossAmount * 0.12;
                    $grandTotal = $grossAmount + $vatTotal;

                    $po->update([
                        'gross_amount' => $grossAmount,
                        'vat_total' => $vatTotal,
                        'grand_total' => $grandTotal
                    ]);
                }

                DB::table('purchase_requests')
                    ->where('id', $lockedPR->id)
                    ->update([
                        'status' => 'po_generated',
                        'updated_at' => now()
                    ]);
            });
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $originalRequester = $purchaseRequest->user;
        if ($originalRequester) {
            $originalRequester->notify(new PRStatusUpdate($purchaseRequest, "Your request has been successfully generated into Purchase Orders."));
        }

        $ccUser = $purchaseRequest->cc_user;
        if ($ccUser) {
            $ccUser->notify(new PRPOCcStatusUpdate($purchaseRequest, 'PR', "Your Purchase Request has been processed into Purchase Orders."));
        }

        return back()->with('success', 'Purchase Orders generated successfully! You can now review them.');
    }

    public function print(PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->load([
            'supplier',
            'preparedBy.role',
            'purchaseRequest.user.role',
            'purchaseRequest.reviewedBy.role',
            'purchaseRequest.approvedBy.role',
            'purchaseRequest.cc_user',
            'items' => fn($query) => $query->where('status', 'active')
        ]);

        return Inertia::render('PRPO/PrintablePO', [
            'po' => $purchaseOrder
        ]);
    }
}
