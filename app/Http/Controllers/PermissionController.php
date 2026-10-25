<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * 🔐 Permission Controller
 * 
 * Handles permission-related actions like refreshing/clearing permission caches.
 * This helps users immediately see updated ACL permissions without logging out.
 */
class PermissionController extends Controller
{
    /**
     * Refresh the current user's permissions from the database.
     * 
     * This forces Laravel to reload the user's role and ACL permissions fresh from the database,
     * ensuring the user immediately sees changes made by admins without needing to log out.
     * 
     * @return \Illuminate\Http\RedirectResponse
     */
    public function refreshPermissions(Request $request)
    {
        $user = Auth::user();
        
        if (!$user) {
            return back()->with('error', 'You must be logged in to refresh permissions.');
        }

        // 🔐 Force reload the user's role and ACL data from the database
        $user->load(['role', 'role.adminAcls', 'position', 'department', 'branch', 'branches']);
        
        // 🟢 Inertia will automatically include fresh permissions in the next page render
        // because HandleInertiaRequests middleware calls getPermissionStrings() on each request
        
        return back()->with('success', 'Permissions have been refreshed! You should now see any recently granted access.');
    }

    /**
     * Clear all session data and force a fresh page load.
     * 
     * This is a nuclear option - clears the entire session so a fresh one is created on next request.
     * Useful if permissions seem stuck due to browser/session caching.
     * 
     * @return \Illuminate\Http\RedirectResponse
     */
    public function clearSessionCache(Request $request)
    {
        // Get current user ID before clearing session
        $userId = Auth::id();
        
        // Flush the session entirely
        $request->session()->flush();
        
        // Regenerate session ID to prevent fixation attacks
        $request->session()->regenerate();
        
        // Re-authenticate the user since we just flushed the session
        Auth::loginUsingId($userId);
        
        return back()->with('success', 'Session cache cleared! Permissions have been refreshed.');
    }
}
