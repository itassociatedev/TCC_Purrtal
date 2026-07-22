<?php
// Middleware to restrict admin-only routes and checks

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
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
            return redirect()->route('login')
                ->with('error', 'Unauthenticated. Please log in to access this module.');
        }

        $module = $this->resolveAdminModule($request);

        if ($module !== null) {
            if ($this->userCanAccessAdminModule($user, $module)) {
                return $next($request);
            }

            return redirect()->route('dashboard')
                ->with('error', config('admin-acl.unauthorized_message'));
        }

        if ($user->has_global_access) {
            return $next($request);
        }

        return redirect()->route('dashboard')
            ->with('error', 'Unauthorized access. Admin privileges are required to access this module.');
    }

    private function userCanAccessAdminModule($user, ?string $module): bool
    {
        if ($user->canAccessModule($module)) {
            return true;
        }

        if ($module === 'admin_overview') {
            $fallbackModules = [
                'announcements',
                'employees',
                'company_content',
                'org_chart',
                'resource_links',
                'system_logs',
                'access_control',
            ];

            foreach ($fallbackModules as $fallbackModule) {
                if ($user->canAccessModule($fallbackModule)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function resolveAdminModule(Request $request): ?string
    {
        $route = $request->route();
        $routeName = $route ? $route->getName() : null;

        $routeMap = [
            'admin.dashboard' => 'admin_overview',
            'admin.logs.index' => 'system_logs',
            'admin.logs.export' => 'system_logs',
            'admin.company-content.index' => 'company_content',
            'admin.announcements.index' => 'announcements',
            'admin.resource-links.index' => 'resource_links',
            'admin.access-control.index' => 'access_control',
            'admin.employees' => 'employees',
            'admin.org-chart.index' => 'org_chart',
            'admin.documents.index' => 'documents',
        ];

        if ($routeName && isset($routeMap[$routeName])) {
            return $routeMap[$routeName];
        }

        $path = trim($request->path(), '/');
        if (!str_starts_with($path, 'admin/')) {
            return null;
        }

        $moduleSegment = explode('/', substr($path, 6))[0] ?? null;
        if (!$moduleSegment) {
            return null;
        }

        if ($moduleSegment === 'dashboard') {
            return 'admin_overview';
        }

        $moduleKey = strtolower(str_replace('-', '_', $moduleSegment));

        // Map legacy "users" route segment to the ACL module key 'employees'
        if ($moduleKey === 'users') {
            return 'employees';
        }

        return $moduleKey;
    }
}