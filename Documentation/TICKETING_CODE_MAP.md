# Ticketing code map

Audited **19 November 2026**. This inventory covers ticketing code and the shared files it uses.

See [current system guide](TICKETING.md), [SLA reference](SLA_IMPLEMENTATION.md), and [change history](TICKETING_CHANGELOG.md).

## Current additions and integration boundaries

- `TicketPriorityController`, `TicketPriority`, `TicketPrioritySettings`, `TicketSlaSettings.jsx` and the 2026-11-12 priority migration implement supervisor-only hour-based settings. Routes support create/update, removal (delete unused/archive used) and restoration. No color-management endpoint exists.
- `Index.jsx` gets dynamic priority labels for selectors/filters/cards; `TicketSlaPerformance.jsx` uses the same labels for breach rows. Custom ticket priority text has no dedicated color; custom dashboard cards default blue.
- `TicketSubmissionAcknowledgement.jsx` displays a one-time receipt with configured operating hours and All my tickets guidance. It does not acknowledge the SLA. The upper-right role badge has been removed.
- `TicketLeaderboard.php` supplies per-resolver average support seconds/sample counts; the component and XLSX display support minutes. Pie slices use filled SVG sectors.
- `TicketController::assignDuringHandover` validates assignment/priority/status under active-grant locks. It does not delegate global SLA administration, approval or closure.
- `TicketSla::apply` rejects pause for every caller; `resume` is retained for legacy paused tickets. The demo factory records a vendor-wait update instead of pausing.
- `Ticket::withAllocatedTicketCode` uses `ticket_annual_counters`; category-only and location-category-only counters are historical migration artifacts.
- `verify-ticket-no-pause.php`, `verify-ticket-priority-settings.php`, `verify-ticket-handover-actions.php`, `verify-ticket-submission-receipt.php` and `verify-ticket-leaderboard-sla.php` are the focused installed-schema regression scripts. Transactional scripts roll back fixtures and fake notifications; the leaderboard checker is read-only.

## Application and frontend files

