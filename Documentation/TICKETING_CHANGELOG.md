# Ticketing change history

Last consolidated **6 November 2026**. This is implementation history, not a Git commit log or evidence of production deployment. The current behavior is in [TICKETING.md](TICKETING.md); detailed timing is in [SLA_IMPLEMENTATION.md](SLA_IMPLEMENTATION.md); source/test paths are in [TICKETING_CODE_MAP.md](TICKETING_CODE_MAP.md).

## 6 November 2026 — Local role accounts and ticket leaderboard

- Replaced the ticket preview panel and routes with normal portal sign-in for local role accounts. Added seeders for local accounts and sample tickets.
- Included IT team leaders in the ticket leaderboard roster and XLSX export.

## 6 November 2026 — Task-style ticket role preview (superseded)

- Replaced the ticket preview banner/one-list selector with a collapsible **View as role** panel matching the Task Module. The panel separates role selection from the matching test employee selector and can be collapsed when not in use.
- Role-only preview routes now resolve to a registered ticket test account, so the selected employee/member/leader sees the matching isolated test data rather than an in-memory copy of the administrator identity. Subsequent preview navigation preserves that account ID.
- Updated the ticket UI, preview identity resolution and current-system/code-map documentation. No schema, credentials, live tickets or production access rules changed. Validation: documentation and source review only; no automated tests or build were run.

## 6 November 2026 — Critical priority storage

- Migrated the stored `urgent` priority to `critical` in tickets, SLA snapshots, alert markers and structured history. Existing SLA targets and elapsed time carry forward. Older priority filter links still select Critical.

## 6 November 2026 — timezone labels

- Removed the visible Asia/Manila label from ticket screens and XLSX exports. Date formatting, filter boundaries and SLA calculations continue to use the same timezone.

## 5 November 2026 — category ticket IDs

- Added HW, SW, NW, AC and OT IDs with independent counters and backfilled existing tickets. Display, search, related-ticket entry, exports and new notifications use the new codes.

## 5 November 2026 — workbook actions in the ticket table

- Moved ticket XLSX import and export to the upper right of the ticket table panel, above the filters. IT members can export and IT Team Leaders can import and export.

## 5 November 2026 — employee status filters

- Removed the employee dashboard’s Resolved card and the Resolved option in the employee ticket table. Existing employee links filtered to Resolved now show Open tickets.

## 5 November 2026 — required priority on the create-ticket form

- The priority dropdown starts at **Select priority**. The browser and server require Critical, High, Medium or Low before creating a ticket through the form.

## 5 November 2026 — leaderboard detail views and podium animation

- Added staggered floating podium cards with reduced-motion support and aligned the pie-chart total beneath the resolution counts.
- Added member detail views from the resolved count, overdue text and rating. Each follows the current calendar range and live or preview scope. Ticket detail links open the existing editor, and rating details show each counted score and its comment.

## 5 November 2026 — open and closed views consolidated

- Removed separate Open tickets and Closed tickets sidebar pages. Use the status filter or dashboard cards in the main ticket list.
- Legacy named open/closed URLs redirect to All tickets with the matching filter and preserve other applicable query filters and preview identity. Legacy query bookmarks remain supported. Existing role boundaries are unchanged.
- Updated TicketScreen, controller compatibility handling, dashboard route verification and user guide. Validation: Vite build and read-only route/filter checks.

## 5 November 2026 — automatic ticket date filters

- Date bounds apply immediately on selection or removal; inverted ranges are blocked until corrected. Removed Apply dates and Clear dates.
- Added Clear filters to reset dates, search, status, priority and closure period without changing the current ticket view, sort or page size. Updated TicketScreen and the user guide. Validation: Vite production build.

## 5 November 2026 — ticket list navigation

- Removed duplicate page-navigation tabs from ticket lists. The sidebar remains the page navigation; filters, sorting and pagination remain available.
- Updated TicketScreen and the user guide. Validation: Vite production build.

## 5 November 2026 — two-decimal percentages

- Dashboard and workload percentages, leaderboard shares, SLA compliance/reopen metrics and XLSX percentage values now display exactly two decimal places. Zero values show 0.00%; unavailable SLA values remain N/A. Ratings and counts are unchanged.
- Updated presentation and export formatting plus the leaderboard regression check. Validation: PHP syntax, Vite build and rollback-only leaderboard/XLSX checks.

