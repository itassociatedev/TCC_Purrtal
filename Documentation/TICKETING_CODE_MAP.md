# Ticketing code map

Audited **3 November 2026**. This inventory covers dedicated ticketing code plus shared files directly integrated with the module. File links are repository-relative; do not rename a file without updating this map.

See [current system guide](TICKETING.md), [SLA reference](SLA_IMPLEMENTATION.md), and [change history](TICKETING_CHANGELOG.md).

## Application and frontend files

| File | Responsibility / entry points |
| --- | --- |
| [app/Http/Controllers/TicketController.php](app/Http/Controllers/TicketController.php) | HTTP orchestration: context/role scoping, query filters/sort/pagination, dashboards/reports, creation, atomic management, requester feedback and XLSX staging/confirmation. Methods: `context`, `index`, `workbookTemplate`, `workbookImport`, `store`, `update`. |
| [app/Models/Ticket.php](app/Models/Ticket.php) | Ticket fillable fields, JSON/date casts and creator/branch/assignee/activity relationships. Activity relationship is newest-ID-first; UI separately sorts history oldest-first. Methods: `casts`, `creator`, `branch`, `assignee`, `activities`. |
| [app/Models/TicketActivity.php](app/Models/TicketActivity.php) | Audit event model, details JSON, created_at cast and actor relationship. Methods: `casts`, `actor`. |
| [app/Services/TicketAccess.php](app/Services/TicketAccess.php) | Exact configured workflow-role resolution, branch permission scope with IT-department and role exceptions, preview authorization, shared self/peer rating eligibility, assignable roster including leaders. Methods: `branches`, `canPreview`, `role`, `members`. |
| [app/Services/SupportClock.php](app/Services/SupportClock.php) | Support-window seconds and deadline calculations, independent of browser time. Methods: `__construct`, `date`, `seconds`, `deadline`. |
| [app/Services/TicketSla.php](app/Services/TicketSla.php) | Enrollment, snapshots, action transitions, actual responder/resolver, pauses, priority allowance, workaround approval, reopening, activity and alert deduplication. Methods: `stamp`, `need`, `activity`, `notify`, `enroll`, `snapshot`, `stop`, `apply`, `check`. |
| [app/Services/TicketLeaderboard.php](app/Services/TicketLeaderboard.php) | Member-only roster ranking, actual resolver counts, contribution shares, current overdue ownership, role/branch labels, resolver-attributed half-star rating averages/counts, calendar period boundaries, selected-range XLSX export, tie handling and paginated member ticket/rating details. Methods: `summary`, `export`. |
| [app/Services/TicketWorkbook.php](app/Services/TicketWorkbook.php) | Explicit-string XLSX downloads, filtered tickets/report sheets, constrained XLSX parser and row-level validation. Methods: `download`, `export`, `read`, `validateRows`. |
| [app/Services/TicketDemoFactory.php](app/Services/TicketDemoFactory.php) | Support-calendar-aware demonstration scenarios and restoration of temporary frozen clock. Methods: `earlier`, `freeze`, `make`, `seedPreview`. |
| [app/Casts/UtcDateTime.php](app/Casts/UtcDateTime.php) | Explicit UTC persistence for SQL timestamps without timezone metadata. Methods: `get`, `set`. |
| [app/Notifications/TicketNotification.php](app/Notifications/TicketNotification.php) | Existing database-bell notification payload and ticket-module action URL. Methods: `__construct`, `via`, `toArray`. |
| [app/Console/Commands/CheckTicketSlas.php](app/Console/Commands/CheckTicketSlas.php) | Scheduled live-only chunked SLA checks under row locks. Methods: `handle`. |
| [app/Console/Commands/ResetDemoTickets.php](app/Console/Commands/ResetDemoTickets.php) | Local-only backed-up demo reset; destructive preview default, optional include-live flag. Methods: `handle`. |
| [config/ticketing.php](config/ticketing.php) | Workflow role lists, all-branch exception roles and canonical categories. |
| [config/ticket-sla.php](config/ticket-sla.php) | Versioned support calendar, four priority targets, warning threshold and approved pause reasons. |
| [resources/js/Pages/Tickets/Index.jsx](resources/js/Pages/Tickets/Index.jsx) | Inertia entry point; TicketScreen, inline TicketEditor/TicketReports/MemberWorkloads/intake/SLA summary components; sidebar icons, creation, filters, dashboard cards, modal integration and polling. |
| [resources/js/Components/TicketSlaPerformance.jsx](resources/js/Components/TicketSlaPerformance.jsx) | Compact leader SLA panel, received-period selector, grouped metrics, priority breaches, branch backlog and definitions. |
| [resources/js/Components/TicketLeaderboard.jsx](resources/js/Components/TicketLeaderboard.jsx) | Reference-themed Top cats podium/medals, SVG pie chart/legend, ranking table with per-member average rating/rated-ticket counts, podium ratings, Day/Week/Month/Year/All time selector, XLSX export link, explanations and member drill-down views. |
| [resources/js/Components/TicketFeedbackQueue.jsx](resources/js/Components/TicketFeedbackQueue.jsx) | TicketRatingDialog and sequential closed-ticket queue, half-star native radios, optional low-score comment, skip/submit persistence. |
| [resources/js/Components/TicketWorkbookControls.jsx](resources/js/Components/TicketWorkbookControls.jsx) | Native XLSX links, leader upload, row-error display, validation preview, confirmation and discard controls. |
| [resources/css/ticketing.css](resources/css/ticketing.css) | Responsive ticketing styles: forms/tables, role colors, reports, dashboards, actions, history, SLA, leaderboard, import/export and star controls. |
| [resources/js/Layouts/SidebarLayout.jsx](resources/js/Layouts/SidebarLayout.jsx) | Shared integration touched for Select Module IT Ticketing Module entry, supplied sidebar link icons, preview surrounding auth session and existing notification consumption. |
| [routes/web.php](routes/web.php) | Authenticated/verified live + preview named screen paths, legacy index bookmarks, GET/POST/PATCH routes and session-blocked import; literal paths before dynamic ticket route. |
| [routes/console.php](routes/console.php) | Every-minute SLA checker registration with overlap prevention. |
| [database/seeders/TicketPreviewSeeder.php](database/seeders/TicketPreviewSeeder.php) | Idempotent registered test account coverage by role and demonstration tickets. |
| [database/seeders/TicketPreviewNamesSeeder.php](database/seeders/TicketPreviewNamesSeeder.php) | Unique generic role-suffixed preview names and related ticket creator snapshots. |
| [database/seeders/AdditionalTicketMembersSeeder.php](database/seeders/AdditionalTicketMembersSeeder.php) | Additional registered IT member test accounts using preview slots. |
| [database/migrations/2026_10_23_000001_create_tickets_table.php](database/migrations/2026_10_23_000001_create_tickets_table.php) | Base tickets schema, FK restrictions and initial indexes. |
| [database/migrations/2026_10_23_000002_add_ticket_preview_support.php](database/migrations/2026_10_23_000002_add_ticket_preview_support.php) | is_preview and ticket_preview_users registration schema. |
| [database/migrations/2026_10_23_000003_allow_multiple_ticket_preview_members.php](database/migrations/2026_10_23_000003_allow_multiple_ticket_preview_members.php) | Preview role-slot uniqueness to permit multiple IT members. |
| [database/migrations/2026_10_27_000001_add_ticket_intake_details.php](database/migrations/2026_10_27_000001_add_ticket_intake_details.php) | Historical nullable expanded intake schema, some fields later removed. |
| [database/migrations/2026_10_27_000002_add_ticket_sla_tracking.php](database/migrations/2026_10_27_000002_add_ticket_sla_tracking.php) | SLA fields and activity table, reporting channel and emergency reason. |
| [database/migrations/2026_10_29_000001_remove_obsolete_ticket_intake_fields.php](database/migrations/2026_10_29_000001_remove_obsolete_ticket_intake_fields.php) | Pre-drop complete-row JSONL backup and seven obsolete field removals; down recreates columns only. |
| [database/migrations/2026_11_05_000001_add_category_ticket_codes.php](database/migrations/2026_11_05_000001_add_category_ticket_codes.php) | Unique category IDs, counter table and existing-ticket backfill. New IDs are assigned by the Ticket model on insert. |

