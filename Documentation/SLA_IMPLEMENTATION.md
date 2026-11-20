# Ticketing SLA implementation — current reference

Audited **19 November 2026**. See [TICKETING.md](TICKETING.md) for the full module and [TICKETING_CODE_MAP.md](TICKETING_CODE_MAP.md) for implementation files.

## Policy and clock

SLA targets are managed by IT Supervisors in **Admin → SLA & priorities**. UI/API inputs use **support hours**, including fractions; storage/calculation uses whole seconds. The optional progress-update interval is also in hours. Resolution must be at least response, all nonblank values must be positive, and the maximum is 8,760 hours. Custom priorities appear in creation, management/handover, filters, dashboard counts, sorting, breach reports and workbook import/export.

`TicketPrioritySettings` reads `ticket_priorities` on the next request. Initial migration seeding uses the installed config and any deliberately enabled local short-target mode. After the table exists it is authoritative: changing `TICKET_SLA_TEST_MODE` and clearing config alone does not change stored targets. The table below describes the original production defaults, **not a live readout of administrator-edited settings**.

Source: [config/ticket-sla.php](../config/ticket-sla.php), [SupportClock.php](../app/Services/SupportClock.php), [TicketSla.php](../app/Services/TicketSla.php).

| Setting | Current value |
| --- | --- |
| Policy version | `admin-` plus a target hash for database-backed snapshots; config version before migration |
| Timezone | Asia/Manila |
| Daily support window | 07:30–19:00 |
| Support days | Every day, including weekends and public holidays |
| One support day | 11.5 support hours |
| Warning threshold | 20% or less of resolution allowance remaining |

| Display priority | Stored key | Response | Resolution | Progress-update reminder |
| --- | --- | --- | --- | --- |
| Critical | critical | 15 support minutes | 4 support hours | Every 30 support minutes without an update |
| High | high | 30 support minutes | 8 support hours | Every 2 support hours without an update |
| Medium | medium | 4 support hours | 34.5 support hours / 3 support days | No fixed configured interval |
| Low | low | 11.5 support hours / 1 support day | 57.5 support hours / 5 support days | No fixed configured interval |

Each new ticket receives a JSON snapshot of the current database-backed targets and configured calendar. Admin edits do not rewrite existing snapshots. An explicit priority change copies the latest target for the selected key into that ticket without resetting accumulated time. Completed response/resolution results retain their completion targets and elapsed values.

Portal/IT form creation and confirmed XLSX imports enroll new tickets using current server receipt time. No user-selectable incident/backdated receipt field remains. Outside-window hours do not consume support time; after-hours creation begins accumulating at the next opening. Existing unset priorities were converted to Low. SLA allowances use the existing receipt time and elapsed support time. There is no automatic on-call schedule.

## Priority lifecycle and historical SLA preservation

Supervisor removal permanently deletes an unused priority or archives one referenced by current tickets or priority-change history. Archived keys/labels remain available for historical display, filtering and reporting; new enrollment, imports and new priority assignments use active-only choices. Existing ticket snapshots and elapsed/completed milestone results are not rewritten. Restore makes the same key selectable again. A last-active guard prevents a configuration with no available priorities. Priority-row locks serialize removal against enrollment and priority changes; stale writes reject archived/deleted choices. An additive archived_at migration supplies this state.

## State and timing semantics

`Ticket::sla_policy` is the saved per-ticket policy (selected target may be refreshed on an explicit priority change); `sla_state` is action/timing state; `sla_received_at` uses [UtcDateTime](../app/Casts/UtcDateTime.php), explicitly storing/reading UTC even though the application timezone is Manila. The schema columns remain nullable for legacy tickets.

Important state keys include elapsed support seconds, running_since, acknowledged_at/by, response_result, resolved_at/by, resolution_result, resolution_documentation, paused_at/reason, restored_at, workaround/recovery_plan, workaround_accepted_at/by, confirmed_at, reopen_count, last_update_at, alerts and response/resolution-ever-breached flags. Activity JSON stores event-specific documentation and actors separately.