| File | Responsibility / entry points |
| --- | --- |
| [app/Http/Controllers/TicketController.php](../app/Http/Controllers/TicketController.php) | Authenticated role and ticket scope, filters, dashboards, ticket creation, location management, leader review, creator resubmission, feedback and XLSX. Review and resubmission validate status under a row lock. |
| [app/Models/Ticket.php](../app/Models/Ticket.php) | Annual ID allocation under a sequence lock, review statuses, creator/assignee and branch/location relationships, SLA casts and activity history. |
| [app/Models/TicketLocation.php](../app/Models/TicketLocation.php) | Built-in clinic codes and the separate model for custom locations. Soft deletion retires a location while preserving ticket references. |
| [app/Models/TicketActivity.php](../app/Models/TicketActivity.php) | Audit event model, details JSON, created_at cast and actor relationship. Methods: `casts`, `actor`. |
| [app/Services/TicketAccess.php](../app/Services/TicketAccess.php) | Exact configured workflow-role resolution, branch permission scope with IT-department and role exceptions, preview authorization, shared self/peer rating eligibility, assignable roster including leaders. Methods: `branches`, `canPreview`, `role`, `members`. |
| [app/Services/SupportClock.php](../app/Services/SupportClock.php) | Support-window seconds and deadline calculations, independent of browser time. Methods: `__construct`, `date`, `seconds`, `deadline`. |
| [app/Services/TicketSla.php](../app/Services/TicketSla.php) | Enrollment, snapshots, action transitions, actual responder/resolver, rejected pause attempts/legacy resume, priority allowance, workaround approval, reopening, activity and alert deduplication. Methods: `stamp`, `need`, `activity`, `notify`, `enroll`, `snapshot`, `stop`, `apply`, `check`. |
| [app/Services/TicketLeaderboard.php](../app/Services/TicketLeaderboard.php) | IT member and team leader roster ranking, actual resolver counts, contribution shares, current overdue ownership, role/branch labels, resolver-attributed half-star rating averages/counts, calendar period boundaries, selected-range XLSX export, tie handling and paginated member ticket/rating details. Methods: `summary`, `export`. |
| [app/Services/TicketWorkbook.php](../app/Services/TicketWorkbook.php) | Explicit-string XLSX downloads, filtered tickets/report sheets, constrained XLSX parser and row-level validation. Methods: `download`, `export`, `read`, `validateRows`. |
| [app/Services/TicketDemoFactory.php](../app/Services/TicketDemoFactory.php) | Support-calendar-aware demonstration scenarios and restoration of temporary frozen clock. Methods: `earlier`, `freeze`, `make`, `seedPreview`. |
| [app/Casts/UtcDateTime.php](../app/Casts/UtcDateTime.php) | Explicit UTC persistence for SQL timestamps without timezone metadata. Methods: `get`, `set`. |
| [app/Notifications/TicketNotification.php](../app/Notifications/TicketNotification.php) | Existing database-bell notification payload and ticket-module action URL. Methods: `__construct`, `via`, `toArray`. |
| [app/Console/Commands/CheckTicketSlas.php](../app/Console/Commands/CheckTicketSlas.php) | Scheduled live-only chunked SLA checks under row locks. Methods: `handle`. |
| [app/Console/Commands/ResetDemoTickets.php](../app/Console/Commands/ResetDemoTickets.php) | Local-only backed-up demo reset; destructive preview default, optional include-live flag. Methods: `handle`. |
| [config/ticketing.php](../config/ticketing.php) | Workflow role lists including IT Intern, all-branch exception roles and canonical categories. |
| [config/ticket-sla.php](../config/ticket-sla.php) | Versioned support calendar, four priority targets, warning threshold and approved pause reasons. |
| [resources/js/Pages/Tickets/Index.jsx](../resources/js/Pages/Tickets/Index.jsx) | Inertia entry point; TicketScreen, inline TicketEditor/TicketReports/MemberWorkloads/intake/SLA summary components; sidebar icons, creation, filters, dashboard cards, modal integration and polling. |
| [resources/js/Components/TicketSlaPerformance.jsx](../resources/js/Components/TicketSlaPerformance.jsx) | Compact leader SLA panel, received-period selector, grouped metrics, priority breaches, branch backlog and definitions. |
| [resources/js/Components/TicketLeaderboard.jsx](../resources/js/Components/TicketLeaderboard.jsx) | Reference-themed Top cats podium/medals, SVG pie chart/legend, ranking table with per-member average rating/rated-ticket counts, podium ratings, Day/Week/Month/Year/All time selector, XLSX export link, explanations and member drill-down views. |
| [resources/js/Components/TicketFeedbackQueue.jsx](../resources/js/Components/TicketFeedbackQueue.jsx) | TicketRatingDialog and sequential closed-ticket queue, half-star native radios, optional low-score comment, skip/submit persistence. |
| [resources/js/Components/TicketWorkbookControls.jsx](../resources/js/Components/TicketWorkbookControls.jsx) | Native XLSX links, leader upload, row-error display, validation preview, confirmation and discard controls. |
| [resources/css/ticketing.css](../resources/css/ticketing.css) | Responsive ticketing styles: forms/tables, role colors, reports, dashboards, actions, history, SLA, leaderboard, import/export and star controls. |
| [resources/js/Layouts/SidebarLayout.jsx](../resources/js/Layouts/SidebarLayout.jsx) | Shared integration touched for Select Module IT Ticketing Module entry, supplied sidebar link icons, preview surrounding auth session and existing notification consumption. |
| [routes/web.php](../routes/web.php) | Authenticated and verified ticket routes, including locations, revision queue and resubmission, with legacy list bookmarks and session locking for import. |
| [routes/console.php](../routes/console.php) | Every-minute SLA checker registration with overlap prevention. |
| [database/seeders/TicketPreviewSeeder.php](../database/seeders/TicketPreviewSeeder.php) | Idempotent registered test account coverage by role and demonstration tickets. |
| [database/seeders/TicketPreviewNamesSeeder.php](../database/seeders/TicketPreviewNamesSeeder.php) | Unique generic role-suffixed preview names and related ticket creator snapshots. |
| [database/seeders/AdditionalTicketMembersSeeder.php](../database/seeders/AdditionalTicketMembersSeeder.php) | Additional registered IT member test accounts using preview slots. |
| [database/migrations/2026_10_23_000001_create_tickets_table.php](../database/migrations/2026_10_23_000001_create_tickets_table.php) | Base tickets schema, FK restrictions and initial indexes. |
| [database/migrations/2026_10_23_000002_add_ticket_preview_support.php](../database/migrations/2026_10_23_000002_add_ticket_preview_support.php) | is_preview and ticket_preview_users registration schema. |
| [database/migrations/2026_10_23_000003_allow_multiple_ticket_preview_members.php](../database/migrations/2026_10_23_000003_allow_multiple_ticket_preview_members.php) | Preview role-slot uniqueness to permit multiple IT members. |
| [database/migrations/2026_10_27_000001_add_ticket_intake_details.php](../database/migrations/2026_10_27_000001_add_ticket_intake_details.php) | Historical nullable expanded intake schema, some fields later removed. |
| [database/migrations/2026_10_27_000002_add_ticket_sla_tracking.php](../database/migrations/2026_10_27_000002_add_ticket_sla_tracking.php) | SLA fields and activity table, reporting channel and emergency reason. |
| [database/migrations/2026_10_29_000001_remove_obsolete_ticket_intake_fields.php](../database/migrations/2026_10_29_000001_remove_obsolete_ticket_intake_fields.php) | Pre-drop complete-row JSONL backup and seven obsolete field removals; down recreates columns only. |
| [database/migrations/2026_11_05_000001_add_category_ticket_codes.php](../database/migrations/2026_11_05_000001_add_category_ticket_codes.php) | Unique category IDs, counter table and existing-ticket backfill. New IDs are assigned by the Ticket model on insert. |
| [database/migrations/2026_11_06_000001_rename_urgent_ticket_priority.php](../database/migrations/2026_11_06_000001_rename_urgent_ticket_priority.php) | Renames Urgent to Critical in tickets and stored SLA data. |
| [database/migrations/2026_11_09_000001_default_ticket_priority_to_low.php](../database/migrations/2026_11_09_000001_default_ticket_priority_to_low.php) | Converts unset priorities to Low and makes the database column required with a Low default. |
| [database/migrations/2026_11_09_000002_add_ticket_locations.php](../database/migrations/2026_11_09_000002_add_ticket_locations.php) | Creates custom locations and adds the optional ticket location reference. |
| [database/migrations/2026_11_09_000003_add_deleted_at_to_ticket_locations.php](../database/migrations/2026_11_09_000003_add_deleted_at_to_ticket_locations.php) | Adds location retirement while preserving historical links. |
| [database/migrations/2026_11_09_000004_add_location_category_ticket_counters.php](../database/migrations/2026_11_09_000004_add_location_category_ticket_counters.php) | Historical location/category counter table. |
| [database/migrations/2026_11_09_000005_add_annual_ticket_counters.php](../database/migrations/2026_11_09_000005_add_annual_ticket_counters.php) | Creates the location/category/year counter table and seeds it from previously issued annual IDs. |
| [database/migrations/2026_11_09_000006_backfill_annual_ticket_codes.php](../database/migrations/2026_11_09_000006_backfill_annual_ticket_codes.php) | Allocates annual IDs to legacy tickets and updates structured activity references. |

