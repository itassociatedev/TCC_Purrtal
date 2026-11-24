# Task Module leaderboard scoring

Implemented 21 November 2026; ownership allocation updated 24 November 2026. This applies to Task Module scoring, not IT Ticketing SLA calculations. Approval, assignment, review and handover eligibility continue to use the existing Task Module permissions.

## Approved defaults

| Criterion | Maximum | Rule |
| --- | ---: | --- |
| Time Completion | 30% | On time 30; up to 24 elapsed hours late 15; over 24 through 72 hours late 6; over 72 hours 0. |
| Priority Level | 30% | Critical 30, High 24, Medium 18. Low excludes the entire task from points. |
| Errors or Returns | 20% | 20 minus 5 percentage points per formal return, minimum 0. |
| Ownership and Handover | 20% | 20; an accepted handover transfers shares of final points without another ownership penalty. |

Earned points = sum of criterion percentages / 100. For example, an on-time High task approved first pass earns (30 + 24 + 20 + 20) / 100 = 0.94 points. A High task up to 24 hours late with one formal return earns (15 + 24 + 15 + 20) / 100 = 0.74 points.

Deadlines are date-only and end at 23:59:59 Asia/Manila. Lateness uses elapsed calendar hours, not business/support hours. The server records each submission and formal return. The last submission that receives approval determines lateness. Reviewer approval delays do not reduce the time score. Earlier submissions and resubmissions remain available in the score breakdown and audit records. Ordinary comments and follow-ups do not increment returns.

## Eligibility and counting

Only Completed tasks with sufficient server-recorded evidence earn points. Pending Approval, Not Started, In Progress, Pending Review, Revision Needed, Denied and Dismissed earn zero. Low earns zero including all handover allocations. Reports and sample/demo tasks never earn actual employee points.

Collaborative parent/coordinator records earn zero. Each completed leaf deliverable is scored separately; a record with child assignments is excluded from points. Completed Tasks remains a separate count of completed records under the existing list filters, including Low and incomplete historical work; it is not the number of points. Parent coordination can appear in that count but never receives a duplicate point award.

Historical tasks without a scoring state or a complete evidence trail are explicitly marked incomplete_records and earn zero, even during recalculation. Their status and completion count are retained. The implementation does not infer perfect submission, return or handover history from legacy fields. Newly created recurring occurrences start their own policy and evidence trail.

Priority is frozen at the first completed approval. Existing edit permissions govern changes before completion, and every priority change is audited. Increasing priority after completion, including after a later reopening, is rejected transactionally.

## Ownership allocation

The original assignee initially holds 100%. Once a handover to another person is accepted, one fixed pool of 50% (configurable) of the final earned points is reserved. The original owner retains 50%; the pool is split equally among all distinct accepted recipients. A to B gives 50/50; A to B to C gives 50/25/25; A to B to C to D gives 50/16.666.../16.666.../16.666.... For a task earning 0.80 points, two recipients receive 0.20 each and the original assignee receives 0.40. There is no additional ownership-criterion penalty.

Later acceptances redistribute the same pool rather than cutting each holder's share again. Repeated recipients are counted once, and a return to the original assignee does not grant the original owner an additional pool share. Repeated or returning-owner transfers remain flagged for review. First-acceptance order resolves residual micro-shares deterministically, keeping the exact total at 100% rather than truncating three equal shares to 16.66% each.

Acceptance reserves allocation only; points remain zero until eligible completion. Pending, declined and cancelled requests do not affect the pool. Each acceptance records previous owner, recipient, acceptance time, pool percentage and reserved shares. Settings recalculation can change the configured pool size; prior reservations and results remain audited. The `equal_handover_pool_v2` allocation-rule marker identifies the new method. The additive 2026_11_23_000001_equalize_task_handover_pool migration updates existing recorded states once and writes before/after ownership_pool_recalculation audit entries without changing task status, history, policy version or earned task points. Deleted awards are not restored and missing legacy evidence is not invented.

Points use integer micro-points (1,000,000 = 1 point). Share rounding uses largest remainder allocation so the sum awarded exactly equals the task's earned units. Displayed points use two decimals and percentages use two; calculations and ranking use the integer ledger, not rounded text. Group and period filters sum those same allocations. Completion counts belong to the final completing assignee; earlier handover holders may receive points with zero completed tasks. Allocation department/branch snapshots retain where each ownership portion was recorded. Period filters use completed/approved dates, not submission dates.

## Admin Workspace Setup

The Leaderboard Scoring section is server-backed and restricted to active portal Admin accounts. The four fixed weights are displayed and must total 100%. Administrators can configure increasing lateness bounds with non-increasing scores, the deduction per return (0-20), and the handover pool percentage (0-100). The final lateness bracket must be unbounded. A sample calculation is visible before Save.

