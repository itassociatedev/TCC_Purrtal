# Handoff: Documentation Agent Briefing for TCC Purrtal

Written 2026-11-26 from the `project-brave-merge` branch, with Nico (IT Associate, The Cat Clinic).
Purpose: bring a documentation agent up to speed on **what the system is, every module, and what each one is for**, so it can write accurate user and developer documentation.

**How to read this file.** It is a map, not the final word. Facts here come from the code layout, route files and the existing guides listed in section 9. Each module section says where the source of truth lives. **Read that code before you write a claim into published documentation.** Where I could not confirm something, it is marked **(unverified)**.

---

## 1. What TCC Purrtal is

TCC Purrtal is the internal employee portal of **The Cat Clinic** (veterinary clinic group, three branches: **Makati, Alabang, Greenhills**; branch codes `MKT`, `ALB`, `GH`).

Goal of the system: one signed-in place where staff do their daily work and where management runs the clinic's back office. It replaces scattered spreadsheets, chat messages and paper forms with tracked, role-aware workflows:

- assign, review and report on work (Task Module)
- raise and resolve IT problems against response-time targets (IT Ticketing)
- request HR items and approve them (HR Module)
- raise purchase requests and orders (PR/PO)
- register and account for physical assets (Asset Management)
- schedule staff and track attendance (Attendance)
- manage duty meals (Duty Meals)
- publish company information and keep people records (Admin Module, Document Repository, Org Chart)

Every module is gated by who the signed-in person is: role, position, department and branch.

## 2. Tech stack

| Layer | Technology |
|---|---|
| Backend | Laravel 12, PHP (local dev PHP 8.5, composer constraint `^8.2`) |
| Frontend | React with Inertia 2 (server-driven pages, no separate API), Vite 7, Tailwind CSS |
| Database | MySQL (production and local); Pest tests use in-memory SQLite |
| Auth | Laravel Breeze-style auth, Sanctum, custom activation and password-reset links |
| Permissions | Custom module ACL (`AdminACL`), plus position- and role-based rules per module. `spatie/laravel-permission` is installed. |
| Spreadsheets | `maatwebsite/excel` and PhpSpreadsheet (imports, exports, templates) |
| PDFs | A hand-written dependency-free PDF writer inside two services (see Asset Management) |
| File storage | Local private storage; asset photos go to **Microsoft OneDrive** through Microsoft Graph |
| Mail / queues | Laravel mail, database queue; task emails use a dedicated `task-mail` queue |
| Routing helper | Ziggy (`route('name')` in React) |

Scheduled jobs (`routes/console.php`): `tickets:check-sla` every minute; task recurring-occurrence generator every minute. Both need `php artisan schedule:run` driven by cron or a scheduler.

Repo: `https://github.com/itassociatedev/TCC_Purrtal`. About 670 commits, 133 migrations.

## 3. Branches, deploys, rules the docs must not get wrong

| Branch | Meaning |
|---|---|
| `main` | Production. **Only a push to `main` deploys** (`.github/workflows/deploy.yml`, runs `php artisan migrate --force`). Pushing any other branch does not deploy. |
| `beta` | Integration branch for the task and ticketing teams. `checks.yml` runs on PRs and on pushes to `beta`. |
| `project-brave` | Shared team branch for the Asset Management module. |
| `project-brave-merge` | Current branch. Contains project-brave, ivan's, miel's and beta's work merged together. Pushed, level with origin. |

Agreed plan with the lead developer: merge into `project-brave`, present it for 1 to 2 months, then merge into `main`. Do not describe the merged work as released: it is not in production.

Rules for any agent in this repo: never commit `.env` or secrets; commit only when asked; add files by name; do not push to `main`.

## 4. Roles and access (cross-cutting, document this once, link from every module)

There are three overlapping access systems. Documenting them clearly is probably the most valuable thing you can do.

