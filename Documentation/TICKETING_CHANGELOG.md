# Ticketing change history

## 24 November 2026 - Ticket Time Completion scoring

Superseded priority-only 20/10/5/1 awards with Priority 7/4/2/0 plus Time Completion 3/2/1/0 (maximum 10). Supervisors configure a per-priority on-time score. SLA deadlines preserve support windows/recorded holds, while the user-confirmed late brackets count calendar hours. Permanent resolution freezes all components and metadata. Existing resolved/closed awards are upgraded with before/after audits; missing time evidence never assumes full credit. Updated details, exports, docs and regression coverage. No push.


## 24 November 2026 - Review dismissed popups later

Eligible closed tickets now offer Leave A Review from ticket details. Dismissal suppresses the automatic prompt but allows a later manual review. One submitted rating per ticket is enforced under a row lock, and the option disappears after submission. Existing ownership, half-star, optional-comment and IT rating rules remain unchanged; no data migration. Added backend and frontend regression coverage.


## 24 November 2026 - Priority-based leaderboard points and descriptions

Added supervisor-managed points and descriptions per priority. Defaults are Critical 20, High 10, Medium 5 and Low 1; creation choices show optional descriptions. Permanent resolution freezes priority/points/resolver; later edits do not rewrite the award. Reopening/revision suspends completion credit and re-resolution replaces the award. Leaderboard ranks by points while retaining counts, ratings and count-based pie shares. Summary/detail exports show scores, and historical resolved/closed tickets receive an audited backfill where resolution evidence exists. Added isolated scoring tests and updated priority regression fixtures. This change is local pending user testing; no push.


## 21 November 2026 - EVP access follows position

Changed the EVP leaderboard/all-branch exception from database role to the existing Executive Vice President position. Verified employee 377 now has leaderboard access while a role-only EVP identity does not. Assigned the existing EVP position to the named local EVP test account, preserving its database role and password; updated repeatable local seeders. No new roles or positions. Expanded rollback-only permission regression; comments/docs updated. No push performed.

## 20 November 2026 - Removed locations no longer remain in admin list

Fixed the dedicated Locations screen loading soft-deleted rows after successful removal. All ticket admin screens and creation now exclude retired locations; historical ticket lists/filters and ticket relationships still include them. Existing removed rows disappear without another deletion or migration. Also restored built-in branch-code props on the dedicated Locations route, which previously only received them under the old Admin view. Added transactional controller coverage for active-list visibility, deletion redirect, post-delete exclusion, historical references/filtering, branch-code display and member denial. Regression and PHP syntax passed; no push performed.

## 20 November 2026 - Remove decorative interface copy

Removed dashboard/page/form taglines and decorative task-list introductions across Task and Ticketing. Replaced cat-themed empty states and leaderboard labels with plain content labels (Top Performers, First place). Kept operational instructions, percentage definitions, workflow notices, validation and submission acknowledgment content. No permission, timing, data or action changes. Frontend regression and production build passed; no push performed.

## 20 November 2026 - Prominent module heading switch

Replaced the small Tasks / IT Tickets tab pair with a single switch button beside the module heading. Task Module links to IT Ticketing; Ticketing and Ticketing Admin link back to Task Module. Added shared responsive/focus styling with a swap icon and 44px target, moved Task navigation from its dashboard into the persistent module heading and removed obsolete tab CSS. Existing routes and position-based access remain enforced. Comments and documentation updated; frontend regression and production build passed. No push performed.

## 20 November 2026 - Match Task leaderboard colors

Ticket leaderboard now uses the muted eight-color Task CompletedTaskPie palette, matching gold/silver/bronze podium colors and shared portal surface, text, header and rank-badge theme tokens. Added matching dark-mode podium shades and warm overdue text. Ticket layout, fixed podium heights, icon animation, chart geometry, ranking, filters and permissions are unchanged. Updated component/CSS comments. Production build passed; no push performed.

## 20 November 2026 - Hide disabled staff in workload

Applied the existing User::notDisabled scope only to the staff workload query. Disabled accounts no longer appear in workload panels or the corresponding workbook sheet. Their accounts/tickets/history and other roster scopes are unchanged. Extended position regression confirms exclusion and retained data using rolled-back fixtures. No migration or push performed.

## 20 November 2026 - Replace IT database roles with HR positions