| Event | Timing behavior |
| --- | --- |
| Creation / enrollment | Resolution accumulator starts at receipt; response measured from receipt |
| Acknowledge | Requires assessment and next steps; records response milestone and actual responder; automated receipts/assignment do not count |
| Priority change | Supervisor or active handover member supplies a reason. An incomplete resolution adopts the latest selected-priority allowance without resetting elapsed time; completed milestones remain frozen. |
| Completed response | Keeps target in force at acknowledgment, so later downgrading cannot erase a late response |
| Completed resolution | Uses saved resolution_result target and elapsed time. A later priority change cannot turn an on-time completion into a breach, or erase a late completion. Historical breach flags remain. |
| Pause | Unavailable to all roles; rejected by HTTP validation and TicketSla::apply |
| Resume legacy pause | Only previously paused tickets can resume; retains elapsed seconds and starts a new running interval |
| Restore service temporarily | Records restoration/workaround; does not by itself satisfy resolution target or close the ticket |
| Leader accepts Critical workaround | After acknowledgment, details + plan required; stops resolution accumulation and satisfies resolution milestone while work/status remains open |
| Resolve ticket | After acknowledgment, Issue found + Fix applied and verification required. Stops work, records resolver/documentation; status becomes resolved |
| Close ticket | Leader-only, resolved prerequisite, documentation + closure explanation; records closed_at, no automatic closure |
| Reopen resolved/closed/accepted workaround | Reason required; resumes original remaining resolution allowance, excludes stopped interval; clears resolved/accepted-workaround/confirmation state and completed resolution result, clears closed_at when reopening Closed |

New user-initiated pauses are disabled, including vendor/requester waiting. Historical paused state/reasons and activities are retained, and existing paused tickets may resume with an explanation. Automatic stopping on resolution or review hold remains separate and unchanged. A delay/update does not extend the target or pause the clock. Changing priority does not erase recorded breaches.

A more urgent priority can make an already-used allowance immediately overdue. A less urgent priority can increase current remaining time, while prior breaches remain in history/reporting. For example, 2 hours consumed then Critical→High leaves 6 hours; High→Critical leaves 2 hours.

Requester confirmation verifies a resolved service but is neither required by the backend before closure nor an automatic closure trigger. Requester replies do not automatically resume/reopen. Acknowledgment history is retained across reopening; a new acknowledgment is not required for the original response milestone.

### Rejected tickets and revision holds

When an IT leader rejects or returns an IT member’s ticket, the review action records elapsed resolution support time and stops the running segment. These statuses are omitted from the SLA performance report and leaderboard and are skipped by the SLA checker. A returned ticket resumes its resolution clock with the accumulated time when the original creator resubmits. The original receipt time and acknowledgment history remain available, while the previous resolution, workaround acceptance, and confirmation are cleared from the current SLA state. Historical activities are retained.

## Permissions and persistence

TicketController uses the authenticated account and live-ticket scope, validates input and locks current ticket inside a DB transaction. Ordinary member management requires assignment to that locked row; the separate active-handover endpoint permits only assignment, priority/reason and In progress status after rechecking the grant. IT leadership may manage all tickets, assign to members/leaders, change priority, accept Critical workaround and close. Closure of an unresolved ticket is rejected. Closed work must be reopened before other management changes.

`TicketSla::apply` records activities, status transitions, assignment, priority review, requester communications, timing changes and milestone actors. `snapshot` calculates display data without changing elapsed state. `check` records alert/breach state. At risk, Breached, historical Paused and accepted workaround are SLA states rather than ticket statuses. Review statuses are revision_requested/rejected alongside not_started/in_progress/resolved/closed.

Legacy tickets with null policy remain excluded from tracking; the service supports their limited status-management path. The original SLA migration intentionally did not enroll old records. The later local demo replacement created new tracked examples rather than rewriting historic tickets into a fabricated format.

## Notifications and scheduling

Notifications use [TicketNotification.php](../app/Notifications/TicketNotification.php), database channel only, with ticket_id, message and action_url to `/tickets/all?selected_ticket=<ID>`. Ticket alerts are isolated in the IT notifications bell; regular notification counts and bulk actions exclude them. Email/Viber values describe how an incident was reported; they are not automatic outbound notification integrations.

