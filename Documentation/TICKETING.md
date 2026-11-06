# TCC Purrtal ticketing — current system guide

Last audited against repository code: **3 November 2026 (Asia/Manila)**.
This guide describes the current implementation, rather than earlier designs. Changes in this documentation update do not deploy code or change data.

## Documentation index

| Document | Purpose |
| --- | --- |
| [TICKETING.md](TICKETING.md) | Start here: current screens, roles, workflow, data, routes, filters, XLSX, operations and verification |
| [SLA_IMPLEMENTATION.md](SLA_IMPLEMENTATION.md) | Exact timing rules, clock behavior, milestones, alerts and reporting definitions |
| [TICKETING_CODE_MAP.md](TICKETING_CODE_MAP.md) | Frontend/backend file inventory, entry points, migrations and test responsibilities |
| [TICKETING_CHANGELOG.md](TICKETING_CHANGELOG.md) | Implemented changes, superseded behavior and local data-maintenance history |

The code map links directly to repository files. The documentation must be updated in the same change as any affected implementation; see the maintenance checklist below.

## Architecture and entry points

The module uses the project's existing Laravel + React + Inertia stack. It reuses authenticated application navigation, the Select Module header, profile controls and website notification bell. XLSX support uses the already installed Laravel Excel/PhpSpreadsheet dependencies; charts, medals, sidebar icons and star controls use inline SVG without another frontend framework.

Open **IT Ticketing Module** from the header's module selector or visit `/tickets/dashboard`. Every workflow role lands on its dashboard. Creation is a separate URL, `/tickets/create`; tables and the creation form are never shown side by side. React's `Index.jsx` renders the requested screen from server props, including `creationPage`, `filters.view` and `ticketRole`.

## Roles and access

Names are matched exactly after trimming and lowercasing, using [config/ticketing.php](config/ticketing.php).

| Workflow role | Configured account roles | Access |
| --- | --- | --- |
| Employee | Any role outside the configured member/leader lists | Create tickets; dashboard and lists for own creator ID only; reply; confirm resolved service; optional feedback after closure |
| IT member | IT Member, IT Staff | Dashboard for current assignments; Assigned to me and All tickets; manage only own assignments; create an IT-reported ticket |
| IT leader | IT TL, IT Team Leader, IT Supervisor | Team dashboard, all/open/closed/own-assignment tables, reports, staff workload, leaderboard; priority changes, assignment/reassignment, management, closure, Critical workaround approval, XLSX import |
| Preview administrator | Admin, IT Admin, or an IT leader | Can enter UI preview; this permission alone does not grant live leader workflow access |

IT leaders are valid ticket assignees. On an unassigned ticket, substantive IT action can establish the acting worker as owner; changing priority alone can leave it unassigned. Members cannot claim arbitrary unassigned tickets through a crafted update, because current assignment is checked under a row lock.

Employees can choose their primary or linked branches. Executive Vice President, Executive Assistant, IT, IT Admin and configured IT members/leaders can choose any existing branch. Employees whose account department is Information Technology may also select any existing branch, regardless of workflow role. Branch exceptions do not grant management rights. Locations come from the branches table; no preview clinic or hardcoded two-location list is used.

**All tickets** means all tickets authorized for that role and environment: an employee still sees only their own tickets. Admin/IT/other unlisted role names do not implicitly become IT staff workflow roles.

## Frontend screens and navigation

Use the sidebar to switch ticket pages. Ticket lists do not repeat the sidebar links as tabs; search, filters, sorting and pagination remain on the list.

Dashboards group ticket widgets under **All Tickets** (total, closed, leader closure periods, and staff priority counts across all statuses) and **Open Tickets** (open total, not started, in progress, resolved awaiting closure, and leader active queues). Percentages continue to use the role's full ticket total. Clicking a card opens the matching scope; unrelated date, priority or closure filters are cleared for the all-time status totals. Quick actions and personal ratings remain separate.