Ticket workflow authorization now uses IT Team Leader for the supervisor view, other IT positions for the member view and non-IT/missing positions for the employee view. Workload, leaderboard, handover, member-submission review, notifications and sidebar navigation use the same classification. EVP read-only leaderboard access remains. The migration reassigns obsolete IT-role users to employee with their IT position, including the three active dummy accounts; removes IT TL/IT Member/IT Intern roles and their obsolete ACL entries; preserves unique legacy preview links and existing accounts/tickets. Test account passwords and real admin portal roles are unchanged. Updated local/legacy seeders to avoid recreating obsolete roles. Added position permission regression and updated current documentation/comments. Position, actual/test roster, member review controls, EVP, handover, no-pause, ticket lifecycle, workload filters, frontend submission checks, PHP syntax and the production build passed. Assigned-owner selectors omit inactive accounts; historical staff filters/rosters retain them. No push performed.

## 20 November 2026 - Visible import limits

Added a compact note beside Import new tickets: .xlsx only, maximum 5 MB, maximum 100 data rows. It remains visible when the import panel is collapsed; the header is not counted as a data row. This is a UI clarification only; import validation is unchanged.

## 20 November 2026 - EVP local test login

Reused local dummy user 454 (Executive Vice President), replacing the older long-form test email with evp@tcc.local and setting the requested test password. Role, department, branch and ticket identity were preserved. LocalEvpAccountSeeder configures only this dummy identity, rejects non-local databases and unrelated account collisions, and verifies the password hash and leaderboard permission. LocalRoleAccountsSeeder now uses the EVP alias and can adopt the older test email without duplication. No other accounts were reset; no push performed.

## 20 November 2026 - EVP can view the ticketing leaderboard

Granted Executive Vice President a separate read-only leaderboard capability and sidebar entry. EVP can filter by period and view resolved, overdue and rating/comment drill-downs. Existing employee ticket scoping and IT-only management/admin/export permissions remain unchanged; exports are hidden for EVP and rejected server-side. No role/database migration or data change required. Added transactional permission coverage; period/drill-down checks, blocked actions and production build passed. No push performed.

## 20 November 2026 - Resettable table sorting and partial refresh

Added ascending/descending/default header cycles and a hover hint. Clear filters now restores creation-date descending order. The server returns `sort_active` to distinguish default from explicit sort, including the creation-date column. Sort and clear requests preserve page state/scroll and fetch only ticket/filter props. Other navigation retains default-sort state instead of silently making it explicit. Added handler and controller regression checks. No database change or push performed.

## 20 November 2026 - Remove reporting channel and emergency reason

Removed Emergency Reporting Channel and Why A Ticket Could Not Be Created from every role's creation flow, revision form, details, backend validation, model attributes, import defaults and demo generation. SLA receipt events no longer copy a channel. Applied a focused migration to drop both database columns for all existing test tickets and clean obsolete metadata from historical activity JSON. Verified both columns/model attributes and copied receipt metadata are absent; 201 tickets remain. Form submission checks for all three workflow roles, receipt checks and production build passed. The older verify-ticket-department.php script fails its department snapshot assertion because it still authenticates the admin while passing a removed preview identity; this unrelated legacy test is not a passing check. Other ticket data and SLA behavior remain unchanged. Migration rollback recreates columns without restoring discarded values. Updated intake fixtures, comments, documentation and focused schema/form checks. No push performed.

## 19 November 2026 - Action labels and single delay explanation

Ticket management action choices now capitalize the first letter of every word, retaining identifiers and acronyms. Document SLA Risk / Delay And Revised Estimate uses one required Reason For Anticipated Delay / SLA Risk field instead of both the generic Message / Reason / Findings / Next Steps and delay reason. Actions already taken, assistance required and next-update estimate remain required. The frontend submits `delay_reason` without `note`; TicketSla uses it as the history/notification message when no legacy note is supplied and avoids repeating the same reason in the notification. Older clients can still send a separate note. Existing history is unchanged.

Validation: form regression verifies three delay textareas and successful single-reason submission; transactional service regression verifies history persistence and missing-reason rejection. PHP syntax and production build passed. No push performed.

## 19 November 2026 - Comments and current references reconciled

Updated the guide, documentation index, SLA notification reference and code map for resolver-based workload counts, filter interactions, selected-ticket authorization, separate notification feeds, read/poll concurrency and regression coverage. Corrected obsolete assignment-based resolution and missing closure-notification descriptions. Updated inline comments in TicketController, NotificationController, TicketNotification and HandleInertiaRequests to describe the existing implementation. This pass changes comments/documentation only; runtime behavior and database data are unchanged.

## 19 November 2026 - Notification links open ticket details