## Verification files

Cataloguing a test does not mean it was run during this documentation audit. Consult the main guide for fixture/environment caveats.

| File | Coverage / execution considerations |
| --- | --- |
| [tests/Feature/TicketWorkflowTest.php](tests/Feature/TicketWorkflowTest.php) | Pest HTTP/feature coverage for role, identity, preview, branches, state and notifications; fresh-schema migration blocker was historically reported. |
| [tests/Unit/SupportClockTest.php](tests/Unit/SupportClockTest.php) | Support-window/deadline unit scenarios with fixed clock. |
| [tests/ticket-form-submission.test.mjs](tests/ticket-form-submission.test.mjs) | Actual installed Inertia useForm submission regression harness; transport intercepted. Covers 14 injected dialog actions plus creation; some injected feedback path is no longer exposed as a UI dropdown option. |
| [tests/ticket-rating-dialog.test.mjs](tests/ticket-rating-dialog.test.mjs) | Actual rating dialog rendering/payload checks for 0 and every half-step through 5, optional comment visibility, fills and dismissals; no database writes. |
| [tests/verify-ticket-preview.php](tests/verify-ticket-preview.php) | Transactional configured-database preview role/branch boundaries, roster/workload, submission fields, sorting, page size, reopening and feedback; older department fixtures may need valid schema names. |
| [tests/verify-ticket-sla.php](tests/verify-ticket-sla.php) | Transactional SLA targets, authorization, newest-priority allowance, completed target audit, pause/resume, workaround/reopen, requester actions, warnings and breaches; notifications faked. |
| [tests/verify-employee-ticket-dashboard.php](tests/verify-employee-ticket-dashboard.php) | Read-only employee/member/leader summaries, ratings, status/priority drill-downs, closure periods, custom dates, named-screen route defaults and identity scope; needs preview fixtures. |
| [tests/verify-ticket-leaderboard.php](tests/verify-ticket-leaderboard.php) | Rollback-only resolver credit, reassignment, reopened-ticket exclusion, overdue ownership, percentages, roster, leader authorization, latest-feedback deduplication, fractional averages, resolver attribution and rating-independent ranks, Manila period boundaries and matching selected-period XLSX data, member detail counts and feedback comments. |
| [tests/verify-ticket-workbook.php](tests/verify-ticket-workbook.php) | Rollback-only real XLSX read/write, row validation, preview/confirm/token replay, authorization, SLA enrollment, formula-safe export and full filtered rows; notifications faked. |
| [tests/verify-ticket-feedback.php](tests/verify-ticket-feedback.php) | Rollback-only closed-ticket queue ordering/scope, low/half ratings, skips without rating, duplicate guards, requester-only actions, self/peer rating rejection and leader-to-member rating eligibility. |
| [tests/verify-ticket-department.php](tests/verify-ticket-department.php) | Rollback-only account-department display/snapshot, tampered client value override and missing account-department rejection, IT-department any-branch acceptance and non-IT linked-branch restrictions. |
| [tests/verify-ticket-schema.php](tests/verify-ticket-schema.php) | Read-only obsolete-column and retained-row comparison against latest private intake-cleanup archive; historical edits since backup can legitimately invalidate comparison. |

