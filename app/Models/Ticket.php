<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Ticket extends Model
{
    private const CATEGORY_PREFIXES = ['Hardware' => 'HW', 'Software' => 'SW', 'Network' => 'NW', 'Account & Access' => 'AC', 'Other' => 'OT'];

    protected function performInsert(Builder $query)
    {
        return $this->getConnection()->transaction(function () use ($query) {
            $prefix = self::CATEGORY_PREFIXES[$this->category] ?? 'OT';
            $counter = $this->getConnection()->table('ticket_category_counters')->where('prefix', $prefix);
            // Incrementing first locks the counter until the ticket insert commits.
            if ($counter->increment('next_number') !== 1) {
                throw new \RuntimeException("Missing ticket counter for {$prefix}.");
            }
            $this->ticket_code = sprintf('%s%04d', $prefix, $counter->value('next_number') - 1);

            $inserted = parent::performInsert($query);
            if (!$inserted) $counter->decrement('next_number');

            return $inserted;
        });
    }

    protected $attributes = ['status' => 'not_started', 'is_preview' => false];
    // Only validated controller data is passed to these fields. Creator and
    // preview values are supplied by the server rather than the browser.
    protected $fillable = ['creator_id', 'branch_id', 'employee_name', 'subject', 'description', 'category', 'status', 'priority', 'assigned_to', 'closed_at', 'is_preview',
        'employee_department', 'affected_asset', 'operational_impact', 'supporting_links',
        'sla_policy', 'sla_state', 'sla_received_at', 'reporting_channel', 'emergency_reason'];

    protected function casts(): array
    {
        // A boolean cast makes strict live/preview comparisons reliable;
        // the closure date cast supports date-based reports.
        return ['closed_at' => 'datetime', 'is_preview' => 'boolean',
            'supporting_links' => 'array',
            'sla_policy' => 'array', 'sla_state' => 'array', 'sla_received_at' => \App\Casts\UtcDateTime::class];
    }

    // Explicit keys are needed because these columns differ from Laravel's
    // default user_id naming. The list eager-loads these relationships.
    public function creator() { return $this->belongsTo(User::class, 'creator_id'); }
    public function branch() { return $this->belongsTo(Branch::class); }
    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
    public function activities() { return $this->hasMany(TicketActivity::class)->orderByDesc('id'); }
}