1. **Module ACL** (`app/Models/AdminACL.php`, screen: Admin > Access Control). Four levels per module: **Full** (create, edit, delete, admin), **Edit** (create, approve, reject), **View** (request and view only), **No access**. Module keys include `admin_overview`, `attendance_settings`, `employees`, `company_content`, `resource_links`, `announcements`, `documents`, `system_logs`, `org_chart`, `hr_overview`, `duty_meal` (+ `_setup_roster`, `_archive`, `_personal`), `access_control`, `form_2316_approvals`, `manpower_requests_form`, `approval_board_hr`, `feedback_form`, `products`, `purchase_requests`, `approval_board`, `purchase_orders`, `attendance_overview`, `attendance_setup`, `attendance_calendar`. Backend helpers on `User`: `canViewModule`, `canCreateModule`, `canEditModule`, `canApproveModule`, `canRejectModule`, `canDeleteModule`, `canAdminModule`. Frontend equivalents live in `navigation.jsx`. Source of truth: `ACL_QUICK_REFERENCE_v2.md`, `ACL_PERMISSION_HIERARCHY_v2.md`.
2. **Position-based workflow roles** for IT Ticketing and the Task Module (see sections 5.1 and 5.2). These look at the person's position (for example "IT Team Leader"), not their portal role.
3. **Asset access** (`app/Support/AssetAccess.php`): *Full manager* (named people plus roles Admin, Super Admin, Director of Corporate Services and Operations), *IT*, *IT intern*, and *entry-only* users (IT, inventory, procurement or audit departments). Details in section 5.5.

Other cross-cutting facts:
- `has_global_access` users pass the admin middleware.
- **Role preview**: a dropdown that lets authorised testers view the Task Module as another role. It does not impersonate the account on the server.
- **Dev account switcher** (`DevelopmentAccountSwitcherController`): local and testing environments only, one allowed email. Never document it as a production feature.
- New accounts are activated by an emailed setup link (`/setup-account`); forgotten passwords use reset links (`/reset-password`). Expired links go to `/link-expired`.

## 5. Modules

Module menu entries (header "Select Module" dropdown): Portal Home, Task Module (shown as "IT Task Module" for IT staff), Admin Module, HR Module, PR/PO, Asset Management, Duty Meals, Attendance, IT Ticketing. Left-hand quick links: Document Repository, Calendar, My Duty Meals, My Assets, Resources (internal and external links).

### 5.1 Task Module (largest module)

**Goal:** assign work to the right person, force approvals where the rules require them, record the output, and report on it.