## Current workflow paths

- Ticket review: TicketEditor → TicketController::reviewSubmission → locked status transition and TicketSla::holdForReview → activity and creator notification → creator-scoped Pending revisions page → TicketController::resubmitRevision → TicketSla::resumeAfterRevision.
- Location choice: IT leader manages TicketLocation → creation validates either an allowed directory branch or an active custom location → Ticket allocates the annual code → ticket views resolve location names, including retired locations.
- Leaderboard: TicketLeaderboard::summary applies date range, attribution and eligibility → paginated detail rows open TicketEditor → export runs the same detail selection without pagination.
- Local seeders: `LocalRoleAccountsSeeder` creates regular test logins. `LocalRoleTicketsSeeder` creates samples using TicketDemoFactory. Both target the local database.

## Verification files

Cataloguing a test does not mean it was run during this documentation audit. Consult the main guide for fixture/environment caveats.

| File | Coverage / execution considerations |
| --- | --- |
| [tests/Feature/TicketWorkflowTest.php](../tests/Feature/TicketWorkflowTest.php) | Pest HTTP/feature coverage for role, identity, preview, branches, state and notifications; fresh-schema migration blocker was historically reported. |
| [tests/Unit/SupportClockTest.php](../tests/Unit/SupportClockTest.php) | Support-window/deadline unit scenarios with fixed clock. |
| [tests/ticket-form-submission.test.mjs](../tests/ticket-form-submission.test.mjs) | Actual installed Inertia useForm submission regression harness; transport intercepted. Covers 14 injected dialog actions plus creation; some injected feedback path is no longer exposed as a UI dropdown option. |
| [tests/ticket-rating-dialog.test.mjs](../tests/ticket-rating-dialog.test.mjs) | Actual rating dialog rendering/payload checks for 0 and every half-step through 5, optional comment visibility, fills and dismissals; no database writes. |
| [tests/verify-ticket-preview.php](../tests/verify-ticket-preview.php) | Transactional configured-database preview role/branch boundaries, roster/workload, submission fields, sorting, page size, reopening and feedback; older department fixtures may need valid schema names. |
| [tests/verify-ticket-sla.php](../tests/verify-ticket-sla.php) | Transactional SLA targets, authorization, newest-priority allowance, completed target audit, pause/resume, workaround/reopen, requester actions, warnings and breaches; notifications faked. |
| [tests/verify-employee-ticket-dashboard.php](../tests/verify-employee-ticket-dashboard.php) | Read-only employee/member/leader summaries, ratings, status/priority drill-downs, closure periods, custom dates, named-screen route defaults and identity scope; needs preview fixtures. |
| [tests/verify-ticket-leaderboard.php](../tests/verify-ticket-leaderboard.php) | Rollback-only resolver credit, reassignment, reopened-ticket exclusion, overdue ownership, percentages, roster, leader authorization, latest-feedback deduplication, fractional averages, resolver attribution and rating-independent ranks, Manila period boundaries and matching selected-period XLSX data, member detail counts and feedback comments. |
| [tests/verify-ticket-workbook.php](../tests/verify-ticket-workbook.php) | Rollback-only real XLSX read/write, row validation, preview/confirm/token replay, authorization, SLA enrollment, formula-safe export and full filtered rows; notifications faked. |
| [tests/verify-ticket-feedback.php](../tests/verify-ticket-feedback.php) | Rollback-only closed-ticket queue ordering/scope, low/half ratings, skips without rating, duplicate guards, requester-only actions, self/peer rating rejection and leader-to-member rating eligibility. |
| [tests/verify-ticket-department.php](../tests/verify-ticket-department.php) | Rollback-only account-department display/snapshot, tampered client value override and missing account-department rejection, IT-department any-branch acceptance and non-IT linked-branch restrictions. |
| [tests/verify-ticket-schema.php](../tests/verify-ticket-schema.php) | Read-only obsolete-column and retained-row comparison against latest private intake-cleanup archive; historical edits since backup can legitimately invalidate comparison. |

