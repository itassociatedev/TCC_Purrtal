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

        $isGlobalViewer = $userRole === 'admin'
            || str_contains($userRole, 'director')
            || str_contains($userRole, 'evp')
            || str_contains($userRole, 'president')
            || str_contains($userRole, 'audit');


        $query = PurchaseRequest::with([
            'user:id,name',
            'cc_user:id,name',
            'purchaseOrders.supplier',
            'purchaseOrders.items',
            'items.product'
        ]);

        if (!$isGlobalViewer) {
            $query->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhereJsonContains('cc_users', $user->id)
                  ->orWhereJsonContains('cc_users', (string) $user->id);
            });
        }

        $requests = $query->latest()->paginate(15);

        return Inertia::render('PRPO/StatusIndex', [
            'requests' => $requests
        ]);
    }
}
