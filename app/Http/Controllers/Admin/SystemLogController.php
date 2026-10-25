<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SystemLogController extends Controller
{
    public function index(Request $request)
    {
        $duty = $request->routeIs('admin.duty-meals.logs.*');
        if ($duty) abort_unless($request->user()->canEditModule('duty_meal_setup_roster'), 403);
        $query = SystemLog::with('user')->latest();
        if ($duty) $query->where('module', 'like', 'Duty Meal%');

        $this->applyFilters($query, $request);

        $logs = $query->paginate(15)->withQueryString();

        return Inertia::render('Admin/SystemLogs/Index', [
            'logs' => $logs,
            'dutyLogs' => $duty,
            'canDeleteLogs' => $request->user()->canDeleteModule($duty ? 'duty_meal_setup_roster' : 'system_logs'),
            'filters' => $request->only(['search', 'module', 'action', 'status', 'start_date', 'end_date']),
        ]);
    }

    public function export(Request $request)
    {
        $duty = $request->routeIs('admin.duty-meals.logs.*');
        if ($duty) abort_unless($request->user()->canEditModule('duty_meal_setup_roster'), 403);
        $query = SystemLog::with('user')->latest();
        if ($duty) $query->where('module', 'like', 'Duty Meal%');

        // Apply the exact same filters as the index method
        $this->applyFilters($query, $request);

        $logs = $query->get(); // Get all filtered logs instead of paginating

        $fileName = 'system_logs_' . date('Y-m-d_H-i-s') . '.csv';

        // Prepare the CSV headers
        $headers = [
            "Content-type"        => "text/csv",
            "Content-Disposition" => "attachment; filename=$fileName",
            "Pragma"              => "no-cache",
            "Cache-Control"       => "must-revalidate, post-check=0, pre-check=0",
            "Expires"             => "0"
        ];

        // Prepare the Columns
        $columns = ['Timestamp', 'User', 'Module', 'Action', 'Description', 'IP Address', 'Status'];

        $callback = function() use($logs, $columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns); // Write column headers

            foreach ($logs as $log) {
                // Format data for the CSV row
                fputcsv($file, [
                    $log->created_at->format('Y-m-d H:i:s'),
                    $log->user ? $log->user->name : 'System',
                    $log->module,
                    $log->action,
                    $log->description,
                    $log->ip_address,
                    $log->status
                ]);
            }

            fclose($file);
        };

        // Stream the download response back to the browser
        return response()->stream($callback, 200, $headers);
    }

    /**
     * Reusable method to apply query filters for both Index and Export
     */
    private function applyFilters($query, Request $request)
    {
        $request->validate(['start_date' => 'nullable|date_format:Y-m-d', 'end_date' => 'nullable|date_format:Y-m-d']);
        if ($request->filled('start_date') && $request->filled('end_date')) $request->validate(['end_date' => 'after_or_equal:start_date']);
        // 1. Search Filter
        if ($request->filled('search')) {
            $query->where(function($q) use ($request) {
                $q->where('description', 'like', '%' . $request->search . '%')
                  ->orWhere('ip_address', 'like', '%' . $request->search . '%')
                  ->orWhereHas('user', function($userQuery) use ($request) {
                      $userQuery->where('name', 'like', '%' . $request->search . '%');
                  });
            });
        }

        // 2. Module Filter (with custom Authentication logic)
        if ($request->filled('module')) {
            if ($request->module === 'Authentication') {
                $query->where(function($q) {
                    $q->where('module', 'Authentication')
                      ->orWhere('module', 'Auth') 
                      ->orWhereIn('action', ['Login', 'Failed Login', 'Logout']);
                });
            } else {
                $query->where('module', $request->module);
            }
        }

        // 3. Action Filter
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        // 4. Status Filter
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // 5. Date Range Filters
        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
    }

    public function destroy(Request $request, SystemLog $log)
    {
        if ($request->routeIs('admin.duty-meals.logs.*')) {
            abort_unless($request->user()->canDeleteModule('duty_meal_setup_roster') && str_starts_with($log->module, 'Duty Meal'), 403);
        } else {
            abort_unless($request->user()->canDeleteModule('system_logs'), 403);
        }
        $log->delete();
        return back()->with('success', 'Log entry deleted.');
    }
}