## Preview department assignment additions

| File | Responsibility |
| --- | --- |
| [database/seeders/TicketPreviewDepartmentsSeeder.php](../database/seeders/TicketPreviewDepartmentsSeeder.php) | Maps registered preview accounts to existing role-appropriate departments, archives previous IDs, updates only preview department_id, and supports idempotent reruns. Invoked from both account seeders. |
| [tests/verify-ticket-preview-departments.php](../tests/verify-ticket-preview-departments.php) | Read-only check that all registered preview accounts have departments, IT staff use Information Technology and the generic Employee uses Operations. |

## Shared dependencies (existing application code)

| File | How ticketing uses it |
| --- | --- |
| [User.php](../app/Models/User.php) | Authenticated identity, role, primary/linked branches and department relationships; notification recipients. |
| [Role.php](../app/Models/Role.php) | Existing account role names. |
| [Branch.php](../app/Models/Branch.php) | Dynamic actual locations and permission checks. |
| [Department.php](../app/Models/Department.php) | Existing departments schema and creation dropdown choices. |
| [Modal.jsx](../resources/js/Components/Modal.jsx) | Existing Headless UI modal, focus handling, overlay/Escape dismissal and scroll locking for feedback. |
| [FlashMessage.jsx](../resources/js/Components/FlashMessage.jsx) | Existing success/error presentation in the layout. |
| [config/app.php](../config/app.php) | Asia/Manila default timezone. |
| [composer.json](../composer.json) | Existing Laravel/Inertia/Laravel Excel dependencies; PhpSpreadsheet workbook implementation is already available. |
| [package.json](../package.json) | Existing React/Inertia/Vite/esbuild runtime and build/test harness dependencies. |