## Preview department assignment additions

| File | Responsibility |
| --- | --- |
| [database/seeders/TicketPreviewDepartmentsSeeder.php](database/seeders/TicketPreviewDepartmentsSeeder.php) | Maps registered preview accounts to existing role-appropriate departments, archives previous IDs, updates only preview department_id, and supports idempotent reruns. Invoked from both account seeders. |
| [tests/verify-ticket-preview-departments.php](tests/verify-ticket-preview-departments.php) | Read-only check that all registered preview accounts have departments, IT staff use Information Technology and the generic Employee uses Operations. |

## Shared dependencies (existing application code)

| File | How ticketing uses it |
| --- | --- |
| [User.php](app/Models/User.php) | Authenticated identity, role, primary/linked branches and department relationships; notification recipients. |
| [Role.php](app/Models/Role.php) | Existing account role names. |
| [Branch.php](app/Models/Branch.php) | Dynamic actual locations and permission checks. |
| [Department.php](app/Models/Department.php) | Existing departments schema and creation dropdown choices. |
| [Modal.jsx](resources/js/Components/Modal.jsx) | Existing Headless UI modal, focus handling, overlay/Escape dismissal and scroll locking for feedback. |
| [FlashMessage.jsx](resources/js/Components/FlashMessage.jsx) | Existing success/error presentation in the layout. |
| [config/app.php](config/app.php) | Asia/Manila default timezone. |
| [composer.json](composer.json) | Existing Laravel/Inertia/Laravel Excel dependencies; PhpSpreadsheet workbook implementation is already available. |
| [package.json](package.json) | Existing React/Inertia/Vite/esbuild runtime and build/test harness dependencies. |

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
