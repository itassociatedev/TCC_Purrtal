<?php
// Role middleware for manpower requests (restrict route by role)

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ManpowerReqRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, ...$allowedRoles): Response
    {
        // Get the current user's role name safely
        $userRole = $request->user()->role->name ?? '';

        // 1. Check if their exact role is in the allowed list (e.g., 'Admin', 'HR Manager')
        if (in_array($userRole, $allowedRoles)) {
            return $next($request);
        }

        // 2. Special Check: If 'Team Leader' is required, allow anyone whose role contains that string
        if (in_array('TL', $allowedRoles) && str_contains($userRole, 'TL')) {
            return $next($request);
        }

        // 3. If they don't match, redirect with a flash error so the UI can show a toast.
        return redirect()->route('dashboard')
            ->with('error', 'Unauthorized. You do not have the required permissions to access this page.');
    }
}