Displayed percentages use exactly two decimal places, including zero and whole-number percentages. This also applies to SLA compliance/reopen percentages, leaderboard shares and XLSX percentage values; counts and star ratings keep their own formats.

### Employee dashboard

- Basic-color cards: Total, Open, Closed, Not started and In progress. Each shows a count and percentage of the employee’s total. Resolved tickets awaiting closure appear under Open, including when opening an older Resolved filter link.
- **Need IT support?**, Create ticket and View my tickets are at the top.
- Sidebar: Dashboard, Create ticket, All my tickets. Use the status filter for open or closed tickets.
- Cards open the corresponding status-filtered ticket list.

### IT member dashboard

- Same status counts/percentages, using currently assigned tickets rather than team-wide tickets.
- Support-workload quick actions link to creation, own assignments and all tickets.
- Own resolver rating: average out of five and number of rated tickets; missing feedback shows Not rated yet.
- Priority cards: Critical, High, Medium, Low and Not Set. Counts include all currently assigned statuses. Clicking clears incompatible status/date/closure filters and opens the matching assignments.
- Sidebar includes Dashboard, Create ticket, Assigned to me and All tickets, with thin outline icons and selected-state styling.

### IT leader dashboard and reports

- **Manage team support** is at the top.
- Dashboard categories match Ticket reports: Total, Not started, In progress, Resolved, Closed, Unassigned active and Priority not set. Counts include the selected live/preview environment, independently of table filters.
- Dashboard percentages divide by total environment tickets. Active unassigned/unclassified queues overlap status counts and should not be added to them.
- Clickable closure totals: Today, This week, This month, This year, using `closed_at` in Asia/Manila. Periods overlap.
- Priority cards include all team tickets and open the corresponding priority-filtered All tickets table.
- Ticket reports cards and closure totals on list pages are keyboard-accessible links that filter the destination table; matching selections are highlighted.
- Staff workload includes assignable members **and leaders**, including zero-assignment accounts. Assignment and resolved counts follow current assignee; resolved includes closed. Completion percentage = assigned resolved/closed ÷ all assigned. Ratings follow the actual resolver, not current assignment.
- SLA performance is a separate compact panel with grouped metrics, branch backlog and expandable definitions. It is hidden on **All tickets**, creation and leaderboard; it remains on the leader dashboard/other leader list views.
- Sidebar includes Dashboard, Leaderboard, Create ticket, All tickets and Assigned to me. Open and closed tickets are status filters.

### Leaderboard

Leader-only `/tickets/leaderboard`, implemented by `TicketLeaderboard.php` and `TicketLeaderboard.jsx`.

- The podium floats at staggered heights, with first above second and second above third. The reduced-motion setting keeps the staggered heights static. The pie legend shows the resolved total directly beneath its member count column.
- Click a member’s resolved count, overdue text or rating to open a detail view for that member and calendar period. Resolved and overdue entries open the existing ticket editor from their subjects. Ratings show the latest counted score per ticket and any submitted comment. The views share the leaderboard’s live or preview scope and paginate at 15 entries.

