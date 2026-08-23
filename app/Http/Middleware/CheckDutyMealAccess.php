<?php
// Middleware to check duty meal access permissions

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckDutyMealAccess
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return redirect()->route('dashboard')
                ->with('error', 'Unauthenticated. Please log in to access the Duty Meal module.');
        }

        $canAccessAnyDutyMealModule = 
            $user->canAccessModule('duty_meal') ||
            $user->canAccessModule('duty_meal_setup_roster') ||
            $user->canAccessModule('duty_meal_archive');

        if ($request->routeIs('admin.duty-meals.archive')) {
            if (!$user->canViewModule('duty_meal_archive')) {
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to access the Duty Meal archive.');
            }

            return $next($request);
        }

        if ($request->routeIs('admin.duty-meals.create') || $request->routeIs('admin.duty-meals.store')) {
            if (!$user->canViewModule('duty_meal_setup_roster')) {
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to access Duty Meal roster setup.');
            }

            return $next($request);
        }

        if ($request->routeIs('admin.duty-meals.update-meals') ||
            $request->routeIs('admin.participants.update-choice') ||
            $request->routeIs('admin.participants.update-shift') ||
            $request->routeIs('admin.participants.remove') ||
            $request->routeIs('admin.duty-meals.destroy') ||
            $request->routeIs('admin.duty-meals.bulk-delete')) {
            if (!$user->canEditModule('duty_meal_setup_roster')) {
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to edit Duty Meal rosters.');
            }

            return $next($request);
        }

        if ($request->routeIs('admin.duty-meals.export')) {
            if (!$canAccessAnyDutyMealModule) {
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to export Duty Meal data.');
            }

            return $next($request);
        }

        if ($request->routeIs('admin.duty-meals.index')) {
            if (!$user->canViewModule('duty_meal') && !$user->canViewModule('duty_meal_archive') && !$user->canViewModule('duty_meal_setup_roster') && !$user->canViewModule('duty_meal_branch_requests') && !$user->canViewModule('duty_meal_personal')) {
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to view the Duty Meal module.');
            }

            return $next($request);
        }

        if ($request->isMethod('GET') || $request->isMethod('HEAD')) {
            if (!$canAccessAnyDutyMealModule) {
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to access the Duty Meal module.');
            }
        } else {
            if (!$user->canEditModule('duty_meal_setup_roster')) {
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to perform this action in the Duty Meal module.');
            }
        }

        return $next($request);
    }
}