These dependencies are not all newly created or modified for ticketing. Existing notifications, auth/verification, sessions and cache locking are also required. Generated public/build assets, vendor/node_modules, private backups and preview database rows are runtime/build/data artifacts, not source files to edit.

## Documentation files

- [TICKETING.md](TICKETING.md): authoritative current behavior and operator entry point.
- [SLA_IMPLEMENTATION.md](SLA_IMPLEMENTATION.md): exact SLA policy and implementation semantics.
- [TICKETING_CODE_MAP.md](TICKETING_CODE_MAP.md): this inventory.
- [TICKETING_CHANGELOG.md](TICKETING_CHANGELOG.md): dated behavior/data history, including superseded choices.

## Change trace examples

- Department dropdown: User department relationship → TicketController actor props + server-derived department validation → TicketScreen read-only field → Ticket employee_department snapshot → verify-ticket-department.php.
- Priority filtering: TicketController validation/scoped aggregate/query → prioritySummary + filters props → TicketScreen dashboard links/table select → same filtered query in XLSX export → verify-employee-ticket-dashboard.php.
- Resolution timing: config/ticket-sla.php policy snapshot → SupportClock + TicketSla apply/snapshot/check → ticket JSON + activity → table/dialog/SLA/report/leaderboard consumers → clock/SLA tests.
- Closure rating: leader update → closed status → index pendingFeedback creator query → TicketFeedbackQueue → requester PATCH feedback/dismiss_feedback under lock → activity JSON → personal/leader rating aggregates → feedback/dialog tests.
- XLSX: native export anchor → same authorized index query → TicketWorkbook download; upload → reader/row validation → per-actor environment session preview → confirm revalidation + transaction → enrolled tickets + existing notifications.

## Keeping this inventory current

Add new source/test paths here in the same change that introduces them. Remove or mark retired entries when code is deleted. Update route/prop/filter descriptions in TICKETING.md and timing rules in SLA_IMPLEMENTATION.md, then add a dated changelog entry with the checks actually performed. No background documentation-sync automation is installed.

### 2026-11-12: Leaderboard SLA averages
- app/Services/TicketLeaderboard.php: per-resolver response/resolution averages in support seconds, sample counts, and XLSX columns in support minutes.
- resources/js/Components/TicketLeaderboard.jsx: average timing columns, sample counts and definitions; ticketing.css preserves responsive cards.
- tests/verify-ticket-leaderboard-sla.php: read-only checks of all-time/month aggregates in live/test scopes. All four checks passed; PHP syntax and Vite build passed.

### 2026-11-12: Expanded handover action
- TicketController::assignDuringHandover validates optional assignment, priority/reason and In progress status under the existing active-grant row lock; uses TicketSla::check/apply.
- Tickets/Index.jsx replaces assignment-only handover control with Assign / priority / status, preserving separate supervisor-only actions.
- tests/verify-ticket-handover-actions.php verifies updates, audit history, required priority reason, prohibited closure/resolution/approval payloads, revoked and expired access. All checks passed with rolled-back fixtures and fake notifications. PHP syntax and Vite build passed.

### 2026-11-12: Submission acknowledgement popup
- TicketController::store returns the committed ticket and flashes its subject/code only for non-IT personnel; index consumes the one-time receipt.
- Components/TicketSubmissionAcknowledgement.jsx uses the shared accessible Modal for the thank-you confirmation; Tickets/Index.jsx prevents repeat display and queues feedback behind it.
- tests/verify-ticket-submission-receipt.php passed failed-submission, non-IT receipt, SLA/status unchanged and IT exclusion checks with rollback and fake notifications. PHP syntax and Vite build passed.


### 2026-11-12: Supervisor SLA and priority administration