## 5 November 2026 — dashboard ticket groups

- Grouped employee, IT member and leader dashboard cards under **All Tickets** and **Open Tickets**. Overall/closed, priority and closure-period counts belong to All Tickets; active statuses and leader active queues belong to Open Tickets. Resolved tickets remain open until closed.
- Kept role-scoped counts, percentages and drill-downs. Added the open total to the leader group using its existing summary. No server or schema change.
- Updated TicketScreen, scoped dashboard styles and the user guide. Validation: frontend build and existing form-submission checks.

## 5 November 2026 — compact ticket list layout

- Moved View/Manage/Reopen directly below Ticket Subject, removing the separate Action column.
- Renamed Date of Creation to Timeline and moved the full SLA summary into it, removing the separate SLA column. Timeline continues to sort by creation timestamp.
- Ticket lists now wrap within their panel and switch to labeled rows with a separate sort control at narrow widths. Other tables and ticket permissions are unchanged.
- Updated TicketScreen, scoped ticketing styles and the user guide. Validation: Vite production build and existing form-submission checks.

## 5 November 2026 — IT feedback eligibility

- Blocked self-ratings and IT member-to-member feedback using the actual resolver, not the current assignee. IT team leaders can rate IT members on closed tickets they requested. Requester ownership and one-rating-per-ticket behavior remain in force.
- Shared the eligibility check between the popup queue and locked feedback submission. Existing ratings are preserved; no schema or frontend build change.
- Updated TicketAccess, TicketController, feedback integration checks, guide, SLA reference and code map. PHP syntax and rollback-only self/peer denial, leader success and queue checks passed.

## 5 November 2026 — named ticketing screen paths

- Dashboard, all, open, closed, assigned and leaderboard now use `/tickets/{page}` and `/tickets/preview/{page}`. Create remains `/tickets/create` or `/tickets/preview/create`.
- Sidebar, module entry, filter navigation, creation redirects and new notification links use named screen paths. Query parameters remain for filters/sort/pagination, preview identity and export scope. Existing `/tickets?view=...` and `/tickets/preview?view=...` bookmarks continue working.
- Route defaults select the screen before existing role checks; a query parameter cannot bypass a named screen's authorization. Import/export and ticket update paths remain unchanged.
- Updated routes, controller, React navigation, notification links and tests; validation: route registration, Vite build and read-only path/authorization checks.

## 4 November 2026 — any affected branch for IT department staff

- Added Information Technology department to the shared all-branch permission scope, in addition to existing role exceptions. Applies to form choices, server submission validation and XLSX employee branch validation, including preview identities.
- This only extends branch choice; it does not grant IT-management/export/closure permissions to employee-workflow accounts. Non-IT employees without an existing exception keep primary/linked branch scope.
- Updated ticketing config, TicketAccess, controller explanatory comment, department/branch checks and documentation. Validation: PHP syntax and rollback-only IT/non-IT branch acceptance/rejection checks. No frontend build or migration is needed for the server-supplied branch list.

## 4 November 2026 — preview account departments

- Assigned 27 registered ticket-preview users to existing role-appropriate departments so the account-owned Department field can support testing. IT staff use Information Technology, generic Employee uses Operations, specialist roles use the documented department mapping.
- Added TicketPreviewDepartmentsSeeder and called it from TicketPreviewSeeder and AdditionalTicketMembersSeeder for future accounts. Existing preview department IDs are backed up in private ticket-backups/preview-departments-*.json before updates. No live accounts, existing ticket snapshots or roles/branches/credentials were changed.
- Added read-only preview department checks and documented the mapping/code inventory. Validation: PHP syntax, local seeder execution and preview department verification.

## 4 November 2026 — account-owned creation department

- Creation now automatically displays the employee account's department as a read-only field, replacing the editable dropdown.
- Backend derives the snapshot from the acting employee relationship, including preview identity; submitted department values cannot override it. Accounts without a department receive a clear validation message and cannot submit until configured.
- Updated TicketController, TicketScreen, department regression checks and current guide/code map. XLSX importer behavior is unchanged.
- Validation: frontend build, PHP syntax and rollback-only department tests covering account snapshots, tampered submissions and missing account departments. No schema migration or existing-ticket rewrite.