- Top cats podium: second left/silver, first center/gold, third right/bronze, with cat medals. Only positive-resolution members occupy podium slots; missing places show an empty state.
- Pie chart and legend: member names, resolved counts and contribution percentages, using exact counts for segment sizes.
- Ranking table: rank, employee name/role/branches, tickets resolved, contribution share, average resolver rating out of five with rated-ticket count, and attention/overdue work. Top-three cards also show average rating. Members without feedback show Not rated yet (0 rated tickets).
- Current **IT member** roster only; IT leaders are assignable and appear in workload reporting, but are excluded from this leaderboard.
- Selected-period resolved/closed tickets count once for `sla_state.resolved_by`, falling back to the latest resolved activity actor. Current assignee is never substituted for resolver.
- Reopened tickets are excluded until resolved again. Historical events are not counted as separate resolutions.
- Leaderboard ratings use the latest feedback per ticket in the selected live/preview environment, attributed to frozen resolved_by or the preceding resolved activity actor. Half-star values are retained in averages, displayed to one decimal. Reassignment does not move ratings. Existing feedback remains attributed even if its ticket is reopened; completion counts still exclude reopened work. Ratings do not affect ranking, podium order or pie shares.
- Contribution = member resolutions ÷ all roster-member resolutions. Zero denominator yields 0%.
- Equal totals share competition rank; names then IDs break display ties. The podium displays at most three members, even if more tie.
- Overdue = current open assignments with an enabled, incomplete, breached resolution SLA. Accepted workarounds are not outstanding overdue work. Historical breaches on completed tickets are not this column's definition.
- Ranking explanations are expandable. The page matches the supplied white-card/pale-blue-table reference and adapts to narrow screens. A Day/Week/Month/Year/All time selector uses current calendar periods in Asia/Manila (All time is default). Resolution counts use latest resolution date; ratings use feedback-submission date; overdue counts use ticket creation date and current overdue state. Top three, ranking and pie shares recalculate. Export leaderboard XLSX downloads the same selected-period member rows with a Scope sheet.

## Ticket creation form and storage mapping

| Display order / field | Source or stored field | Rules |
| --- | --- | --- |
| Employee name | `creator_id`, `employee_name` | Server identity and name snapshot; read-only |
| Department | `employee_department` | Automatically displays the account department as read-only; server replaces submitted department with the account relationship name. Missing account department blocks creation and asks the user to contact an administrator. |
| Branch affected | `branch_id` | Required; shared branch-permission scope |
| Ticket subject | `subject` | Required, max 180 characters |
| Affected system, equipment, application or service | `affected_asset` | Required, max 255 |
| Ticket category | `category` | Hardware, Software, Network, Account & Access, Other; UI adds examples but stores canonical category only |
| Initial priority | `priority` | Required on the create-ticket form. Choose Critical (`critical`), High (`high`), Medium (`medium`) or Low (`low`). |
| Details of issue | `description` | Required, max 10,000 |
| Business or clinical operational impact | `operational_impact` | Required, max 5,000 |
| Screenshot or supporting-file links (optional) | `supporting_links` JSON array | Up to 10 HTTP/HTTPS URLs, max 2,048 characters each, one per line; no images/files uploaded or fetched |

The five priorities above are labels, not extra ticket statuses. No user-selectable occurrence/reporting time remains. Reporting time uses the server's ticket creation timestamp; SLA has its own UTC receipt field.

The button is **Create ticket** for all roles. IT-created form submissions still require email/Viber/other-messaging reporting channel and a reason the original ticket could not be created. They are assigned to the creating IT worker and use current creation/receipt time. Employee submissions use portal reporting, start unassigned, and cannot supply emergency-only fields. All form submissions require an initial priority. Every new ticket starts `not_started`; clients cannot set creator, initial status or arbitrary assignment.

Historical ticket names, department snapshots and retained descriptions are not rewritten to invent missing information.

## Workflow and management dialog

```mermaid
flowchart TD
    A[Create or confirm XLSX import] --> B[Not started]
    B --> C[Acknowledge with assessment and next steps]
    C --> D[In progress]
    D --> E[Pause for approved waiting reason]
    E -->|Resume with explanation| D
    D --> F[Restore service temporarily]
    F --> D
    F --> G[Leader accepts Critical workaround]
    G -->|Corrective work completed| H[Resolved]
    G -->|Workaround fails| R[Reopen with reason]
    D --> H
    H -->|Leader closes with explanation| I[Closed]
    H --> R
    I --> R
    R --> D
    I --> J[Optional queued star feedback]
```

