<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\SystemLogController;
use App\Models\SystemLog;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class SystemLogManagementTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('system_logs', function (Blueprint $table) {
            $table->id(); $table->string('module'); $table->timestamps();
        });
    }

    private function logRequest(string $routeName, string $permission, bool $allowed): Request
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->shouldReceive('canDeleteModule')->with($permission)->andReturn($allowed);
        $request = Request::create('/logs/1', 'DELETE');
        $route = (new Route('DELETE', 'logs/{log}', fn () => null))->name($routeName);
        $request->setRouteResolver(fn () => $route);
        $request->setUserResolver(fn () => $user);
        return $request;
    }

    public function test_authorized_admin_log_deletion_removes_only_selected_entry(): void
    {
        $one = SystemLog::create(['module' => 'Admin']);
        $two = SystemLog::create(['module' => 'Duty Meal Setup']);
        (new SystemLogController)->destroy($this->logRequest('admin.logs.destroy', 'system_logs', true), $one);
        $this->assertNull(SystemLog::find($one->id));
        $this->assertNotNull(SystemLog::find($two->id));
    }

    public function test_duty_log_delete_cannot_target_another_module(): void
    {
        $log = SystemLog::create(['module' => 'Admin']);
        $this->expectException(HttpException::class);
        (new SystemLogController)->destroy($this->logRequest('admin.duty-meals.logs.destroy', 'duty_meal_setup_roster', true), $log);
    }

    public function test_read_only_user_cannot_delete_logs(): void
    {
        $log = SystemLog::create(['module' => 'Admin']);
        $this->expectException(HttpException::class);
        (new SystemLogController)->destroy($this->logRequest('admin.logs.destroy', 'system_logs', false), $log);
    }

    public function test_log_date_range_includes_boundary_days_and_excludes_other_dates(): void
    {
        foreach (['2026-10-24 23:59:59', '2026-10-25 00:00:00', '2026-10-25 23:59:59', '2026-10-26 00:00:00'] as $time) {
            SystemLog::create(['module' => 'Duty Meal Setup', 'created_at' => $time]);
        }
        $query = SystemLog::query();
        $request = Request::create('/logs', 'GET', ['start_date' => '2026-10-25', 'end_date' => '2026-10-25']);
        $method = new \ReflectionMethod(SystemLogController::class, 'applyFilters');
        $method->invoke(new SystemLogController, $query, $request);
        $this->assertSame(2, $query->count());
    }
}