## 4 November 2026 — IT-only exports

- Removed XLSX export controls from employee-workflow screens and added server-side HTTP 403 guards to live and preview export endpoints.
- IT member/leader exports and leader leaderboard export remain available. Authorization follows configured ticketing workflow roles; branch-selection exceptions do not grant export permission.
- Updated TicketController, TicketScreen, workbook integration checks and documentation. Validation: PHP syntax, frontend build, rollback-only live/preview export permission and staff export checks.

## 4 November 2026 — leaderboard periods and XLSX export

- Added Day, Week, Month, Year and All time, default All time, using current calendar periods in Asia/Manila through the current instant. Week starts Monday.
- Resolution counts use latest resolution date; ratings use latest-feedback submission date; current overdue assignments use ticket creation date. Top-three cards, ranking, contribution shares, ratings and attention all recalculate for their documented date basis.
- Added a dedicated leaderboard XLSX download using the exact same summary computation, with all member rows, rank, role/branches, resolution/share, rating/count and overdue count, plus period/environment/date-basis metadata. Ordinary table and SLA filters do not change leaderboard scope.
- Updated TicketLeaderboard service/component, TicketController, TicketScreen, CSS and leaderboard checks, plus current documentation/code map.
- Validation: Vite production build, PHP syntax, rollback-only leaderboard checks for deterministic day/week/month/year/all-time boundaries and matching XLSX rows. No schema or production changes.

## 4 November 2026 — module name

- Renamed the module from IT Ticketing to **IT Ticketing Module** in the header module selector, active-module label, page heading and browser title.
- Updated TicketScreen and SidebarLayout together so the renamed active module still matches the layout condition. Ticket routes, permissions and data are unchanged.
- Updated the current guide and code map. Validation: Vite production build.

## 3 November 2026 — leaderboard member ratings

- Added average resolver rating out of five and rated-ticket count for every IT member in the leaderboard table; top-three podium cards show average rating too.
- Uses latest feedback per ticket, frozen resolver attribution with preceding-resolution fallback, and live/preview isolation. Current assignee never inherits another resolver's feedback. Half-star values contribute without integer truncation; averages display one decimal.
- Unrated members show Not rated yet and 0 rated tickets. Resolution-based ranks, ties, podium order, contribution percentages and overdue counts are unchanged. A reopened ticket can retain its historical rating while no longer counting as completed.
- Changed TicketLeaderboard.php, TicketLeaderboard.jsx, ticketing.css and verify-ticket-leaderboard.php, plus the current guide/code map/change history.
- Validation: PHP syntax, Vite production build and rollback-only leaderboard integration checks. No schema migration, ticket data rewrite or deployment.

## 3 November 2026 — documentation consolidation

- Replaced outdated, append-only ticketing and SLA guides with audited current-state references.
- Added complete frontend/backend/integration/migration/test inventory and feature-to-code trace examples.
- Added a documentation entry point to the root README, preserving its existing framework information.
- Added this dated change history and a same-change maintenance checklist for future features.
- Documented actual role boundaries, screen visibility, report versus table scopes, department/form versus XLSX differences, scheduler requirements and test limitations.
- This update changes documentation only. It does not run migrations, reset tickets, notify users, start the scheduler or deploy. Validation is source inventory/link checking; prior implementation test results are historical, not newly certified.

## 30 October 2026 — dropdowns, fractional ratings and priority behavior

- Employee **Need IT support?** quick-action strip moved to the top of its dashboard, matching the leader quick-action placement. Member placement remains separate.
- Department changed from account/read-only or free text to a dynamic existing-departments dropdown. Defaults to a matching account department; the chosen existing name is validated and stored as ticket snapshot without changing the account. No schema migration was required.
- Rating popup gained 0.5 increments from 0.5 to 5, half-star fill/hover and ten native radio targets. Backend uses numeric range and multiple-of-0.5 validation, preserves fractional values and keeps comments optional at <=3.
- Resolution display target now always follows newest selected priority, including paused/completed work, without resetting used support time. Historical completion result remains auditable; response completion target remains frozen. Integration checks cover active, paused and completed scenarios.
- Member and leader dashboards gained priority counts for Critical/High/Medium/Low/Not Set and clickable filtered lists. Member counts use current assignments; leader counts use team scope. Priority dropdown added to tables and filter is preserved in pagination/search/sort/export. Priority aggregation clones the clean summary scope to avoid status-group contamination.