| Action | Behavior / required information |
| --- | --- |
| Assignment / priority / status | Leader may assign/reassign and revise priority with a reason. Staff may move assigned work to In progress; this alone is not acknowledgment. |
| Acknowledge | Assessment and next steps required. Records actual responder; starts In progress when Not started; requester is notified. Required before resolving an SLA ticket. |
| Send progress update | Message required. Optional vendor/reference/notification time, next-update estimate and related ticket ID in the same environment. |
| Document SLA risk / delay | Message, reason, actions taken, assistance/approval required and next-update estimate. Does not automatically extend or pause SLA. |
| Pause / resume | Approved reason plus message for pause; message for resume. Separate clock state, not a new ticket status. |
| Restore service temporarily | Workaround details required; remaining work/next steps optional. Ticket stays open and timer continues. |
| Accept Critical workaround and recovery plan | Leader-only, Critical ticket, already acknowledged. Details + plan required. Satisfies resolution target while corrective work remains open. |
| Resolve ticket | Issue found + Fix applied and verification required for tracked tickets. Records resolver, stops resolution work, notifies requester. Older detailed resolution payloads remain accepted for compatibility. |
| Confirm service is working | Requester-only, resolved ticket. Confirmation is optional; does not close the ticket. |
| Close ticket | Leader-only, must already be resolved; tracked tickets require resolution documentation and closure/follow-up explanation. Records `closed_at`. Requester confirmation is not enforced as a prerequisite. |
| Reopen | Leader or current assigned member, reason required for tracked tickets. Closed/resolved or accepted-workaround ticket returns to In progress, clears closure/confirmation, resumes original remaining allowance. |
| Reply / continuing issue | Requester-only, message required. Does not automatically reopen, resume a pause or close a ticket. |

Closed tickets must be reopened before further IT management. Employees cannot directly close, reopen, reassign or change priority after creation. No automatic closure exists. **Open tickets** includes Not started, In progress and Resolved; resolved tickets await a separate closure action.

History is displayed oldest first, using creation timestamp then ID to break ties. Backend activity relationship remains newest-ID-first for latest-event attribution. Important actions, status transitions, assignments, warnings, replies, imports, ratings and dismissals are stored as activity entries.

## Optional half-star feedback

The old Rate the resolving IT staff dropdown option is removed from the visible management actions. `TicketFeedbackQueue.jsx` displays a modal in the ticket module when the requester has eligible closed tickets and is not creating/editing a ticket.

- Text: **How was our service?**, followed by subject and resolver attribution explanation.
- Five initially blank stars; ten radio hit targets support 0.5–5 stars in 0.5 increments, with hover preview, half fill, native keyboard selection and focus styling.
- Optional comment appears only for ratings **3 or below**. Higher ratings submit an empty comment.
- Submit requires a deliberate nonzero rating; supplying feedback itself is optional. Close, Escape, overlay dismissal or Skip advances the queue.
- Rating eligibility uses the actual resolver and configured ticket workflow roles. Nobody can rate themselves. IT members cannot rate another IT member. An IT team leader may rate an IT member who resolved a ticket that leader requested; this does not grant rating access to tickets requested by someone else. Ordinary employee feedback remains available. The queue excludes ineligible tickets, and direct submissions are rejected under the same policy. Existing ratings are not rewritten.
- Queue is independent of table filtering/pagination, scoped to creator + live/preview environment, ordered by closure time then ID. A known recorded resolver is required.
- Skip persists `feedback_dismissed` without fabricating a rating. A submitted rating stores `rating` and frozen `resolved_by` in activity JSON; no rating column/migration is required for half stars.
- Closed-state, ownership and duplicate guards are rechecked under a row lock. Repeated submits cannot create additional ratings. Rated or dismissed tickets are not prompted again after a later reopen/closure cycle.
- Member averages and leader workload use latest feedback per ticket for historical compatibility and actual resolver attribution. Older feedback can fall back to the preceding resolved activity, never current assignee.
- Existing Modal/Headless UI handles focus, dismissal and scroll locking. Queue refresh happens through ticket-module polling, not a global popup on every unrelated application page or a websocket push.

## Tables, filters and scope

