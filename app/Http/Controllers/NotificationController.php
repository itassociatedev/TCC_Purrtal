<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class NotificationController extends Controller
{
    // Keep portal list/count/read-all/clear operations separate from the ticket feed.
    public static function portalNotifications(\App\Models\User $user)
    {
        return $user->notifications()->where('type', '!=', \App\Notifications\TicketNotification::class);
    }

    public static function ticketRecipient(Request $request): \App\Models\User
    {
        $user = $request->user();
        if (!$request->filled('preview_person')) return $user;
        abort_unless(app()->environment(['local', 'testing']) && config('task_module.preview_enabled') && strtolower(trim($user->role?->name ?? '')) === 'admin', 403);
        return \App\Models\User::where('status', 'Active')
            ->where('name', $request->string('preview_person')->toString())->firstOrFail();
    }

    /** Clear only the signed-in user's portal notification history. */
    public function clear(Request $request)
    {
        self::portalNotifications($request->user())->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Display a paginated list of all notifications.
     */
    public function index(Request $request)
    {
        // Fetches 15 notifications per page
        $notifications = self::portalNotifications($request->user())->paginate(15);

        return Inertia::render('Notifications/Index', [
            'notifications' => $notifications,
        ]);
    }

    /**
     * Mark a single notification as read (Called via Axios in the background).
     */
    public function markAsRead(Request $request, $id)
    {
        // findOrFail is great here so it safely 404s if the ID doesn't exist
        $notification = $request->user()->notifications()->findOrFail($id);

        if (!$notification->read_at) {
            $notification->markAsRead();
        }

        // 🟢 Grab the specific URL we saved in the notification payload
        // If for some reason it doesn't exist, fallback to the dashboard
        $url = $notification->data['action_url'] ?? route('dashboard');

        // 🟢 Perform the Inertia redirect
        return redirect($url);
    }

    /**
     * Mark all unread notifications as read for the authenticated user.
     */
    public function markAllAsRead(Request $request)
    {
        self::portalNotifications($request->user())->whereNull('read_at')->update(['read_at' => now()]);

        // If called via Axios, return JSON. If called via normal Inertia visit, redirect back.
        if ($request->wantsJson()) {
            return response()->json(['success' => true]);
        }

        return back()->with('success', 'All notifications marked as read.');
    }

    public function loadMore(Request $request)
    {
        $offset = $request->query('offset', 20); // Default to skipping the first 20
        $limit = 20; // Fetch the next 20

        $notifications = self::portalNotifications($request->user())
            ->latest()
            ->skip($offset)
            ->take($limit)
            ->get();

        return response()->json([
            'notifications' => $notifications,
            'has_more' => $notifications->count() === $limit // If it fetched 20, there might be more
        ]);
    }
}