## 29 October 2026 — current UI, reporting, XLSX and data cleanup

### Creation form and presentation

- Moved creation to its own live/preview URL instead of a form beside ticket tables.
- Removed occurrence/reporting-time selection and all user-entered ticket receipt timestamps; creation time is the reporting source.
- Renamed Branch to **Branch affected** and Issue or requested service to **Details of issue**.
- Removed e.g. placeholders from text inputs; category dropdown options gained explanatory examples while canonical stored category names remain unchanged.
- Visible priority choices became Critical/High/Medium/Low/Not Set; stored keys remain urgent/high/medium/low/null. Some SLA internals still use P1–P4 terminology.
- Removed intake fields for affected users/areas, error messages, troubleshooting attempted and follow-up contact. The final sequence is employee name, department, branch, subject, affected system, category, initial priority, issue details, impact, supporting links.
- Changed Non-closed terminology to **Open tickets**. Open includes Resolved until separately closed.
- Renamed Log emergency ticket buttons/sidebar/heading to **Create ticket**; IT channel/reason requirements remain implemented.
- Removed extra closure wording while retaining leader-only explicit closure behavior.

### Dashboards and navigation

- Employee default dashboard: own status counts, percentages, basic colors and creation/list quick access.
- IT member default dashboard: equivalent current-assignment summary, own resolver rating and quick access to assignments/all tickets/creation.
- IT leader default dashboard: team summaries and same categories as Ticket reports. **Manage team support** moved to the top.
- Added sidebar creation navigation and reference-style thin outline icons, with active-state styling.
- Status cards became working filtered links. Added table status selector, then leader Unassigned active/Priority not set queues and closure-period drill-downs matching report counts.
- Custom inclusive creation-date range added, with optional individual bounds, validation, apply/clear controls and Manila day interpretation.
- Removed SLA performance widget from All tickets while retaining other leader locations and XLSX report sheet.
- Ticket reports cards/closure totals became pointer/keyboard interactive links with selected states. Backend filters retain creator/assignment/environment scope.

### Resolution, history, feedback and leaderboard

- Simplified **Resolve ticket** from four overlapping explanations to Issue found + Fix applied and verification. Compatibility remains for older detailed resolution payloads.
- **Restore service temporarily** records workaround details plus optional remaining work. It does not close or independently satisfy the target. Critical leader workaround acceptance still requires recovery plan.
- History display changed to oldest first, preserving latest-first backend lookups needed for resolver attribution.
- Leader-only IT member leaderboard: top-three podium, contribution pie, full member table and current overdue attention. Resolutions use actual resolver, include closed, exclude reopened until resolved again; ties share rank. Zero-count roster members remain listed.
- Restyled leaderboard to supplied Top cats reference: silver/gold/bronze cat medals, second/first/third placement, chart legend counts/shares, pale-blue table, staff roles/branches and expandable explanation.
- Removed visible Rate the resolving IT staff action. Added closed-ticket requester popup: **How was our service?**, subject, stars, optional low-score comment, optional dismissal and sequential queue.
- Ratings/dismissals are requester-only and idempotent under a row lock. Skip creates no rating. Submitted resolver identity is frozen; historical fallback uses resolved activity. Rated/dismissed tickets are not prompted again after reopening.

### XLSX

- Added role-scoped filtered full-result export, including report scope metadata and personal/leader sheets. Limit 10,000 matching tickets; explicit string cells prevent formula interpretation.
- Added leader template with employee/branch guidance, constrained workbook reader, row-numbered errors, non-writing preview, confirmation/discard, expiring actor/environment session token and session lock.
- Import creates new tickets only, revalidates on confirmation, enrolls SLA and records import actor, using existing website notifications. Preview imports never notify live staff. No new dependency installation was needed.

### Schema cleanup and local maintenance