Nine sortable data columns: Subject, Description, Category, Status, Timeline, Priority, Branch, Ticket creator, Assigned to. Subject includes the role-appropriate View/Manage/Reopen button immediately beneath it. Timeline combines creation date/time and the full SLA summary; sorting Timeline still sorts by creation time. There are no separate Action or SLA columns. A request-details disclosure shows current intake fields. The table wraps within its panel; below 850 px of panel width, rows switch to labeled ticket blocks with a separate sort control so all fields remain visible without sideways scrolling. This responsive layout is specific to ticket lists, not the leaderboard or workbook preview tables.

| Parameter | Accepted values / interpretation |
| --- | --- |
| `view` | Legacy bookmark/export parameter. The screen is normally selected by its path, which takes precedence over this query parameter.  Employee: dashboard/all/open/closed. Member: dashboard/assigned/all. Leader: dashboard/leaderboard/all/open/closed/assigned; legacy reports bookmark normalizes to open. |
| `status_filter` | all/open/closed/not_started/in_progress/resolved/unassigned/priority_not_set. Last two mean active Not started/In progress with missing owner/priority. Leader UI exposes extra queues. |
| `priority_filter` | all/critical/high/medium/low/not_set. Member/leader UI exposes it; applies in the backend to the authorized query. |
| `search` | Subject or description, max 180 characters; OR conditions grouped inside the role scope. |
| `date_from`, `date_to` | Optional creation dates, YYYY-MM-DD, inclusive Asia/Manila days. Either bound alone is accepted; end must not precede start. SQL uses start of day through exclusive next-day boundary. |
| `closed_period` | day/week/month/year, using closed_at and current Closed status. Removable active filter. |
| `sort`, `direction` | subject/description/category/status/created_at/priority/branch/creator/assignee and asc/desc. Defaults created_at desc. Explicit whitelist; related names use subqueries; ID breaks ties. Priority ascending is Critical→High→Medium→Low→Not Set. |
| `per_page` | 5/10/15/all, defaults 10 and remembered in session `tickets.per_page`. All still enforces identity and filters. |
| `leaderboard_period` | all/day/week/month/year; leader-only leaderboard calendar range, separate from ticket-date and SLA report filters. |
| `leaderboard_member`, `leaderboard_detail`, `leaderboard_page` | Member ID from the current roster, detail type (resolved/overdue/ratings), and optional page. Applied together on the leader-only leaderboard. |
| `report_period` | all/day/week/month/quarter; applies to SLA received date, not ordinary ticket summaries. |
| `preview_user` | Registered preview account ID; only authorized preview endpoints may use it. |

Creation-date filters apply as soon as either date is selected or removed. An inverted range is shown as invalid and is not sent until corrected. **Clear filters** clears date bounds, search, status, priority and closure period, while retaining the current page type, sorting and page size.

Navigation preserves relevant filters, preview identity, sort and page size. Applying filters starts a new first page; pagination links retain query parameters. Summary cards deliberately clear incompatible dates/status/closure settings when opening all-time counts; several status/report links can retain the current priority filter. Combined filters intersect. Summary totals themselves do not shrink with table filters.

Ticket-module data polls every 60 seconds while the document is visible and no ticket editor is selected. Props include counts, workload, rating, leaderboard and pending feedback. This is polling, not realtime push; no guarantee of immediate closure popups while on another page.

## XLSX import and export

`TicketWorkbookControls.jsx` uses native download anchors and Inertia upload/confirmation forms. The workbook actions sit at the upper right of the ticket table, above the filters on All tickets and Assigned to me. IT members can export, and IT Team Leaders can import and export. The leaderboard provides its own export button.

**Export:** IT members and IT leaders only. Employee-workflow accounts see no export controls and receive HTTP 403 on direct live or preview export requests. Full authorized filtered/sorted Tickets sheet, not just the visible page, maximum 10,000 tickets. Narrow filters above that limit. Includes Export scope and Dashboard summary; leader workbooks add Ticket reports, SLA performance and Staff workload. Member summary includes own resolver rating/count. All cells are explicitly strings to prevent formula interpretation; header freeze, widths, wrapped text and autofilters are added.

