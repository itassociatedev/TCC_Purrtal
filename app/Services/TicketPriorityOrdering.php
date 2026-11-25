<?php
namespace App\Services;
use App\Models\TicketPriority;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TicketPriorityOrdering
{
    public static function save(TicketPriority $priority, array $attributes, int $position): void
    {
        DB::transaction(function () use ($priority, $attributes, $position) {
            // Every reorder takes the same row locks as removal; concurrent edits serialize.
            $rows = TicketPriority::orderBy('id')->lockForUpdate()->get();
            if ($priority->exists) {
                $current = $rows->firstWhere('id', $priority->id);
                abort_unless($current, 404);
            } else {
                if ($rows->count() >= 10000) throw ValidationException::withMessages(['sort_order' => 'The maximum number of priorities has been reached.']);
                // Use a fresh model on each retry; rolled-back inserts must not retain exists=true.
                $current = new TicketPriority(['key' => $priority->key]);
                $current->sort_order = (int) $rows->max('sort_order') + $rows->count() + 1;
            }
            $current->fill($attributes)->save();
            $ordered = $rows->where('id', '!=', $current->id)->sort(fn ($a, $b) => ($a->sort_order <=> $b->sort_order) ?: ($a->id <=> $b->id))->values()->all();
            // Treat requested order as an insertion position; oversized values append.
            array_splice($ordered, min(max(0, $position - 1), count($ordered)), 0, [$current]);
            self::writePositions($ordered);
        }, 3);
    }

    public static function compact(): void
    {
        $rows = TicketPriority::orderBy('id')->lockForUpdate()->get()
            ->sort(fn ($a, $b) => ($a->sort_order <=> $b->sort_order) ?: ($a->id <=> $b->id))->values()->all();
        self::writePositions($rows);
    }

    private static function writePositions(array $rows): void
    {
        // Use unused temporary values first so the unique index never collides during swaps.
        $offset = collect($rows)->max('sort_order') + count($rows) + 1;
        foreach ($rows as $index => $row) TicketPriority::whereKey($row->id)->update(['sort_order' => $offset + $index]);
        foreach ($rows as $index => $row) TicketPriority::whereKey($row->id)->update(['sort_order' => $index + 1]);
    }
}
