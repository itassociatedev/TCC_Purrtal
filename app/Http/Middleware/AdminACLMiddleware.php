<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminACLMiddleware
{
    /**
     * Handle an incoming request with ACL checks.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string|null  $module  The admin module to check (e.g., 'employees', 'duty_meal')
     */
    public function handle(Request $request, Closure $next, ?string $module = null): Response
    {
        $user = $request->user();

        // Check if user is authenticated
        if (!$user) {
            return redirect()->route('login')
                ->with('error', 'Unauthenticated. Please log in to access the admin panel.');
        }

        if ($module) {
            // Allow view-only users to access GET/HEAD requests when they have view/edit/full permission.
            if (in_array($request->method(), ['GET', 'HEAD'], true)) {
                if ($user->canViewModule($module)) {
                    return $next($request);
                }
            }

            if ($user->canAccessModule($module)) {
                return $next($request);
            }

            return redirect()->route('dashboard')
                ->with('error', config('admin-acl.unauthorized_message'));
        }

        if (!$user->has_global_access) {
            return redirect()->route('dashboard')
                ->with('error', 'Unauthorized access. Admin privileges are required to access this module.');
        }

        return $next($request);
    }
}