New files:
- `app/Models/TicketPriority.php`: database model and integer casts.
- `app/Services/TicketPrioritySettings.php`: ordered targets, display labels and policy snapshots, with pre-migration config fallback.
- `app/Http/Controllers/TicketPriorityController.php`: leader-only create/update, duration and uniqueness validation, immutable keys.
- `database/migrations/2026_11_12_000001_create_ticket_priorities_table.php`: additive settings table seeded from installed policy; applied locally.
- `resources/js/Components/TicketSlaSettings.jsx`: responsive admin cards for editing/adding priorities.
- `tests/verify-ticket-priority-settings.php`: transactional installed-schema regression checks, fake notifications and rollback.

Updated files:
- `routes/web.php`: GET admin SLA page, POST create, PATCH update (auth/verified group).
- `app/Http/Controllers/TicketController.php`: supervisor-only SLA screen, dynamic priority validation/filter/sort/report/template data and settings props.
- `app/Services/TicketSla.php`: enroll from database-backed policy, adopt latest selected target on priority change, preserve completed milestones.
- `app/Services/TicketWorkbook.php`: dynamic priority export labels and import validation/mapping.
- `resources/js/Pages/Tickets/Index.jsx`: admin navigation, dynamic priority dropdowns/filter/dashboard cards and partial-refresh props.
- `resources/js/Components/TicketSlaPerformance.jsx`: dynamic breach-by-priority rows.
- `resources/css/ticketing.css`: responsive settings cards and forms.
- `Documentation/TICKETING.md`, `Documentation/SLA_IMPLEMENTATION.md`, this code map: current behavior and validation evidence.

Verification: priority-settings integration suite passed, including denied non-supervisor reads/writes, invalid durations/duplicates, custom creation/filter/sort/import, stable keys and saved/completed SLA targets. Existing handover, receipt and leaderboard SLA checks passed. PHP syntax and Vite build passed. No browser tests performed.


### 2026-11-12 - Operating hours in submission acknowledgement

TicketSubmissionAcknowledgement.jsx now shows that IT reviews/responds during operating hours and that after-hours tickets are reviewed when support resumes. Tickets/Index.jsx passes the configured SLA opens/closes values to the popup, currently 7:30 AM-7:00 PM daily. Hours use wall-clock formatting without browser timezone conversion; no SLA timer or ticket status changes.


### 2026-11-12 - Remove ticketing role badge

Removed the upper-right role badge from the shared ticketing page header in resources/js/Pages/Tickets/Index.jsx. Role-based permissions and navigation are unchanged.


### 2026-11-13 - Hour-based SLA customization and acknowledgement wording

TicketSlaSettings.jsx and TicketPriorityController now accept response_hours, resolution_hours and optional update_hours in support hours only, allowing fractional values such as 0.5. The server validates positive durations up to 8760 hours and converts them to rounded whole seconds (minimum one second). Existing stored targets are displayed in hours and retain their whole-second values when saved; no database or historical ticket conversion is needed. This supersedes previous minute-input documentation. The acknowledgement popup now explicitly directs requesters to the “All my tickets” page while retaining operating-hours guidance. Updated verify-ticket-priority-settings.php for fractional-hour conversion and invalid-value coverage.


### 2026-11-13 - Remove SLA pause permission for all roles

Removed the Pause resolution timer action and pause-reason form from Tickets/Index.jsx. TicketController rejects pause actions and pause_reason payloads; TicketSla::apply independently rejects pause for every role and no longer implements pausing. Existing paused tickets retain Resume resolution timer so their clocks can continue without backdating historical waiting time. Automatic resolution completion and review-hold/revision behavior are unchanged. No ticket data or elapsed time was rewritten. Tests: tests/verify-ticket-no-pause.php covers server rejection for supervisor/member/employee, unchanged state/history and legacy resume. Recent ticket feature changes are committed to taskmodule-ticketing-merge; local launcher/process files are excluded.


### 2026-11-19: Priority removal implementation

Created:
- `database/migrations/2026_11_19_000001_add_archived_at_to_ticket_priorities.php`: additive indexed archive timestamp; applied locally.
- `tests/verify-ticket-priority-removal.php`: transactional deletion/archive/restore, role boundaries, preserved historical filters/timers, stale-write rejection, prior-reference and last-active protection.