New ticket notification URLs point to `/tickets/all?selected_ticket=<numeric ID>`. The shared bell also upgrades older stored ticket alerts using their `ticket_id`, without rewriting historical rows. The All Tickets controller loads the selected ticket independently of table pagination/search filters and includes the same relationships, SLA snapshot and member-submission flag as ordinary table records. The React ticket screen opens its existing details/manage dialog from `selectedTicket` on navigation.

Visibility is enforced server-side: employees can select only their own live tickets, and IT users retain existing team-ticket visibility. Missing, preview-only or unauthorized records return not found. Existing action permissions remain enforced when submitting changes. Reading an alert without navigating (Mark all read) does not open a ticket.

Validation: notification handler regression verifies old-alert deep links; workload/controller integration covers selected details outside table filters, missing records, forbidden employee access and new notification URLs. Production build passed. Database fixtures roll back, and notifications are suppressed.

## 19 November 2026 - Recent-change regression review

Fixed ticket-notification reads before the initial poll: successful reads now seed the IT feed from shared ticket props and update its badge without touching regular notifications. A pending-ID guard prevents duplicate requests from rapid clicks. Polling skips pending reads and rejects responses from before/during a completed mutation. Failed reads retain unread state, show an error and do not navigate away, allowing retry. Preview identity changes reset the loaded feed and do not fall back to the real account's ticket alerts.

Validation: new `tests/ticket-notification-read.test.mjs` covers initial-poll fallback, duplicate clicks, success/failure state and poll revision invalidation. Extended workload integration coverage includes legacy JSON-null resolver fields and multiple resolution events. Notification separation, shared bulk handlers, workload queries, ticket workflow regressions and the production build passed. Transactional database fixtures roll back; notifications are suppressed. No interactive browser test, push or deployment performed.

## 19 November 2026 - Separate ticket and regular notifications

Regular notification props, unread/total counts, list pagination, read-all and clear now exclude `TicketNotification`. Ticket alerts remain in the IT feed and its own badge. Regular bulk actions no longer mark ticket alerts read or delete them. The IT notification bell and polling are available to authenticated non-IT requesters too, so their ticket updates remain accessible after separation. Existing notification rows need no migration.

Validation: `tests/verify-ticket-notification-separation.php` checks feed separation and preservation of ticket unread/history state under portal bulk actions, with all changes rolled back. The shared handler regression checks ticket-feed independence and failure retry behavior. PHP syntax and production build passed.

## 19 November 2026 - Workload resolution drill-down correction

Resolved workload links clear a previously selected status or closure period. The IT intern has four closed tickets plus one resolved ticket; retaining Closed showed four while the workload total correctly showed five. Other table filters remain available. Legacy resolution activity fallback now uses the latest event, matching the model relationship and workload attribution. Regression coverage reproduces the status exclusion; the production build passes.

## 19 November 2026 - Clickable staff workload filters

The supervisor workload panel now links each member name and Assigned tickets statistic to the current-assignee filter. Resolved tickets selects the new supervisor-only `resolver_filter`, includes resolved and closed statuses, and attributes tickets to `sla_state.resolved_by`, falling back to the latest recorded resolution activity for legacy records. Workload resolved totals use the same attribution. Reassigned tickets therefore retain credit with their resolver.

Selecting a workload statistic replaces the other staff selection and retains existing date, branch/location, priority and search filters. Clicking Resolved tickets resets status and closure-period filters so both resolved and closed tickets appear; unrelated retained filters can still narrow the result. Assigned tickets retains the status filter. Resolver selection persists through sorting, pagination and filtered exports; the table shows the resolver name with a clear link. Clear filters removes both staff selections; changing the assignee dropdown clears resolver selection. Navigation away from All Tickets clears resolver scope. Statistics remain environment-wide totals independent of table filters. Statistic panels support keyboard focus and have explicit accessible link labels.

Validation: `tests/verify-ticket-workload-filters.php` passed controller checks for resolver attribution after reassignment, closed-ticket inclusion, current-owner selection, combined filters and rejection of non-supervisor resolver queries. Fixtures roll back and notifications are faked. PHP syntax and Vite production build passed. No push or deployment performed.

## 19 November 2026 - Ticketing and shared notification bug fixes

- Related-ticket input now resolves current location/category/year codes, ignoring case and surrounding spaces. Numeric IDs remain supported; unknown IDs, self-links and preview/live isolation retain validation.
- Supervisor assignment rejects inactive accounts. Historical roster and leaderboard membership are unchanged.
- Closing an SLA-tracked ticket notifies its requester, after resolution documentation and closure-note validation. Supervisor-only closure and resolved-first requirements remain enforced.
- Shared portal read-all and clear actions immediately synchronize the signed-in user's separate IT notification feed. Preview recipients remain separate. Polling responses started before these mutations are discarded; failed read-all requests leave unread state retryable.
- Removed an obsolete successful-pause expectation from the form regression: pause remains prohibited, while historical pause resumption remains supported.