- Added and applied locally `2026_10_29_000001_remove_obsolete_ticket_intake_fields.php`.
- Removed issue_at, issue_time_type, affected_users, affected_areas, error_messages, troubleshooting_steps and follow_up_contact from schema/model, store/import writes, demo factory and ticket-details display.
- Existing tickets were not recreated: IDs, retained data, history, ratings and SLA state/policy were preserved. No synthetic replacement values were invented.
- Before removal, complete existing rows were archived to private `storage/app/private/ticket-backups/before-intake-cleanup-20261029-132122-516da179.jsonl`. Retained values for 99 rows were verified at cleanup time. Future edits can change counts/values; this is not a frozen live-data claim.
- Cleanup rollback recreates nullable columns only; restoring deleted values requires the private archive.
- Added focused feedback, workbook, leaderboard, dashboard, department and schema checks; updated affected older tests as features changed. Individual historical passes do not imply every old fixture remains current.

## 28 October 2026 — workflow and compact reporting revisions

- Employee initial priority became selectable, replacing the earlier Not Set-only creation rule. Leadership retains later reclassification control.
- Leaders became valid assignees with Assigned to me view; only leadership can close.
- Employee lists separated open and closed work, initially defaulting to open before later dashboard landing pages superseded that default.
- Added backend sorting across all authorized rows for nine ticket data columns, stable ID tie-breaking and priority order.
- Ratings attributed to actual resolver instead of sharing credit across the IT team/current assignee; staff panel gained average and rated-ticket count. Shared SLA requester-rating metric was removed.
- SLA panel became compact grouped tables/summary strips with basic semantic colors, responsive layout and expandable metric explanations.
- Ticket reports gained total/current closed/unassigned active/unclassified active counts with a separate overlapping closure-period strip.
- Fixed inert Save and notify handlers by separating Inertia React `form.transform(...)` from `form.patch(...)` / `form.post(...)`: transform returns void. Added actual installed-hook submission regression harness.

## 27 October 2026 — expanded intake and approved SLA

- Added the original expanded-intake migration and validation; several of its fields were later deliberately removed on 29 October. Do not reintroduce them from this historical entry.
- Added policy snapshot, UTC receipt/state, activity history, support-window clock, two milestones, approved pauses, latest-priority elapsed-time handling, explicit resolution/leader closure and reopening.
- Added acknowledgment documentation, progress/vendor/link metadata, delay estimates, Critical leader workaround acceptance, warning/breach/update reminders and website-only alerts.
- Added every-minute live-ticket checker with row locks and overlap prevention. Host scheduler activation remains an operational requirement, not an effect of adding schedule code.
- Existing records were excluded from automatic SLA enrollment. Initial policy used Not Set-only intake and separately backdated IT emergency receipt; later creation changes superseded both behaviors.
- Added local demo reset command and workflow-based scenario factory.
- A local reset archived 90 earlier tickets (89 preview, one local non-preview) and replaced them with 99 SLA-enabled examples (98 preview, one non-preview). Archive: `storage/app/private/ticket-backups/20261027-143826-64ddc04b-767f-436f-b12b-f9c483f26fbf.json`. IDs were not truncated/reused, accounts/branches retained, and reset notifications suppressed. This was local test maintenance, not production deployment.

## 23 October 2026 onward — foundation and early refinements

- Created Laravel backend and React/Inertia ticket screens using supplied clinic theme and employee/member/leader workflow boundaries.
- Added base ticket schema, creator/name snapshots, actual branches, categories, four statuses, priority/assignee, closure timestamp, role-restricted reads and transactions.
- Integrated IT Ticketing into the Select Module header, existing sidebar/layout and notification bell; added reference-matched white/gray/indigo styling and role badges.
- Added persistent leader reports above tables and staff workload counts/resolution percentage.
- Added safe UI preview using disabled registered test accounts without changing the admin session, exact role coverage, unique generic role-suffixed names and multiple member slots/accounts.
- Replaced fake/two-location lists with database branches. Branch restriction was temporarily removed, then restored with EVP/Executive Assistant/IT/configured IT staff exceptions. Current permissions are described in the main guide.
- Member default Assigned to me was later superseded by its dashboard landing page; Assigned to me remains available.
- Added nine detailed ticket columns, creation time, search, 5/10/15/all page sizes, empty/error/loading states and reopening by IT staff.

## Ongoing record policy

For future changes, add date, user-visible behavior, source/test paths, schema/data effects, validation actually run, and deployment status. Keep current guides internally consistent; place retired decisions here instead of appending conflicting current instructions. Do not publish private backup content, passwords, tokens or environment secrets.