Only the Tickets sheet uses table filters. Dashboard/report/workload sheets retain their normal environment/personal scope; SLA uses report_period. Export scope records this distinction. The leaderboard has its own selected-period XLSX export, separate from ordinary ticket/report export.

**Import:** IT leader only, creates new tickets only. Download template → upload → validate all rows → review employee/branch/subject preview → confirm or discard. It never updates old IDs/statuses/history/timestamps. Batch is transactional; tickets enter SLA and receive import audit entries. Live imports notify IT through the existing bell; preview imports suppress notifications.

Exact first-sheet headers, in order:

```text
employee_id, branch_affected, subject, category, priority, department, affected_system, details, impact, supporting_links
```

The template includes instructions and employee IDs/names/allowed branches. Employee ID must belong to the live/preview environment, branch must be allowed for that employee, category/priority must match canonical values and supporting links use normal URL limits. Blank/Not Set priority is supported. Department in the **form** is derived from the account and cannot be changed; current **XLSX importer** instead requires a department string and prefers the account department when available. These paths are not yet identical.

Limits: 5 MB upload; 1–100 data rows; 10 exact columns; up to 3 workbook sheets; 200 ZIP entries and 20 MB expanded size. First sheet is read; formulas there are rejected, not evaluated. Pending raw rows live server-side in session under actor/environment key for 30 minutes. Confirmation revalidates identities and permissions; session-blocked POST serializes confirmation and a consumed token cannot be reused. Expired previews must be uploaded again. Import has no automatic duplicate-subject detection: uploading the same workbook as a new preview can create another batch.

## Database and migrations

Ticket IDs displayed to users start with **HW** (Hardware), **SW** (Software), **NW** (Network), **AC** (Account & Access), or **OT** (Other). Each prefix starts at `0000`, has its own counter, and grows past four digits when needed. Live and preview tickets share these counters to keep IDs unique across the database. Deleted IDs are not reused.

The category ID migration backfills existing tickets in ascending numeric ID order. Legacy categories outside the current list receive `OT`. The numeric primary key still links ticket history and older notifications. The new ID is shown in ticket lists, details, leaderboard details, XLSX exports and new notifications. It also works in ticket search and the related-ticket field. Deploy the migration with ticket writes paused, before serving the updated application.

`tickets` retains identity snapshots, creator/branch/assignee foreign keys, subject/description/category/status/priority, department, affected asset, operational impact, supporting-links JSON, timestamps/closed_at, preview flag, reporting channel/emergency reason, and SLA policy/state/receipt.

`ticket_activities`: ID, ticket FK (cascade delete), nullable actor FK (null on actor deletion), type, message, details JSON and created_at; indexed by ticket + creation time. `ticket_preview_users` registers test identities by role/slot. Existing users, roles, branches, departments, notification, cache and session infrastructure remain shared dependencies.

| Migration | Purpose |
| --- | --- |
| `2026_10_23_000001_create_tickets_table.php` | Base table, foreign keys, status/priority and closure indexes |
| `2026_10_23_000002_add_ticket_preview_support.php` | Preview separation and registered test users |
| `2026_10_23_000003_allow_multiple_ticket_preview_members.php` | Multiple preview users per role using slots |
| `2026_10_27_000001_add_ticket_intake_details.php` | Historical expanded intake columns |
| `2026_10_27_000002_add_ticket_sla_tracking.php` | SLA JSON/UTC receipt, channel/emergency metadata and activity table |
| `2026_10_29_000001_remove_obsolete_ticket_intake_fields.php` | Backup and removal of obsolete intake columns |

Cleanup removed `issue_at`, `issue_time_type`, `affected_users`, `affected_areas`, `error_messages`, `troubleshooting_steps`, `follow_up_contact`. The historical add migration remains so fresh installs migrate forward in order. The cleanup archives complete raw rows before dropping columns, aborts on backup failure, and preserves IDs/retained fields. Rollback recreates nullable columns only; archived values require deliberate recovery. SLA receipt is separate from removed issue time.

