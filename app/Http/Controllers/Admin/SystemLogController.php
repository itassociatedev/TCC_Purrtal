<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class SystemLogController extends Controller
{
    public function index(Request $request)
    {
        $duty = $request->routeIs('admin.duty-meals.logs.*');
        if ($duty) abort_unless($request->user()->canEditModule('duty_meal_setup_roster'), 403);
        $query = $this->logQuery($duty);

        $this->applyFilters($query, $request);

        $logs = $query->paginate(15)->withQueryString();

        return Inertia::render('Admin/SystemLogs/Index', [
            'logs' => $logs,
            'dutyLogs' => $duty,
            'modules' => $this->logQuery($duty)->reorder()->distinct()->orderBy('module')->pluck('module'),
            'filters' => $request->only(['search', 'module', 'action', 'status', 'start_date', 'end_date']),
        ]);
    }

    public function export(Request $request)
    {
        $duty = $request->routeIs('admin.duty-meals.logs.*');
        if ($duty) abort_unless($request->user()->canEditModule('duty_meal_setup_roster'), 403);
        $query = $this->logQuery($duty);

        // Apply the exact same filters as the index method
        $this->applyFilters($query, $request);

        $logs = $query->get(); // Get all filtered logs instead of paginating

        return response()->streamDownload(function () use ($logs) {
            $book = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
            try {
                $sheet = $book->getActiveSheet();
                $rows = [['Timestamp', 'User', 'Module', 'Action', 'Description', 'IP Address', 'Status']];
                foreach ($logs as $log) {
                    $rows[] = [$log->created_at->format('Y-m-d H:i:s'), $log->user?->name ?? 'System', $log->module, $log->action, $log->description, $log->ip_address, $log->status];
                }
                foreach ($rows as $row => $values) {
                    foreach ($values as $column => $value) {
                        $sheet->setCellValueExplicitByColumnAndRow($column + 1, $row + 1, (string) $value, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
                    }
                }
                $sheet->freezePane('A2');
                (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($book))->save('php://output');
            } finally {
                $book->disconnectWorksheets();
            }
        }, 'system_logs_' . date('Y-m-d_H-i-s') . '.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    private function logQuery(bool $duty)
    {
        $query = SystemLog::with('user')->latest()->orderByDesc('id');
        if ($duty) return $query->where('module', 'like', 'Duty Meal%');

        if (Schema::hasTable('task_module_events')) {
            $logs = DB::table('system_logs')->select(
                'id', 'user_id', 'module', 'action', 'description', 'ip_address', 'status', 'created_at'
            );
            $title = DB::connection()->getQueryGrammar()->wrap('task.payload->title');
            $taskEvents = DB::table('task_module_events as event')
                ->leftJoin('task_module_records as task', 'task.id', '=', 'event.task_record_id')
                ->selectRaw("-event.id, event.actor_id, 'Task Module', event.event,
                    COALESCE({$title}, event.event),
                    NULL, 'success', event.created_at");
            $query->fromSub($logs->unionAll($taskEvents), 'system_logs');
        }

        return $query;
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
            } elseif ($request->module === 'Duty Meal Module') {
                $query->where('module', 'like', 'Duty Meal%');
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
        abort(403, 'Audit logs cannot be deleted.');
    }
}
