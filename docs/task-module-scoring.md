# Task Module leaderboard scoring

Current rubric: 24 November 2026. This applies to Task Module tasks, not IT Ticketing SLA or priority points. Assignment, review, approval, handover and leaderboard access permissions remain unchanged. The role preview remains available for testing.

## Current ten-point rubric

| Criterion | Points |
| --- | --- |
| Time Completion | 2 on time/early; 1 for any late submission up to and including 48 elapsed hours; 0 more than 48 hours late. |
| Priority Level | Critical 7; High 4; Medium 2; Low 0. |
| Error or Returns | 1 for no formal returns; 0.5 for one or two formal returns; 0 for three or more. |
| Ownership and Handover | Allocation only: the final completing assignee receives all earned points. No additional criterion points. |

**Earned points = Time + Priority + Returns.** Do not divide by 100. Maximum is 10 for Critical, 7 for High, 5 for Medium and 3 for Low. Low is eligible for Time and Returns points. A task may legitimately earn zero without being an excluded record.

The user explicitly confirmed that when A hands a 10-point task to B and B completes it, A receives 0 and B receives 10. This supersedes the image's 50% deduction sentence and the previous equal-pool rules. With successive A-to-B-to-C handovers, the final completing assignee C receives the complete earned award; A and B receive no shares. If the task is handed back to A and A completes it, A receives all points. Pending, declined or cancelled requests do not change the assigned completer.

## Timing and formal returns

Deadlines are date-only and end at 23:59:59 Asia/Manila. Lateness is elapsed calendar hours, not business/support hours. Any positive lateness through exactly 48 hours earns the 1-point time bracket, including delays shorter than one hour. The final submission that passes review determines lateness, not the reviewer's approval time. All original and resubmission timestamps remain recorded.

Only actual Pending Review-to-Revision Needed actions, or an authorized coordinator returning a completed child, count as formal returns. Comments, ordinary edits and follow-ups do not count. Both one return and two returns earn 0.5; the third return changes that criterion to 0. Approval delay has no effect on Time.

## Eligibility and attribution

Only Completed tasks with sufficient server-recorded evidence earn points. Pending Approval, Not Started, In Progress, Pending Review, Revision Needed, Denied and Dismissed earn zero. Reports, samples and collaborative parent/coordinator records are excluded. Completed leaf deliverables are eligible, so parent coordination does not duplicate their point awards.

Completed Tasks remains a separate record count, not a count of points. The count can include incomplete historical work with zero points. Final-completer point ownership follows the server-recorded final assignee rather than the reviewer or the original assigner. Each task contributes at most one current award.

Priority is frozen at the first completed approval, including later reopened work. Changes before completion retain existing edit permissions and are audited. Reopening or withdrawing completion suspends the award until eligible approval again. Repeated approval, saving and refreshing never add a duplicate award. Deletion reverses current awards without deleting the audit trail.

Historical tasks lacking complete scoring evidence remain explicitly incomplete_records and earn zero, even when an administrator recalculates them. The system does not fabricate earlier submissions, returns or handovers. Newly generated recurring occurrences have their own policy and evidence trail.

## Policy versions and admin settings

Admin Workspace Setup > Leaderboard Scoring displays fixed maxima Time 2, Priority 7, Returns 1, validated to total 10. Critical/High/Medium/Low priority points are fixed at 7/4/2/0. Administrators can configure increasing late-hour bounds with non-increasing scores from 0 to 2, and increasing formal-return bounds with non-increasing scores from 0 to 1. The final bracket must be unbounded. Zero formal returns must retain the full 1 point. Ownership is read-only final-completer credit under this model. A sample calculation shows the raw sum before saving.

The source default has model points_10. Existing saved policies without that marker retain the old percentage calculation and allocations, so their historical results remain reproducible. Loading the admin settings screen proposes the new defaults when the latest policy is legacy, without silently changing the saved policy. Saving creates an immutable new version. Old API payloads with percentage weights are rejected rather than silently interpreted as points.

- Newly created tasks only: existing tasks retain their saved policy, including unfinished work.
- Also recalculate existing completed tasks: Completed records adopt the new version and are recalculated from their existing evidence; incomplete records still receive zero. In-progress tasks retain their previous version.

