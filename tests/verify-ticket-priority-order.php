<?php
// Installed-schema regression checks; all settings changes are rolled back.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{TicketPriority, User};
use App\Services\TicketAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
DB::beginTransaction();
try {
    $leader = User::with('role')->get()->first(fn ($u) => TicketAccess::role($u) === 'leader');
    $controller = app(App\Http\Controllers\TicketPriorityController::class);
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $request = function ($label, $position) use ($app, $leader) {
        $r = Request::create('/tickets/admin/priorities', 'POST', ['label' => $label, 'sort_order' => $position,
            'response_hours' => 0.25, 'resolution_hours' => 1, 'update_hours' => null]);
        $r->setUserResolver(fn () => $leader); $r->setLaravelSession($app['session']->driver()); return $r;
    };
    $dense = function () use ($check) {
        $orders = TicketPriority::orderBy('sort_order')->pluck('sort_order')->all();
        $check($orders === range(1, count($orders)), 'All priorities have unique consecutive positions');
    };
    $original = TicketPriority::orderBy('sort_order')->get()->mapWithKeys(fn ($p) => [$p->id => [$p->key, $p->response_seconds, $p->resolution_seconds]])->all();
    $create = function ($suffix, $position) use ($request, $controller) {
        $label = 'Order '.$suffix.' '.bin2hex(random_bytes(4));
        $controller->store($request($label, $position));
        return TicketPriority::where('label', $label)->firstOrFail();
    };
    $a = $create('A', 1); $b = $create('B', 1); $c = $create('C', 2);
    $check($b->fresh()->sort_order === 1 && $c->fresh()->sort_order === 2 && $a->fresh()->sort_order === 3, 'Inserting at an occupied position shifts existing priorities'); $dense();
    $controller->update($request($a->label, 1), $a);
    $check($a->fresh()->sort_order === 1 && $b->fresh()->sort_order === 2 && $c->fresh()->sort_order === 3, 'Moving upward shifts intervening priorities downward'); $dense();
    $controller->update($request($a->label, 10000), $a);
    $check($a->fresh()->sort_order === TicketPriority::count() && $b->fresh()->sort_order === 1, 'Moving beyond the list appends and closes the old gap'); $dense();
    $c->archived_at = now(); $c->save();
    $controller->update($request($a->label, $c->fresh()->sort_order), $a);
    $check($a->fresh()->sort_order !== $c->fresh()->sort_order, 'Archived priorities also retain unique positions');
    $position = $c->fresh()->sort_order;
    $controller->restore($request($c->label, $position), $c);
    $check($c->fresh()->sort_order === $position, 'Restoration preserves unique position'); $dense();
    $controller->destroy($request($b->label, 1), $b);
    $check(!TicketPriority::find($b->id), 'Unused priority removed'); $dense();
    try { TicketPriority::whereKey($a->id)->update(['sort_order' => $c->fresh()->sort_order]); throw new RuntimeException('Database accepted duplicate order'); }
    catch (Illuminate\Database\QueryException $e) { echo 'PASS: database unique constraint rejects duplicate order'.PHP_EOL; }
    foreach ($original as $id => $values) {
        $p = TicketPriority::findOrFail($id);
        $check([$p->key, $p->response_seconds, $p->resolution_seconds] === $values, 'Reordering preserves priority keys and SLA targets');
    }
} finally { DB::rollBack(); }