- Pages: `resources/js/Pages/Tasks/` (about 80 files). Backend: `TaskModuleController`, services `TaskModuleAccess`, `TaskModuleWriter`, `TaskModuleTurnover`, `TaskModuleRecurrence`, `TaskModuleFollowUps`, `TaskIdSettings`; model `TaskModuleRecord`; `TaskIdFormatter` in `app/Support`.
- Dashboard with separate **My Tasks** and **Team Tasks** counts; lists with filters and paging.
- Task types: standard assigned task, **self-created request** (needs higher-up approval; who approves depends on the creator's role), and **collaborative tasks** (final approver, coordinator, child tasks).
- Lifecycle: create (or XLSX/CSV import) > Pending Approval where required > Not Started > In Progress > submit output > reviewer approves or returns > completed work kept in History.
- **Assignment permissions**: who may assign to whom depends on role, department and branch (`assignmentDirectory.mjs`, `TaskModuleAccess`). Document these rules from the code, not from memory; they changed Nov 13 to 19.
- Templates, repeating tasks (recurring occurrences generated every minute), task ID format setup, sound setup, notifications and pings, calendar, activity and task history.
- **Handover:** hand over single or multiple open tasks to another eligible person, who accepts or declines each (`TaskHandover`, `HandoverInbox`, `turnover` routes).
- **Reports:** Opening Rounds, narrative reports, operations report, weekly report, custom daily report, intern reports (`OpeningRounds`, `NarrativeReport`, `OperationsReport`, `WeeklyReport`, `CustomDailyReport`, `DailyReportSetup`).
- **Leaderboard** (and a TV display) for permitted management roles.
- **Workspace Setup / People Setup**: admin-only configuration of people, task options, IDs and sounds.
- Task emails: trial mode, queued on `task-mail`. See `docs/task-email-setup.md`. Reminders for due-soon/overdue are **not** enabled.
- Source of truth for rules: `docs/task-module-flowcharts.md` (Mermaid flowcharts, reviewed 18 Nov 2026) and the guardrails document `TCC Purrtal Task Module Guardrails v13 Admin Preview Testing - Updated.docx` in the repo root.
- **Known issue to mention, not hide:** 12 of 199 node tests in `tests/*.mjs` fail on `beta` and on `project-brave-merge`. See `HANDOFF_task_devs_failing_tests.md`. Several are probably outdated tests, but the intended rules are for the task developers to confirm. Do not document the disputed rules (Team Leader assigning Operations Managers, Supervisor as EVP coordinator, Chief Vet creating collaborations) as settled.

### 5.2 IT Ticketing

**Goal:** employees report IT problems; IT staff resolve them within an SLA (service-level target) that is measured and reported.

- Entry: `/tickets/dashboard`. Pages: `resources/js/Pages/Tickets/Index.jsx` plus `Components/Ticket*.jsx`. Backend: `TicketController`, `TicketPriorityController`, services `TicketAccess`, `TicketSla`, `TicketLeaderboard`, `TicketPrioritySettings`, `TicketPriorityOrdering`, `TicketWorkbook`, `SupportClock`.
- Three workflow roles derived from **position**: Employee (non-IT or missing position), IT member (positions starting with IT, except IT Team Leader), IT supervisor (IT Team Leader). The Executive Vice President position keeps the employee workflow plus leaderboard viewing.
- Views: dashboard, open, closed, all, assigned to me, reports, revisions, leaderboard; admin pages for Locations, SLA settings, Priorities and Handover.
- Lifecycle: create > assign > work > resolved (awaiting employee confirmation) > closed; optional half-star feedback after closure; reject or send back for revision for tickets submitted by IT members.
- SLA: hour-based, supervisor-managed priorities, support-hours clock, milestones preserved historically, alerts via `tickets:check-sla` each minute. No pause permission for any role.
- Temporary **assignment handover** from a supervisor to an IT member for a date range.
- XLSX import and export with a template.
- Separate regular and IT notification bells.
- **Fully documented already** in `Documentation/` (TICKETING.md, SLA_IMPLEMENTATION.md, TICKETING_CODE_MAP.md, TICKETING_CHANGELOG.md, last audited 19 Nov 2026). Link to it, do not rewrite it, and re-audit anything dated after 21 Nov.
- Tests: `tests/Feature/verify-ticket-*.php` focused scripts and `tests/ticket-*.test.mjs`.

### 5.3 HR Module

**Goal:** staff submit HR requests and feedback; HR and accounting approve.

- Routes `/hr-module`, `/hr-module/admin`, `/hr-module/accounting-approvals`, `/hr/feedback`, `/hr/manpower-requests`. Controllers: `HrRequestController`, `HR/FeedbackController`, `HR/ManpowerRequestController`. Models `HrRequest`, `ManpowerRequest`, `Feedback`.
- Staff overview, HR admin overview, Form 2316 approvals (tax form), manpower request form and approval, feedback form and submissions, HR approval board. ACL keys: `hr_overview`, `form_2316_approvals`, `manpower_requests_form`, `approval_board_hr`, `feedback_form`.
- **(unverified)** exact request types and approval chain: read `HrRequestController` and the `HR/` pages.

### 5.4 PR/PO (Purchasing)

**Goal:** controlled buying: products masterlist, suppliers, purchase requests, approval board, purchase orders, printable documents.

- Prefix `/prpo`. Controllers: `ProductController`, `SupplierController`, `PurchaseRequestController`, `PurchaseOrderController`, `PRPOStatusController`. Pages in `Pages/PRPO/`.
- Flow: create PR > approval board (approve or reject by ACL level) > generate POs from a PR > print PR or PO.
- Products and suppliers support CSV/XLSX import, export and import templates, plus batch delete.
- ACL keys: `products`, `purchase_requests`, `approval_board`, `purchase_orders`.

### 5.5 Asset Management (formerly "Accountability Module", "Project Brave")

**Goal:** know what assets the clinic owns, where they are, who is accountable for them, and prove it with signed forms.

Renamed to "Asset Management" on 2026-11-25. Older notes still say "Accountability Module"; the database and some file names (`AccountabilityPdfService`, `asset_user.accountability_type`) keep the old word on purpose.

What it does:
- **Asset overview** (`Admin/Assets.jsx`, `AssetController@index`): Overview tab and Asset List tab; filter and search (assigned to, warranty, condition, branch, category, department); details modal; edit; delete; bulk transfer, bulk delete, unassign. Lists show 10 rows per page by default, and a search or filter shows every match at once. The page number is typed in a box.
- **Add Asset**: branch defaults to Makati. The asset tag is **automatic and locked**, based on the highest number already used in that branch (for example last GH tag `GH-00235` makes the next `GH-00236`). Tag format `<BRANCH CODE>-<5 digits>`. Quantity 2 to 50 splits into that many separate assets with consecutive tags (cap 50 per save); serial, model, colour, remarks, condition and photo are per unit. Service: `AssetTagGenerator`.
- **Remarks** field per asset.
- **Import**: CSV/TXT/XLSX/XLS up to 20 MB (`importSpreadsheet`) with batch history, downloadable batch file and **reversal**; quantity rows expand into separate assets; blank tags are generated; branch is read from the tag, the row, the "Branch:" label or a chosen fallback. A legacy CSV import (`import`) also remains.
- **Asset Excel export** (`AssetMasterlistWorkbook`): exports only the rows ticked in the table, after an overview popup (counts, value, branch and condition breakdown, search and paging). Layout starts at B2, logo, title, group headers, header row 9, data from row 10, total value formula, frozen header rows. Text is always written as text, so cells beginning `=`, `+`, `-` or `@` cannot become formulas.
- **Accountability**: assign employees to an asset as **Personal** (one person) or **Shared** (several, with one team leader). Pivot table `asset_user` carries `accountability_type` and `is_team_leader`.
- **Asset PDF** ("Asset Accountability Form", `AssetAccountabilityFormPdfService`): one A4 form per employee, multi-page, repeating header, signature block kept together, unassigned assets listed last. The staff **My Assets** page (`Staff/MyAssetController`) offers the older US Letter form from `AccountabilityPdfService`. **Note:** the PDF button was replaced by Excel on the overview; the PDF routes still exist (`masterlist.pdf`).
- **Photo workflow**: staff capture or submit photos (`/asset-photos/capture`), IT reviews and approves or rejects (single or bulk), approved photos are stored in OneDrive in branch folders named `Greenhills`, `Makati`, `Alabang`, named from the asset tag plus submission id (for example `GH-00044-91.jpg`). Edits that include an image stay staged until approved. Images: JPG, PNG, WebP; 10 MB for submissions.
- **Asset Entry** page for entry-only users (IT, inventory, procurement, audit departments): can add assets but not see the whole overview.
- **Audit logging** of asset changes through `AuditObserver`.
- Access (`AssetAccess`): full managers see and do everything; IT (not interns) can view the overview; IT interns and entry-only users can add; only IT reviews photos.
- Setup guide: `ONEDRIVE_ASSET_PHOTOS.md`. OneDrive config uses Microsoft Graph client credentials with `Sites.Selected`. Never document real secrets.
- Open decisions and TODOs (do not present as built): rework of per-asset personnel assignment; responsive pass on the overview toolbar at tablet width; confirm depreciation rule (straight line, 60 months) with Finance; photos in the PDF (decided no); whether a hidden search or warranty filter should affect Overview totals.
- Existing docs, with known staleness: `ASSET_MANAGEMENT_PROJECT_GUIDE.md` (commit 1bf60b7 era), `PROJECT_BRAVE_OVERVIEW.md`, `PROJECT_BRAVE_MERGE_TO_MAIN_GUIDE.md`, `AGENT_CONTEXT_project_brave.md`. **They still describe the PDF filter popup, the old module name and the old photo and import behaviour. Update them from the code.**

### 5.6 Attendance

**Goal:** define shifts and schedules, record overrides, show who is on duty.

- Routes under `/attendance` and `admin/attendance-settings`. `AttendanceController`, `AttendanceSettingsController`; models `Schedule`, `ScheduleOverride`, `Shift`, `Holiday`, `AttendanceSetting`.
- Pages: Overview, Setup Schedule (with schedule import), Calendar, plus Attendance Settings (shifts, cut-offs, holidays) and overview export.
- ACL keys `attendance_overview`, `attendance_setup`, `attendance_calendar`, `attendance_settings`.

### 5.7 Duty Meals

**Goal:** manage which staff are entitled to duty meals per branch and day.

- Admin: overview, roster set-up, archive, participants, bulk delete, export, logs. Staff: "My Duty Meals" with bulk lock-in. Models `DutyMeal`, `DutyMealParticipant`, `DutyMealBranchRequest`. Roster CSV logic in `Pages/DutyMeal/rosterCsv.mjs` (tested by `tests/dutyMealCsv.test.mjs`).
- ACL keys `duty_meal`, `duty_meal_setup_roster`, `duty_meal_archive`, `duty_meal_personal`.

### 5.8 Admin Module

**Goal:** people records and company content.

- **Employee Management**: users, positions, branches, departments, roles; bulk import and export, activation and reset links (single and bulk).
- **Announcements and notices** with priorities and comments (`CommentController`).
- **Company Content** (mission, vision, content types), **Org Chart / Organizational Directory** (members, structure, reorder, photo adjuster), **Resource Links** (internal and external, reorder), **Document Repository** (categories, upload, view; HR "Document Requests").
- **System Logs and Security**: audit trail with export (`LoggerService`, `SystemLog`).
- **Access Control**: the ACL matrix editor (update, bulk update, reset, export).
- Admin dashboard overview.

### 5.9 Portal shell and shared features

- Portal Home dashboard (`Dashboard.jsx`, `ClinicHome`), Overview, Mission and Vision, announcements feed, org chart for staff, resources pages, profile edit.
- Notifications bell with mark read, mark all read, clear, load more; separate ticketing feed (`/notifications/ticketing-feed`).
- Display preferences and appearance switch (`useDisplayPreferences`, `AppearanceSwitch`).
- Shared spreadsheet import/export helpers (`SpreadsheetImportController`, `ModuleWorkbookTools`).
- Flash messages, confirm modals, mobile record tiles.
- The login page has an "Original / Updated" style switch.

## 6. Data and environments

- Local database used in dev: a restored production backup (`tccportal_backup_2026_11_10`), about 282 assets from Nico's import. Production data is never touched by docs work.
- Key env groups: `APP_*`, `DB_*`, `MAIL_*`, `TASK_*` (`TASK_SERVER_ENABLED`, `TASK_EMAIL_MODE`, `TASK_MAILER`), `ONEDRIVE_*`, `DEV_ACCOUNT_SWITCHER_EMAIL`, `VITE_HMR_HOST`. `README.txt` in the repo root contains a setup recipe, **but it embeds sample credentials: do not copy them into documentation.**
- Local run: `php artisan serve` (port 8000) and `npm run dev -- --cors` (Vite 5173). For other devices on the same network use `--host=0.0.0.0` and set `VITE_HMR_HOST` to the machine's current IP (it changes when Wi-Fi changes).
- Install gotchas: PHP 8.5 needs `composer install --ignore-platform-req=php`; after switching branches run `composer install` (beta changed dev dependencies).

## 7. Tests

- Pest: `php vendor/bin/pest tests/Unit` (23 pass on this branch).
- Node: `node --test tests/*.mjs` (199 tests, 12 known failures, see section 5.1). Not run by CI.
- Ticketing verification scripts: `tests/Feature/verify-ticket-*.php`.
- CI: `.github/workflows/checks.yml` (PRs and beta), `deploy.yml` (main only).

## 8. Suggested documentation deliverables

1. **Documentation index** (one landing page linking everything below).
2. **Roles and access** page (section 4), with a role-by-module table built from the real ACL seeds and `TaskModuleAccess` / `TicketAccess` / `AssetAccess`.
3. **One user guide per module** (sections 5.1 to 5.9): what it is for, who can use it, step-by-step tasks with screenshots, FAQs.
4. **Asset Management guide**: highest priority, because it is the newest and its existing docs are stale. Include tag rules, quantity splitting, Excel export, import and reversal, photo review, OneDrive.
5. **Developer guide**: architecture, folder map, how Inertia pages map to controllers, how to add an ACL module, testing, deployment and branch rules.
6. **Operations guide**: scheduler and queue workers, environment variables, OneDrive setup, backups before deploys (`migrate --force`).
7. **Glossary**: SLA, ACL, accountability (personal vs shared), asset tag, handover, collaborative task, duty meal, Form 2316, PR/PO.
8. **Known issues and open decisions** page built from this file's flagged items.

## 9. Source documents already in the repo (read these, then verify against code)

| File | Covers |
|---|---|
| `Documentation/TICKETING.md`, `SLA_IMPLEMENTATION.md`, `TICKETING_CODE_MAP.md`, `TICKETING_CHANGELOG.md` | IT Ticketing, thorough |
| `docs/task-module-flowcharts.md`, `docs/task-email-setup.md` | Task Module rules and email trial |
| `TCC Purrtal Task Module Guardrails v13 ... .docx` | Task Module guardrails |
| `ACL_*.md` (several, v1 and v2) | Access control. v2 files are the current ones. |
| `ASSET_MANAGEMENT_PROJECT_GUIDE.md`, `PROJECT_BRAVE_OVERVIEW.md`, `PROJECT_BRAVE_MERGE_TO_MAIN_GUIDE.md`, `AGENT_CONTEXT_project_brave.md`, `ONEDRIVE_ASSET_PHOTOS.md`, `mockups/asset-pdf/README.md` | Asset Management (partly outdated, see 5.5) |
| `HANDOFF_task_devs_failing_tests.md` | The 12 failing task tests |
| `HANDOFF_migration_accountability_type.md`, `HANDOFF_prompt_for_lead_dev_agent.md` | Asset migration and lead-dev briefing |
| `route-list*.txt`, `route_list.txt`, `handler_files.txt` | Old route dumps (may be stale; regenerate with `php artisan route:list`) |

## 10. Working rules for the documentation agent

- **Ground every claim in code or a dated source.** Name the file you checked. Mark anything you could not check as unverified.
- **Do not invent behaviour, permissions or screenshots.** If you need a screenshot, ask Nico to sign in; agents cannot enter passwords.
- **No secrets** in any document: no `.env` values, OneDrive client secret, mail credentials or user passwords.
- Distinguish **built**, **in the merged branch but unreleased**, and **planned**. Today only code on `main` is live.
- Keep the repo's tone: plain, short sentences, no marketing language. Nico writes in short casual messages and prefers a quick overview before big work and confirmation before commits.
- Put new documents under `Documentation/` (or `docs/`). Do not commit or push unless Nico asks. Do not touch application code; documentation only.
- When two documents disagree, the code wins; then tell Nico which document is wrong.