- Creation notifies configured IT members/leaders; assignment notifies new owner.
- Acknowledgment, priority review, legacy pause resumption, restoration, progress, delays, resolution and reopening communicate through the existing website system.
- Changing priority to Critical/High records escalation and notifies staff recipients.
- The 20%-remaining alert, response/resolution breaches and required-progress reminders go to the owner and configured leaders. If a first check is already overdue, wording states overdue rather than pretending 20% remains.
- Alert markers deduplicate per priority/reopen cycle. Progress actions reset the progress-reminder marker.
- Closure is audited; after supervisor/resolved-first/documentation/note validation, tracked closure explicitly notifies the requester in `TicketSla::apply`. The optional feedback popup is driven by polling closed tickets, not by a push event.
- Preview mode suppresses live notifications and is excluded from scheduled SLA checks.

[CheckTicketSlas.php](../app/Console/Commands/CheckTicketSlas.php) registers `tickets:check-sla`: live tracked tickets with priority and status other than closed, chunked by ID, each reloaded under transaction/row lock. [routes/console.php](../routes/console.php) schedules it every minute with `withoutOverlapping()`. A host scheduler must actually invoke Laravel scheduling; registration alone does not start a worker. Staff management actions also run `check` before applying changes to preserve past breaches before reclassification.

```text
php artisan schedule:list
php artisan schedule:work
php artisan tickets:check-sla
```

Only the first command is read-only. Starting the worker or checker may send notifications. No scheduler deployment has been performed as part of the documentation audit.

## SLA performance definitions and filters

The leader receives `slaReport` from TicketController. Available percentage metrics display exactly two decimal places; unavailable values remain N/A. The compact React component shows summary strips, service-target table, priority-breach table, branch backlog and reopened/follow-up metrics, with expandable explanation. It is not displayed on All tickets, creation or leaderboard. The XLSX export may still contain its sheet regardless of that widget visibility.

`report_period=all/day/week/month/quarter` selects tracked tickets by **sla_received_at**, using Manila start-of-period converted to UTC. It does not filter ordinary reports/workload or adopt table search/status/creation-date filters.

| Metric | Definition |
| --- | --- |
| Tracked tickets | Tracked tickets in selected received period |
| At risk | Current resolution_status is At risk |
| Overdue open | Not resolved/closed, incomplete resolution milestone, currently Breached |
| Response/resolution compliance | Eligible classified milestones: completed, currently breached or historically breached. Numerator: Completed without any recorded previous breach. Denominator: all eligible. N/A when empty. |
| Average response/resolution | Elapsed support minutes of completed eligible milestones; not ordinary wall-clock duration |
| Breaches by priority | Current priority group; any current or prior response/resolution breach divided by all tracked tickets in that group |
| Reopened count/percent | Tickets with reopen_count > 0, divided by tracked count |
| Linked follow-ups | Distinct tickets with activity details containing linked_ticket_id |
| Branch backlog | Tracked tickets not resolved/closed grouped by branch; only branches with backlog appear |

Historical recorded breaches remain visible even if a priority change improves the current allowance. Accepted Critical workarounds can complete the SLA while the ticket is still open; the incomplete-milestone guard keeps them out of overdue-open counts. Staff-workload/leaderboard completion and contribution formulas are separate from SLA compliance; see the main guide.

## Ratings are separate from SLA

Feedback is optional, requester-only, and available only after closure. Self-ratings and IT member-to-member ratings are blocked; leaders may rate IT members on their own requested tickets. The star popup accepts numeric half steps from 0.5 to 5; comments appear at 3 or below and remain optional. A skipped prompt does not create a rating or change SLA/status. Feedback stores actual resolver attribution in activity JSON; reassignment does not move ratings. Member dashboard and leader staff-workload averages reuse this attribution. No shared requester rating metric remains in the SLA widget.

## Verification and operational limits

- `tests/Unit/SupportClockTest.php`: deterministic support-window/deadline boundaries.
- `tests/verify-ticket-sla.php`: configured-database integration, rollback and fake notifications; includes newest-priority allowance for active, paused and completed work, preserved response/completion audit, reopening, workaround acceptance, warning deduplication and breach history.
- `tests/verify-ticket-feedback.php` and `tests/ticket-rating-dialog.test.mjs`: queue ownership, skip/idempotency, half-star storage/validation and UI states.
- Other controller, dashboard, import/export, schema, department and frontend tests are catalogued in [TICKETING_CODE_MAP.md](TICKETING_CODE_MAP.md).