Updated:
- `TicketPriority.php`: archive timestamp cast.
- `TicketPriorityController.php`: supervisor-only destroy/restore, locked last-active guard and used-versus-unused decision.
- `TicketPrioritySettings.php`: active-only targets/labels, historical-usage check, safe active default, row-locked write guard.
- `TicketController.php`: active-only new classifications and selectablePriorityLabels prop; all-priority historical filters/labels remain.
- `TicketSla.php`: row-locked active-priority checks for enrollment and priority changes.
- `TicketWorkbook.php`: active-only import labels/default; historical export labels retained.
- `routes/web.php`: DELETE priorities.destroy and POST priorities.restore in existing auth/verified group.
- `TicketSlaSettings.jsx`: confirmation, Remove/Restore controls, archived read-only cards and validation errors.
- `Tickets/Index.jsx`: active-only creation/management options, visible disabled current archived option, historical filters intact.
- `ticketing.css`: archive/removal layout and responsive fieldsets.
- Documentation README, guide, SLA reference, code map and changelog updated together.

Removal and existing priority-settings/handover/receipt integrations passed using rolled-back fixtures and fake notifications. PHP syntax and frontend build passed. No browser tests or push performed.


### 2026-11-19 - Matching removal confirmation popups

Priority and custom-location removal now use the shared TicketRemovalConfirmation.jsx modal. This replaces the priority inline confirmation and the location browser-native confirm. The popup names the selected item, explains priority delete/archive or location retirement, and provides Cancel and Confirm removal. No request is sent on opening/cancelling; the dialog disables controls and dismissal during submission, closes after success and shows server errors on failure. The shared Modal supplies focus containment and Escape/outside dismissal when idle, with Cancel initially focused. Tickets/Index.jsx and TicketSlaSettings.jsx call their existing removal endpoints; server permissions, history preservation and archive/delete rules are unchanged.


### 2026-11-19 - Automatic unique urgency ordering

Priority order is now a position, not an independent number. TicketPriorityOrdering.php locks the roster in a transaction, removes the edited row from its old position, inserts it at the requested position, and assigns consecutive positions to all rows (including archived priorities). Values beyond the list append to its end. The service writes through unused temporary positions before final positions to avoid collisions during swaps; transaction retries handle concurrent edits. Unused-priority deletion compacts positions; archive/restore retain positions. Priority keys, SLA targets, ticket policy/state and history are unchanged.

Migration 2026_11_19_000002_make_ticket_priority_order_unique.php normalizes existing ties/gaps by prior sort_order then ID and adds a unique database constraint; applied locally. TicketPriorityController.php delegates saves/compaction to the new service. TicketSlaSettings.jsx refreshes shifted server-owned positions on other cards and explains insertion behavior. tests/verify-ticket-priority-order.php verifies insertion, moving, append, archived/restored positions, deletion gaps, uniqueness and unchanged keys/targets using rolled-back fixtures. Ordering/settings/removal checks, PHP syntax and frontend build passed. No push performed.


### 2026-11-19 - Prevent stale priority-admin success notification replay

The shared FlashMessage.jsx previously reran its success handler whenever the flash/errors object identities changed, even if the success text came from an older action. Ticket admin pages also inherited the ticket list's one-minute partial refresh. HandleInertiaRequests.php now assigns each server flash event an ID; flashEvents.mjs remembers displayed event IDs across SPA page remounts. FlashMessage.jsx reacts to primitive message/event values, handles validation feedback separately, and retains the existing flash-toast custom event. New saves with identical success text still display because they receive different event IDs. Tickets/Index.jsx skips polling on creation and admin/location/handover/SLA-settings views; ordinary ticket views retain polling. No priority data, ordering or SLA targets were changed. tests/flash-notification-events.test.mjs verifies clone/poll/remount deduplication and independent same-text saves; both checks, PHP syntax and the frontend build passed. No browser tests or push performed.


### 2026-11-19 - Ticketing notification replay audit

