<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Ticket extends Model
{
    public const REVIEW_HOLD_STATUSES = ['revision_requested', 'rejected'];

    public function isMemberSubmission(): bool
    {
        return $this->creator && \App\Services\TicketAccess::role($this->creator) === 'member';
    }

    private const CATEGORY_PREFIXES = ['Hardware' => 'HW', 'Software' => 'SW', 'Network' => 'NW', 'Account & Access' => 'AC', 'Other' => 'OT'];

    protected function performInsert(Builder $query)
    {
        return $this->withAllocatedTicketCode(fn () => parent::performInsert($query));
    }

    public function withAllocatedTicketCode(callable $persist): bool
    {
        return $this->getConnection()->transaction(function () use ($persist) {
            $categoryCode = self::CATEGORY_PREFIXES[$this->category] ?? 'OT';
            $locationCode = $this->locationCodeForTicketId();
            $year = ($this->created_at ?? $this->freshTimestamp())->copy()->setTimezone('Asia/Manila')->format('y');
            $scope = ['location_code' => $locationCode, 'category_code' => $categoryCode, 'year_suffix' => $year];
            $counters = $this->getConnection()->table('ticket_annual_counters');
            $counters->insertOrIgnore($scope + ['last_number' => 0]);
            $counter = $counters->where($scope);

            // Lock the sequence until the new code is saved.
            $number = (int) $counter->lockForUpdate()->value('last_number') + 1;
            if ($number > 99999) {
                throw new \RuntimeException("Ticket counter exhausted for {$locationCode}-{$categoryCode}-{$year}.");
            }
            $this->ticket_code = sprintf('%s-%s-%s%05d', $locationCode, $categoryCode, $year, $number);

            $saved = $persist();
            if ($saved) $counter->update(['last_number' => $number]);

            return $saved;
        });
    }

    private function locationCodeForTicketId(): string
    {
        if ($this->ticket_location_id) {
            return $this->ticketLocation()->value('code')
                ?? throw new \RuntimeException('The ticket location has no code.');
        }

        $branch = $this->branch()->firstOrFail();
        // The underscore keeps fallback codes distinct from custom location codes.
        return TicketLocation::BRANCH_CODES[strtolower(trim($branch->name))] ?? 'B_'.$branch->id;
    }

    protected $attributes = ['status' => 'not_started', 'priority' => 'low', 'is_preview' => false];
    // Only validated controller data is passed to these fields. Creator and
    // preview values are supplied by the server rather than the browser.
    protected $fillable = ['creator_id', 'branch_id', 'ticket_location_id', 'employee_name', 'subject', 'description', 'category', 'status', 'priority', 'assigned_to', 'closed_at', 'is_preview',
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
    public function ticketLocation() { return $this->belongsTo(TicketLocation::class)->withTrashed(); }

    public function affectedLocationName(): ?string
    {
        return $this->ticketLocation?->name ?? $this->branch?->name;
    }
    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
    public function activities() { return $this->hasMany(TicketActivity::class)->orderByDesc('id'); }
}