Past targeted checks passed at the time of implementation. A documentation-only audit does not certify the current host's running scheduler, deployment state, all historical fixtures or browser acceptance. The original fresh-database suite has a previously reported unrelated procurement-migration ordering blocker. Details and fixture caveats are in the main guide; do not substitute historical pass counts for a fresh validation run.


## Dated implementation notes

The sections above define current behavior; the following dated notes preserve implementation history.

## 2026-11-12 - Database-backed priority policies (current behavior)

`TicketPrioritySettings::policy()` combines the configured support calendar/warning threshold with `ticket_priorities` targets. `TicketSla::enroll()` snapshots that result. Global admin edits affect newly enrolled tickets only. An explicit ticket priority change adopts the latest selected priority target without resetting elapsed time; completed response/resolution results remain frozen. This supersedes earlier descriptions that completed resolution displays follow the newest priority. Existing tickets remain on saved targets until such a priority change. The admin screen uses support minutes while storage and calculations use seconds. Progress update intervals are optional; custom priorities do not automatically inherit Critical workaround acceptance or Critical/High escalation behavior.

The migration seeds installed values, including local test mode if enabled at migration time. After migration, changing `.env` test mode alone does not override database targets; edit the admin settings to change future-ticket values. No mass ticket-policy migration was performed.


### 2026-11-13 - Hour-based SLA customization and acknowledgement wording

TicketSlaSettings.jsx and TicketPriorityController now accept response_hours, resolution_hours and optional update_hours in support hours only, allowing fractional values such as 0.5. The server validates positive durations up to 8760 hours and converts them to rounded whole seconds (minimum one second). Existing stored targets are displayed in hours and retain their whole-second values when saved; no database or historical ticket conversion is needed. This supersedes previous minute-input documentation. The acknowledgement popup now explicitly directs requesters to the “All my tickets” page while retaining operating-hours guidance. Updated verify-ticket-priority-settings.php for fractional-hour conversion and invalid-value coverage.


### 2026-11-13 - Remove SLA pause permission for all roles

Removed the Pause resolution timer action and pause-reason form from Tickets/Index.jsx. TicketController rejects pause actions and pause_reason payloads; TicketSla::apply independently rejects pause for every role and no longer implements pausing. Existing paused tickets retain Resume resolution timer so their clocks can continue without backdating historical waiting time. Automatic resolution completion and review-hold/revision behavior are unchanged. No ticket data or elapsed time was rewritten. Tests: tests/verify-ticket-no-pause.php covers server rejection for supervisor/member/employee, unchanged state/history and legacy resume. Recent ticket feature changes are committed to taskmodule-ticketing-merge; local launcher/process files are excluded.


### 2026-11-19 - Automatic unique urgency ordering

Priority order is now a position, not an independent number. TicketPriorityOrdering.php locks the roster in a transaction, removes the edited row from its old position, inserts it at the requested position, and assigns consecutive positions to all rows (including archived priorities). Values beyond the list append to its end. The service writes through unused temporary positions before final positions to avoid collisions during swaps; transaction retries handle concurrent edits. Unused-priority deletion compacts positions; archive/restore retain positions. Priority keys, SLA targets, ticket policy/state and history are unchanged.

Migration 2026_11_19_000002_make_ticket_priority_order_unique.php normalizes existing ties/gaps by prior sort_order then ID and adds a unique database constraint; applied locally. TicketPriorityController.php delegates saves/compaction to the new service. TicketSlaSettings.jsx refreshes shifted server-owned positions on other cards and explains insertion behavior. tests/verify-ticket-priority-order.php verifies insertion, moving, append, archived/restored positions, deletion gaps, uniqueness and unchanged keys/targets using rolled-back fixtures. Ordering/settings/removal checks, PHP syntax and frontend build passed. No push performed.

## Position-based authorization and alert recipients (20 November 2026)

TicketAccess now derives the workflow solely from the HR position: IT Team Leader is supervisor; other IT-prefixed positions are members; other/missing positions are employees. Lifecycle and scheduler notification routing calls the same classifier, so actual IT staff using admin/employee portal roles are recognized consistently. Active-recipient filters remain in place. Timing calculations, targets, historical milestone results and stored ticket identities are unchanged by this migration. Supervisor-only administration, closure and Critical workaround acceptance remain restricted to the supervisor position. EVP's separate read-only leaderboard capability does not grant these actions.