Validation: production Vite build and PHP syntax passed; ticket form, half-star dialog, shared notification handlers, ticket linking/inactive assignment/closure, SLA alert replay and no-pause regression checks passed. Database integration fixtures roll back and notifications are faked. No browser interaction test or deployment was performed. Existing task-module JavaScript suite failures are outside this ticketing/shared-code pass and were not modified.

Changed application code: `app/Http/Controllers/TicketController.php`, `app/Services/TicketSla.php`, `resources/js/Layouts/SidebarLayout.jsx`. Regression coverage: `tests/verify-ticket-bugfixes.php`, `tests/ticket-notification-actions.test.mjs`, `tests/ticket-form-submission.test.mjs`.

## 19 November 2026 - Priority removal with history preservation

Added supervisor-only confirmed removal of unused priorities, archival of used priorities, restoration, and last-active protection. Archived priorities retain ticket display/filter/report history and saved SLA policies but are unavailable for new tickets/imports or priority assignments. Historical priority-change references prevent hard deletion even after all current tickets have moved away. Active-priority row locks protect writes against removal races. Blank imports fall back to the first active priority if Low is archived. Added archive timestamp migration and integration coverage; no existing priorities were removed during implementation and no push was performed. Build, syntax, removal/settings/handover/receipt regression checks passed with rolled-back fixtures and fake notifications.


## 13 November 2026 — Documentation reconciled with current implementation

Updated the documentation index, main guide, SLA reference and code map against the current merged-project source. Corrected outdated assignment-only handover, minute-input settings, pause capability, config-only target selection and post-resolution priority behavior. Documented custom priority colors (ordinary ticket text, blue dashboard default), automatic selector/filter/report/import integration and the absence of priority deletion/archiving. Clarified current ticket ID counter tables, the submission popup/operating-hours/All my tickets wording, role badge removal and per-member leaderboard timing definitions.

This is documentation-only: no application files, database rows, priorities or permissions were changed; no Git push or deployment was performed. Source review and local Markdown link checks were performed. Previously recorded build/integration results refer to the earlier implementation work; no browser or application tests were rerun for this documentation edit. Older dated entries below remain history, not the current behavior contract.


## 9–10 November 2026 — Ticket review, locations and leaderboard

- Added leader rejection and revision requests for IT member submissions, a creator-only revision queue, activity history and notification links.
- Added branch and priority filters, IT assignee filtering, and responsive filter sizing. Replaced the employee Closed dashboard card with Resolved.
- Converted unset priorities to Low and made Low the database default. Added custom ticket locations and retirement without changing the branch directory.
- Added annual location/category ticket counters and backfilled older codes. Creation and filter dropdowns display location names.
- Added scoped XLSX drill-down exports and clickable ticket subjects across leaderboard views. Removed link underlines and the calendar caption, gave the podium fixed rank heights, and moved animation to the cat icons.

## 9 November 2026 — IT Intern ticket team membership

- Added the IT Intern role to the ticket member workflow so interns appear in IT Team Leader workload and leaderboard rosters and can receive assigned tickets.
- Updated the current role guide. The existing local IT Intern test account now uses the same ticket permissions as other IT members.

Last consolidated **10 November 2026**. See the [current guide](TICKETING.md), [SLA reference](SLA_IMPLEMENTATION.md), and [code map](TICKETING_CODE_MAP.md).

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


### 2026-11-13 - Remove SLA pause permission for all roles

Removed the Pause resolution timer action and pause-reason form from Tickets/Index.jsx. TicketController rejects pause actions and pause_reason payloads; TicketSla::apply independently rejects pause for every role and no longer implements pausing. Existing paused tickets retain Resume resolution timer so their clocks can continue without backdating historical waiting time. Automatic resolution completion and review-hold/revision behavior are unchanged. No ticket data or elapsed time was rewritten. Tests: tests/verify-ticket-no-pause.php covers server rejection for supervisor/member/employee, unchanged state/history and legacy resume. Recent ticket feature changes are committed to taskmodule-ticketing-merge; local launcher/process files are excluded.


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

### Dark-mode styling
Added ticket-scoped dark surfaces, readable controls and table headers, muted text contrast, tinted dashboard statistics, workload cards and dialog styling. Detached ticket dialogs receive the same theme variables. Changes affect presentation only.