Local cleanup previously verified 99 retained tickets against `storage/app/private/ticket-backups/before-intake-cleanup-20261029-132122-516da179.jsonl`. That is a historical verification, not a permanent assertion that the live count remains 99. See changelog for the earlier demo reset archive. Backups are private sensitive data, not web downloads; do not commit them.

## HTTP endpoints and backend request flow

All endpoints are inside existing `auth` + `verified` middleware. Live prefix is `/tickets` with route-name prefix `tickets`; preview prefix is `/tickets/preview` with name prefix `tickets.preview`.

| Method / suffix | Handler | Purpose |
| --- | --- | --- |
| GET prefix | `index` | Compatibility entry point and legacy `?view=` bookmarks |
| GET `/dashboard`, `/all`, `/assigned`, `/leaderboard` | `index` | Named screen paths, with view set by route defaults; role restrictions still apply |
| GET `/open` or `/closed` | `index` | Legacy bookmark redirects to `/all` with the matching status filter after role checks. Legacy `?view=open/closed` also uses the main list. |
| GET `/create` | `index` | Form-only page |
| POST prefix | `store` | Validated single-ticket creation |
| PATCH `/{ticket}` | `update` | Authorized action, locked ticket, atomic activities/notifications |
| GET `/export` | `index` → `TicketWorkbook::export` | Filtered binary XLSX download |
| GET `/import-template` | `workbookTemplate` | Leader template download |
| POST `/import` | `workbookImport` | preview/confirm/cancel, leader-only, session lock 30 seconds |

`context()` resolves actor/environment first. Preview checks the real admin's permission but never replaces the authenticated session. Index validates filters and role/view access before data assembly. Store validates branch/department/fields and derives server identity. Update checks environment and requester/staff boundaries, validates action-specific fields, locks and reloads the ticket inside a transaction, rechecks member assignment, checks SLA and applies the action. Notification writes use database notifications.

Core Inertia props: ticketRole, ticketUser, preview/canPreview/previewUsers, tickets paginator, filters, categories/departments/branches/members, creationPage, employeeSummary/memberSummary/leaderSummary, prioritySummary, reports/memberWorkloads/memberRating, slaReport/slaPolicy, leaderboard, pendingImport and pendingFeedback.

## Preview, demo data and operations

Authorized users enter `/tickets/preview/dashboard` from Open UI preview. Dropdown names include role; multiple IT member test accounts exist. Test identities are disabled with random unknown passwords and example.invalid addresses, not alternate login accounts. Preview CRUD persists locally until deliberately reset; notifications are suppressed. Preview/live tickets, assignment rosters, feedback, ratings, reports, import/export and leaderboard remain separate.

`TicketPreviewSeeder`, `TicketPreviewNamesSeeder` and `AdditionalTicketMembersSeeder` manage role coverage, recognizable role-suffixed names and additional member accounts. Preview registrations and slots determine scope; do not hardcode person names/IDs into workflow logic.

`TicketPreviewDepartmentsSeeder` assigns only registered preview accounts to existing departments. It is called by both preview account seeders and can be run independently with `php artisan db:seed --class=TicketPreviewDepartmentsSeeder`. It validates department names before writes, backs up changed account IDs/previous department IDs privately, updates only department_id, and is idempotent. Live employees, ticket department snapshots, roles, branches, disabled status and login credentials remain unchanged.

| Preview role group | Department |
| --- | --- |
| IT member/leader roles, IT, IT Admin, generic admin | Information Technology |
| Employee | Operations (representative general test account) |
| HR, HR Assistant, HRBP | Human Resources |
| Audit Assistant, Auditor TL | Audit |
| Cashier TL | Cashier |
| Chief Vet | Veterinarians |
| Clinic Assistant TL, duty meal custodian | Clinic Assistants |
| Director of Corporate Services and Operations, Executive Vice President, Executive Assistant | Executive |
| General Accounting | Accounting |
| Housekeeping TL | Housekeeping |
| Inventory Assist / TL | Inventory |
| Marketing Manager | Marketing |
| Operations Manager | Operations |
| Procurement Assist / TL | Procurement |
| Vet Tech TL | Veterinary Technicians |

