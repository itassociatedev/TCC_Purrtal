<?php

namespace App\Http\Controllers;

use App\Models\PurchaseRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class PRPOStatusController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $userRole = strtolower(trim($user->role->name ?? ''));

        // 🟢 1. Define our VIP roles that need to see the PRs regardless of who created them
        $isGlobalViewer = $userRole === 'admin'
            || str_contains($userRole, 'director')
            || str_contains($userRole, 'evp')
            || str_contains($userRole, 'president')
            || str_contains($userRole, 'audit');

        // 2. Start the query with eager loading
        $query = PurchaseRequest::with([
            'user:id,name',
            'cc_user:id,name',
            'purchaseOrders.supplier',
            'purchaseOrders.items',
            'items.product'
        ]);

        // 3. 🟢 Apply the visibility rules
        if (!$isGlobalViewer) {
            // Normal users only see PRs they created or were manually CC'd on
            $query->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('cc_user_id', $user->id);
            });
        }
        // If they ARE an Auditor, the code skips the filter above
        // and safely loads all the PRs so they can do their job!

        $requests = $query->latest()->paginate(15);

        return Inertia::render('PRPO/StatusIndex', [
            'requests' => $requests
        ]);
    }
}
