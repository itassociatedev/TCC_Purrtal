<?php
// All notification fixtures and bulk actions roll back; nothing is sent externally.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\User;
use App\Http\Controllers\NotificationController;
use App\Notifications\TicketNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
DB::beginTransaction();
try {
    $user = User::firstOrFail();
    $make = function ($type) use ($user) {
        return $user->notifications()->create(['id' => (string) Str::uuid(), 'type' => $type, 'data' => ['message' => 'Separation regression'], 'read_at' => null]);
    };
    $ticket = $make(TicketNotification::class); $portal = $make('PortalRegressionNotification');
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $check(!NotificationController::portalNotifications($user)->whereKey($ticket->id)->exists(), 'Regular query excludes ticket notices');
    $check(NotificationController::portalNotifications($user)->whereKey($portal->id)->exists(), 'Regular query retains non-ticket notices');
    $request = Request::create('/notifications/mark-all-read', 'POST'); $request->headers->set('Accept', 'application/json'); $request->setUserResolver(fn () => $user);
    $controller = app(NotificationController::class); $controller->markAllAsRead($request);
    $check($portal->fresh()->read_at !== null && $ticket->fresh()->read_at === null, 'Portal read-all leaves ticket unread state untouched');
    $controller->clear($request);
    $check($portal->fresh() === null && $ticket->fresh() !== null, 'Portal clear preserves ticket history');
    $check($user->notifications()->where('type', TicketNotification::class)->whereKey($ticket->id)->exists(), 'Ticket remains available to the IT feed');
} finally { DB::rollBack(); }