Unlisted future roles keep an existing department; otherwise the test seeder uses Operations. No new departments are invented. On 4 November 2026, 27 registered test accounts were assigned using this mapping. `php tests/verify-ticket-preview-departments.php` provides read-only presence/IT/generic employee checks.

`TicketDemoFactory` creates workflow-consistent Not Set/active/resolved/closed/paused/at-risk/breached/workaround/reopened scenarios using the support clock, restores frozen test time afterward, and respects branch scopes. `tickets:reset-demo` is local-only destructive maintenance, preview by default; `--include-live` also replaces local non-preview tickets after backup. It is not a deployment step.

Routine operational checks:

```text
php artisan route:list --path=tickets
php artisan migrate:status
php artisan schedule:list
```

Deployments need the ordered migrations, built assets and a running Laravel scheduler. `tickets:check-sla` runs every minute with overlap prevention; `php artisan schedule:work` can drive local testing. Running the checker may send real website notifications and is not a read-only check. No deployment or scheduler activation is performed by this documentation update.

Build with the configured Node/npm runtime. On this workstation the known fallback is:

```powershell
& 'C:/Users/s2010/AppData/Local/Author Software/nvm/installs/v24.22.0/node.exe' node_modules/vite/bin/vite.js build
```

Do not run demo reset during deployment. Use backups and staging acceptance for migration/data changes. Unrelated composer.lock/composer.phar changes were already present during original work; no dependency installation was required for XLSX.

## Tests and verification status

See [code map](TICKETING_CODE_MAP.md#verification-files) for every test's purpose. Typical targeted checks:

```text
node tests/ticket-form-submission.test.mjs
node tests/ticket-rating-dialog.test.mjs
php tests/verify-ticket-department.php
php tests/verify-ticket-sla.php
php tests/verify-ticket-feedback.php
php tests/verify-employee-ticket-dashboard.php
php tests/verify-ticket-leaderboard.php
php tests/verify-ticket-workbook.php
php tests/verify-ticket-codes.php
```

The standalone PHP checks use the configured local database and real code. Most write-producing checks roll back and fake notifications; review each script before using it against any other environment. Read-only dashboard checks require existing preview accounts. No broad production test authorization is implied.

Historical targeted builds/checks passed after their corresponding changes; this documentation audit does not rerun them or claim all scripts are currently green. `verify-ticket-schema.php` compares current rows against an old cleanup archive and will legitimately fail after those retained values are edited. Some older fixtures still use department strings that may not exist after the validated department dropdown; fixture maintenance may be needed before running older preview/feature checks. The full fresh-database feature suite was previously blocked by an unrelated procurement migration referencing purchase_orders before creation; it has not been reconfirmed or fixed here. Automated module checks do not replace an authenticated browser walkthrough, which has not been recorded as completed.

Known implementation distinctions: SLA/view labels may still use internal P1/P2 terminology in some explanatory controls/configuration; visible creation priorities use Critical/High/Medium/Low. Branch/department names are dynamic. The account department is snapshotted into new tickets; ticket creation cannot change it or the user account. UI time formatting in some table/history cells uses browser timezone, while date filters and reports use Asia/Manila; SLA instants use explicit UTC casts. The standard creation code and import paths should be checked together when changing timestamp storage.

## Documentation maintenance checklist

For every ticketing change:

1. Update this guide's affected role/screen/workflow/filter/import/data section.
2. Update SLA_IMPLEMENTATION.md when targets, timers, warnings or reporting formulas change.
3. Update TICKETING_CODE_MAP.md when adding/removing/renaming code, props, routes, migrations or tests.
4. Add a dated changelog entry describing behavior, replaced behavior, schema/data effects and validation actually performed.
5. Update regression fixtures alongside field/permission changes; distinguish tests executed from historical results.
6. Record local migration/backups and deployment status without publishing sensitive rows or credentials.

This is a repository maintenance convention, not an automation that silently watches or edits future code.