Newly created tasks only: existing tasks retain their policy version, including unfinished tasks. Also recalculate existing completed tasks: existing Completed records are reevaluated using the new version; incomplete historical evidence still earns zero. In-progress records retain their previous version. Policy changes use optimistic version checking; a stale edit returns 409 and must be reloaded. Settings changes and recalculation counts are written to system_logs and detailed task_scoring_audits. No task status is changed by recalculation.

## Persistence, lifecycle and security

- task_scoring_policies: immutable settings versions, actor and application scope.
- task_scoring_states: one current state per task, evidence JSON, result JSON, policy version and observed task version. This is the authoritative current award, not an additive counter.
- task_scoring_audits: submissions, formal returns, priority changes, accepted handovers, score evaluations, reversals, deletion reversals, policy changes and recalculations, with before/after details.
- TaskModuleWriter observes saves within the existing transaction and record lock. Client-supplied scoring is discarded. An unchanged record version is not scored twice. Repeated approval or refresh does not add awards.
- TaskModuleTurnover observes only accepted transfers as allocation changes. TaskModuleRecurrence initializes fresh occurrences. TaskModuleController reverses deleted records.
- Reopening or withdrawing completion suspends the current points. Eligible reapproval restores a freshly calculated result with a retained history. Scoring does not grant any new permission to reopen tasks.
- TaskScoring::canView enforces active management access and explicitly excludes interns and employees. Both the leaderboard data endpoint and page navigation guard use it. Existing task visibility/review permissions remain unchanged.
- Demo calculations are display-only, clearly labeled DEMO, exported separately and never saved to the scoring tables.

## Code map

Backend: config/task-scoring.php; app/Support/TaskScoreCalculator.php; app/Services/TaskScoring.php; app/Http/Controllers/TaskScoringController.php; app/Services/TaskModuleWriter.php; app/Services/TaskModuleTurnover.php; app/Services/TaskModuleRecurrence.php; app/Models/TaskModuleRecord.php; app/Http/Controllers/TaskModuleController.php; routes/web.php.

Frontend: resources/js/Pages/Tasks/LeaderboardScoringSetup.jsx; TaskScoreBreakdown.jsx; WorkspaceSetup.jsx; TaskLeaderboard.jsx; leaderboard.mjs; CompletedTaskPie.jsx; LeaderboardTv.jsx; Index.jsx; resources/css/task-leaderboard.css. Click Leaderboard Points to inspect and export task-level evidence, policy versions, criterion scores, returns and allocations. Employee, department, team, branch, search and period filters are retained.

Schema: database/migrations/2026_11_21_000001_create_task_scoring_records.php. It creates only the three scoring tables and an initial policy, with no fabricated historical awards or new staff roles/positions.

Tests: tests/Unit/TaskScoreCalculatorTest.php, tests/Feature/TaskScoringWorkflowTest.php, tests/Feature/TaskReleaseSafetyTest.php and tests/leaderboard.test.mjs. Cover lateness boundaries, priorities, returns, approval delay, allocation conservation, eligibility, repeat approvals, reversals, version scope, historical evidence, priority locking, invalid/stale settings and employee/intern access. Manual testing should additionally exercise Admin setup and the points dialogs in desktop/mobile browsers before release.

## Local setup

Apply the scoring migration before testing these screens:

```powershell
php artisan migrate --path=database/migrations/2026_11_21_000001_create_task_scoring_records.php
php artisan migrate --path=database/migrations/2026_11_23_000001_equalize_task_handover_pool.php
npm run build
```

The migration is additive and does not rewrite task records. Keep this change off beta until acceptance testing is complete.


24 November 2026: Corrected leaderboard column sizing after adding Leaderboard Points. The normal table budgets six columns, including Share; Needs attention uses a separate five-column layout. Percentages and overdue text no longer occupy the same horizontal space. Existing narrow-screen table scrolling is preserved.


24 November 2026: Employee/intern previews now suppress leaderboard navigation, dashboard preview and full leaderboard even when the authenticated administrator has leaderboard permission. `leaderboardAccess.mjs` intersects the server capability with the effective preview role/position; previews never grant access. Direct navigation falls back to Dashboard. Existing backend 403 checks remain authoritative for real employee/intern requests. Regression: tests/leaderboard-access.test.mjs and TaskScoringWorkflowTest employee/intern denials.


24 November 2026: Task leaderboard points display two decimal places in the table, podium, dashboard preview, pie legend, Presenter View, score breakdown/exports and admin sample calculation. Exact micro-point storage, ranking, allocation and share calculations remain unchanged; displayed rounded subtotals can differ from rounded totals.


24 November 2026: Increased the configured handover pool/default from 20% to 50%. The original assignee keeps 50% once another recipient accepts; the other 50% is divided equally among distinct accepted recipients. Without an accepted handover the owner keeps 100%. The four rubric weights remain 30/30/20/20 and total earned task points are unchanged. The local policy was versioned through the admin settings workflow with completed-task recalculation, retaining before/after audits. Existing installations must save the new pool under Workspace Setup > Leaderboard Scoring and choose recalculation to update old completed awards; changing the source default alone does not replace a saved database policy.
