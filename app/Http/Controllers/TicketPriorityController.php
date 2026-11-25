<?php
namespace App\Http\Controllers;
use App\Models\TicketPriority;
use App\Services\TicketAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TicketPriorityController extends Controller
{
    public function store(Request $request) { return $this->save($request, new TicketPriority); }
    public function update(Request $request, TicketPriority $priority) { return $this->save($request, $priority); }
    public function destroy(Request $request, TicketPriority $priority)
    {
        abort_unless(TicketAccess::role($request->user()) === 'leader', 403);
        $archived = \Illuminate\Support\Facades\DB::transaction(function () use ($priority) {
            // Serialize removals so simultaneous requests cannot remove the final active choice.
            $priorities = TicketPriority::orderBy('id')->lockForUpdate()->get();
            $current = $priorities->firstWhere('id', $priority->id);
            abort_unless($current, 404);
            if (!$current->archived_at && $priorities->whereNull('archived_at')->count() <= 1) {
                throw \Illuminate\Validation\ValidationException::withMessages(['removal' => 'Keep at least one active priority.']);
            }
            if (\App\Services\TicketPrioritySettings::isUsed($current->key)) {
                if (!$current->archived_at) { $current->archived_at = now(); $current->save(); }
                return true;
            }
            $current->delete();
            \App\Services\TicketPriorityOrdering::compact();
            return false;
        });
        return back()->with('success', $archived ? 'Priority archived. Existing tickets and historical filters are preserved.' : 'Unused priority deleted.');
    }

    public function restore(Request $request, TicketPriority $priority)
    {
        abort_unless(TicketAccess::role($request->user()) === 'leader', 403);
        \Illuminate\Support\Facades\DB::transaction(function () use ($priority) {
            $current = TicketPriority::whereKey($priority->id)->lockForUpdate()->firstOrFail();
            $current->archived_at = null; $current->save();
        });
        return back()->with('success', 'Priority restored and available for new tickets.');
    }

    private function save(Request $request, TicketPriority $priority)
    {
        // Handover delegates cannot change global policy, even with a crafted request.
        abort_unless(TicketAccess::role($request->user()) === 'leader', 403);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:80', Rule::unique('ticket_priorities', 'label')->ignore($priority->id)],
            'response_hours' => ['required', 'numeric', 'gt:0', 'max:8760'],
            'resolution_hours' => ['required', 'numeric', 'gt:0', 'max:8760', 'gte:response_hours'],
            'update_hours' => ['nullable', 'numeric', 'gt:0', 'max:8760'],
            'sort_order' => ['required', 'integer', 'min:1', 'max:10000'],
        ]);
        // Inputs use hours only; clocks keep whole seconds so existing target storage is unchanged.
        $seconds = [];
        foreach (['response', 'resolution', 'update'] as $metric) {
            $seconds[$metric] = isset($data[$metric.'_hours']) ? (int) round($data[$metric.'_hours'] * 3600) : null;
            if ($seconds[$metric] !== null && $seconds[$metric] < 1) {
                throw \Illuminate\Validation\ValidationException::withMessages([$metric.'_hours' => 'The duration must be at least one second, expressed in hours.']);
            }
        }
        if (!$priority->exists) {
            // Stable keys keep existing tickets valid when a display label is renamed.
            $key = Str::slug($data['label'], '_');
            if (!$key || strlen($key) > 60 || in_array($key, ['all', 'urgent', 'not_set', 'notset']) || TicketPriority::where('key', $key)->exists()) {
                throw \Illuminate\Validation\ValidationException::withMessages(['label' => 'Choose a different priority name.']);
            }
            $priority->key = $key;
        }
        \App\Services\TicketPriorityOrdering::save($priority, ['label' => $data['label'],
            'response_seconds' => $seconds['response'], 'resolution_seconds' => $seconds['resolution'],
            'update_seconds' => $seconds['update']], (int) $data['sort_order']);
        return back()->with('success', 'SLA priority saved. New tickets use these targets; existing ticket targets are preserved.');
    }
}