The local application was upgraded through the admin settings workflow with recalculation of the four existing test tasks. Settings versions and before/after results are retained in task_scoring_audits and system_logs. Other installations must save the ten-point policy and choose recalculation if their existing completed results should change. No schema migration is required for this rubric change; policies, evidence and results already use JSON.

## Current database test scenarios

| Task | Scenario | Calculation | Final award |
| --- | --- | --- | --- |
| IT-1126-00001 | On-time Critical; no return | 2 + 7 + 1 | Member: 10.00 |
| IT-1126-00002 | On-time Medium; accepted intern handover | 2 + 2 + 1 | Intern: 5.00; original member: 0 |
| IT-1126-00003 | On-time High; one formal return and successful correction | 2 + 4 + 0.5 | Member: 6.50 |
| IT-1126-00004 | On-time Critical; accepted intern handover | 2 + 7 + 1 | Intern: 10.00; original member: 0 |

Totals: member 16.50, intern 15.00, combined 31.50. These are explicitly labeled local test tasks, not production staff accomplishments.

## Precision, display and exports

One point equals 1,000,000 integer micro-points. Stored and calculated totals use those integers; displayed points and percentages use two decimal places. Ranking and Share use exact values: person points / total points in the filtered results x 100. Employee, department, team, branch, search and period filters are retained. Periods use completed/approved dates rather than submission dates.

Click Leaderboard Points for task ID/title, priority, deadline, final submission and submission history, criterion values, return count/loss, final allocation and policy version. Entries identify whether their criteria are points (points_10) or legacy percentages. XLSX breakdown exports use score/unit columns instead of labeling new point values as percentages; legacy ownership scores remain identifiable. Main, podium, chart and Presenter View show points separately from completion counts. DEMO results use the new scale, remain clearly labeled and are never persisted as actual awards.

## Persistence and code map

- task_scoring_policies: immutable settings versions, actor and application scope.
- task_scoring_states: one authoritative state per task, policy version, observed record version, evidence JSON and current result JSON.
- task_scoring_audits: submissions, formal returns, priority changes, accepted handovers, evaluations, reversals and recalculations, including before/after results.
- config/task-scoring.php and app/Support/TaskScoreCalculator.php: defaults, dual-model calculation, exact allocations and legacy compatibility.
- app/Services/TaskScoring.php: server evidence, final completer, reservations, row-locked observations, idempotence and audits.
- app/Http/Controllers/TaskScoringController.php: Admin authorization, policy validation, optimistic version checks and optional recalculation.
- TaskModuleWriter, TaskModuleTurnover and TaskModuleRecurrence: existing lifecycle services record scoring evidence transactionally. TaskModuleController supplies authorized data and deletion reversals. TaskModuleRecord serializes score snapshots.
- resources/js/Pages/Tasks/LeaderboardScoringSetup.jsx, TaskScoreBreakdown.jsx, TaskLeaderboard.jsx and leaderboard.mjs: admin sample, rubric explanations, unit-aware details/exports, demo values and aggregation. Existing Index.jsx, CompletedTaskPie.jsx and LeaderboardTv.jsx retain their integrations.

Employees and interns remain blocked from leaderboard data and page access. Preview roles can restrict visibility but never grant server permissions. No new role, position, account or task is created by this rubric update.

## Validation

TaskScoreCalculatorTest covers on-time/sub-hour/48-hour boundaries, every priority including Low, 0/1/2/3+ returns, final/successive/returning handovers, raw ten-point totals, legacy percentages, exact share conservation, status exclusions and missing evidence. TaskScoringWorkflowTest covers actual submission/review/handover workflows, settings scope and validation, idempotence, priority locks, reversals and employee/intern denials. TaskReleaseSafetyTest covers existing assignment/review safety. Frontend leaderboard tests cover the new scale and allocations without changing completion counts or filters. Manual UI acceptance testing remains appropriate before live deployment.

### Score breakdown layout
The score dialog uses padded task cards, a responsive metric grid, wrapped evidence text, and a sticky header. On small screens metrics use two columns; this layout does not change scoring or allocations.

The breakdown presents a personal points/count summary, per-task personal award, labeled scoring criteria, a separate task total and recipient shares. Return deductions are explicitly labeled as already included. Submission, return and handover records remain available in expandable history; saved scoring values and export data are unchanged.
