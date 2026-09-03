<?php
// Purchase order controller: PO creation and management

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
    // =====================================================================
    // 1. VIEW ALL PURCHASE ORDERS (Procurement Dashboard)
    // =====================================================================
    public function index(Request $request)
    {
        $user = Auth::user();

        if (!$user || !$user->canViewModule('purchase_orders')) {
            abort(403, 'Unauthorized Action. Only authorized personnel can access the PO Dashboard.');
        }

        $userRole = strtolower(trim($user->role->name ?? ''));

        // 🟢 1. Define who gets restricted to the "My Request" tab
        $restrictedRoles = ['operations manager', 'inventory assist', 'inventory tl'];
        $isRestricted = in_array($userRole, $restrictedRoles);

        // 🟢 2. Get the requested view, but FORCE 'my_request' if they are restricted
        $view = $request->query('view', 'action_needed');
        if ($isRestricted) {
            $view = 'my_request';
        }

        $query = PurchaseOrder::with([
            'supplier', 'preparedBy', 'items.product',
            'purchaseRequest.user', 'purchaseRequest.items.product', 'purchaseRequest.items.supplier'
        ])->latest();

        // 🟢 3. Filter based on the selected view
        if ($view === 'action_needed') {
            if (in_array($userRole, ['procurement assist', 'procurement tl'])) {
                $query->where('status', 'drafted'); // Procurement must edit and submit drafts
                
            // 🚩 TIER 5 ROUTING: Send to EVP instead of DCSO
            } elseif (str_contains($userRole, 'evp') || str_contains($userRole, 'president')) {
                $query->where('status', 'pending_approval'); // EVP must approve submitted POs
                
            } elseif ($userRole === 'admin') {
                $query->whereIn('status', ['drafted', 'pending_approval']);
            }
            
        } elseif ($view === 'my_request') {
            // 🟢 NEW: Filter POs where the linked PR was created by the logged-in user
            $query->whereHas('purchaseRequest', function ($q) {
                $q->where('user_id', Auth::id());
            });
        }

        $purchaseOrders = $query->paginate(15)->withQueryString();

        return Inertia::render('PRPO/PurchaseOrdersIndex', [
            'purchaseOrders' => $purchaseOrders,
            'currentView' => $view,
            'isRestrictedRole' => $isRestricted
        ]);
    }

    // =====================================================================
    // 2. UPDATE / FINALIZE A PURCHASE ORDER
    // =====================================================================
    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        // 🔐 ACL CHECK: Verify user can EDIT purchase_orders
        $user = Auth::user();
        if (!$user->canEditModule('purchase_orders')) {
            abort(403, 'You do not have permission to update purchase orders.');
        }

        $userRole = strtolower(trim(Auth::user()->role->name ?? ''));
        $requestedStatus = $request->input('status');

        // 🟢 SECURITY CHECK: Procurement Assistants can ONLY save as drafted
        if (str_contains($userRole, 'procurement assist') && $requestedStatus !== 'drafted') {
            return back()->withErrors(['status' => 'Procurement Assistants are only authorized to Save Drafts. Please contact your TL to submit.']);
        }

        // 🚩 TIER 5 SECURITY CHECK: Only the EVP can finalize the PO
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
            'status' => 'required|in:drafted,pending_approval,approved,cancelled',
            'remarks' => 'nullable|string', 
            'removed_item_ids' => 'nullable', 
            'new_attachments' => 'nullable',  
            'new_attachments.*' => 'file|max:10240',
            'items' => 'nullable|array',
            'items.*.id' => 'required_with:items',
            'items.*.notes' => 'nullable|string|max:255', 
        ]);

        // Process Removed Items
        if ($request->filled('removed_item_ids')) {
            $removedIds = is_array($request->removed_item_ids) 
                ? $request->removed_item_ids 
                : explode(',', $request->removed_item_ids); 
                
            $purchaseOrder->items()->whereIn('id', $removedIds)->update(['status' => 'removed']);
        }

        if ($request->has('items')) {
            foreach ($request->items as $itemData) {
                PurchaseOrderItem::where('id', $itemData['id'])
                    ->where('purchase_order_id', $purchaseOrder->id)
                    ->update(['notes' => $itemData['notes'] ?? null]);
            }
        }

        // Process New File Uploads
        $attachments = $purchaseOrder->attachments ?? []; 
        
        if ($request->hasFile('new_attachments')) {
            $files = $request->file('new_attachments');
            if (!is_array($files)) {
                $files = [$files];
            }

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

        // Recalculate Math
        $activeItems = $purchaseOrder->items()->where('status', 'active')->get();
        $grossAmount = $activeItems->sum('net_payable');
        
        $discount = $validated['discount_total'] ?? 0;
        $netOfDiscount = $grossAmount - $discount;
        $vatDecimal = ($validated['vat_rate'] ?? 12) / 100;
        $vatTotal = $netOfDiscount * $vatDecimal;
        $grandTotal = $netOfDiscount + $vatTotal;

        // Save updates to DB
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

        // Status Notifications...
        $status = $validated['status'];
        $originalRequester = $purchaseOrder->purchaseRequest->user ?? null;

        if ($status === 'pending_evp_final') {
            $message = 'Purchase Order submitted to the Executive Vice President for final approval.';
            
            // 🚩 Ping the EVP
            $evpUsers = User::whereHas('role', function($q) {
                $q->where('name', 'like', '%evp%')->orWhere('name', 'like', '%president%')->orWhere('name', 'admin');
            })->get();
            
            if ($evpUsers->isNotEmpty()) {
                Notification::send($evpUsers, new POStatusUpdate($purchaseOrder, "Requires Executive Vice President Final Approval"));
            }
            
        } elseif ($status === 'approved') {
            $message = 'Purchase Order has been officially Approved by the Executive Vice President!';
            
            // Ping Procurement
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
        // 🔐 ACL CHECK: Verify user can CREATE purchase_orders
        // Permission Hierarchy: Full + Edit can create
        $user = Auth::user();
        if (!$user->canCreateModule('purchase_orders')) {
            abort(403, 'You do not have permission to generate purchase orders.');
        }

        $userRole = strtolower(trim(Auth::user()->role->name ?? ''));
        $allowedRoles = ['procurement assist', 'procurement tl', 'president', 'admin'];
        
        if (!in_array($userRole, $allowedRoles)) {
            abort(403, 'Unauthorized Action. Only the Procurement or the Executive Vice President can generate Purchase Orders.');
        }

        if (!in_array($purchaseRequest->status, [
    'approved',
    'pending_procurement_tl',
], true)) {
    return back()->with(
        'error',
        'This Purchase Request is not ready for Purchase Order generation.'
    );
}

        if (PurchaseOrder::where('purchase_request_id', $purchaseRequest->id)->exists()) {
            return back()->with('error', 'Purchase Orders have already been generated for this request.');
        }

        $items = $purchaseRequest->items()->with('product')->get();
        $groupedBySupplier = $items->groupBy('supplier_id');

        DB::transaction(function () use ($groupedBySupplier, $purchaseRequest) {
            foreach ($groupedBySupplier as $supplierId => $supplierItems) {
                if (!$supplierId) continue;

                $year = date('Y');
                $latestPo = PurchaseOrder::whereYear('created_at', $year)->orderBy('id', 'desc')->first();
                $nextNumber = $latestPo ? intval(substr($latestPo->po_number, -4)) + 1 : 1;
                $poNumber = 'PO-' . $year . '-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);

                $po = PurchaseOrder::create([
                    'purchase_request_id' => $purchaseRequest->id,
                    'supplier_id' => $supplierId,
                    'prepared_by_id' => Auth::id(),
                    'po_number' => $poNumber,
                    'po_date' => now()->toDateString(),
                    'delivery_date' => $purchaseRequest->date_needed,
                    'purpose' => $purchaseRequest->purpose_of_request,
                    'department' => $purchaseRequest->department,
                    'no_of_quotations' => 0, // 🟢 INIT TO 0 SO DB DOESN'T COMPLAIN
                    'status' => 'drafted'
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
                ->where('id', $purchaseRequest->id)
                ->update([
                    'status' => 'po_generated',
                    'updated_at' => now()
                ]);
        });

        $originalRequester = $purchaseRequest->user;
        if ($originalRequester) {
            $originalRequester->notify(new PRStatusUpdate($purchaseRequest, "Your request is currently being processed into Purchase Orders."));
        }

        $ccUser = $purchaseRequest->cc_user; 
        if ($ccUser) {
            $ccUser->notify(new PRPOCcStatusUpdate($purchaseRequest, 'PR', "Your Purchase Request is being processed into Purchase Orders."));
        }

        return back()->with('success', 'Purchase Orders drafted successfully! You can now review them.');
    }

    public function print(PurchaseOrder $purchaseOrder)
    {
        // 1. Load relationships, but ONLY grab active items!
        $purchaseOrder->load([
            'supplier', 
            'preparedBy', 
            'items' => fn($query) => $query->where('status', 'active')
        ]);

        // 2. Return the PDF view
        return view('prpo.pdf.purchase-order', ['po' => $purchaseOrder]);
    }
}