Reviewed shared success/error toasts, location/handover/priority inline banners, creation receipts, feedback queue, lifecycle bell notifications and SLA scheduler deduplication. Removed duplicate persistent success banners on admin screens in favor of the shared one-event toast. Validation errors now carry event IDs and do not replay from retained polling props; genuine subsequent failures still notify. Submission receipts use ticket-event identity across SPA history remounts. Shared notification bell paging/refresh merges by notification ID, includes newly arrived alerts without dropping older pages, and accepts authoritative read state; marking a notification read now completes before destination navigation, with rollback/error feedback if it fails. Existing custom flash-toast events remain supported. No ticket/SLA/recipient rules were changed.

New notificationList.mjs helper and notification-list.test.mjs cover overlapping pages, refreshed alerts/read state and cleared lists. Extended flash-notification-events.test.mjs covers receipt and validation replay. verify-ticket-notification-replay.php uses fake notifications, a fixed clock and rolled-back fixtures to check one warning per cycle/recipient, one later breach, deduplicated progress reminders, a fresh reminder after a genuine new cycle, review-hold suppression, read-only ticket pages, and bell payload identity. Notification, receipt and handover checks passed. Build and PHP syntax passed. These are source and automated checks; no interactive browser audit was performed and no push was performed.


### 2026-11-19 - Sidebar page label capitalization

Ticketing sidebar page labels in Tickets/Index.jsx now capitalize every word: Create Ticket, All My Tickets, All Tickets, Assigned To Me and Pending Revisions. Dashboard, Leaderboard and Admin retain their existing capitalization. Routes and permissions are unchanged.


### 2026-11-19 - Unknown ticket page routes return 404

Added numeric route constraints to ticketing write endpoints for ticket, priority, handover and location IDs in routes/web.php. Previously GET /tickets/r matched the unconstrained PATCH /tickets/{ticket} path and returned 405. Unknown textual paths now match no record action and return Laravel's standard 404 response; /ticket/hello is also unknown. Valid named pages and numeric write routes are unchanged, including auth, binding and role checks. Genuine wrong-method requests on recognized numeric endpoints retain 405; this is not a global 405-to-404 exception conversion. tests/verify-ticket-route-404.php checks unknown paths and valid route names without database writes or controller dispatch.


### 2026-11-19 - Dedicated Ticketing Admin dashboard

Added TicketAdminDashboard.jsx with colored navigation cards for Locations, Handover and SLA & Priorities. Tickets/Index.jsx renders the landing dashboard at /tickets/admin and individual admin tools at their own paths, with Back To Admin Dashboard navigation and active Admin sidebar state. routes/web.php adds tickets.admin.locations (/tickets/admin/locations). TicketController redirects old /tickets/locations bookmarks and location add/remove results to the dedicated locations page. ticketing.css adds responsive cards that stack on narrow screens. No schema changes. verify-ticket-admin-dashboard.php passed supervisor page selection, member/employee denial on all four pages and legacy-location redirect checks; verify-ticket-route-404.php and Vite build also passed. No browser tests or push performed.


### 2026-11-19 - Merge shared taskmodule-ticketing-merge updates

Preserved local ticketing work in b1ae29a and backup branch codex/ticketing-before-merge-20261119 before merging remote commit 90b5282 (including bc7a5e9 notification recipient/feed fixes). Kept incoming task/report/workspace/import changes alongside the local admin dashboard, unique priority ordering/archive/restore, confirmation dialogs, notification replay guards and numeric route constraints. Resolved the single SidebarLayout.jsx conflict by combining the dedicated IT feed/preview read endpoint with asynchronous read-before-navigation and rollback/error feedback. Environment backups, local launcher edits, process files and LOCAL_SETUP.md were excluded from commits.

Applied the specific additive 2026_11_15_000001_create_task_id_settings.php migration locally because the incoming Task ID feature requires task_module_settings/task_id_sequences. The workbook missing-heading test now expects the existing ValidationException rather than the obsolete HttpException. Build, 26 JavaScript tests, 15 isolated PHP workbook/task-release-safety tests (52 assertions), and ten installed-schema ticketing regression scripts passed. Temporary SQLite extensions were enabled only for test commands; regular PHP configuration was not edited. The incoming TaskModuleEmailTest suite is not green: the unmodified version includes past fixed due dates; diagnostic fixed-clock execution also exposed stale workflow expectations/missing fixture tables. Task email production code and tests were retained exactly as incoming. These are known incoming-suite limitations, not resolved by this merge. No browser verification performed.
