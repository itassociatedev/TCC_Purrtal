<?php

namespace App\Services;

use App\Models\SystemLog;
use Illuminate\Support\Facades\Request;

class LoggerService
{
    public static function log($module, $action, $description, $status = 'success', $userId = null)
    {
        SystemLog::create([
            // Use the provided userId, fallback to the authenticated user ID, or explicitly set to null
            'user_id' => $userId ?? auth()->id() ?? null,
            'module' => $module,
            'action' => $action,
            'description' => $description,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
            'status' => $status,
        ]);
    }
}