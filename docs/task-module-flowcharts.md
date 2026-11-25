# Task Module — Current workflow

Workflow reference updated November 21, 2026. See [Leaderboard scoring](task-module-scoring.md) for the versioned rubric, evidence, allocations and tests. This describes the current rules, not a claim that every role has been tested. IT Ticketing is a separate project and appears here only as a navigation destination.

## 1. Module overview

```mermaid
flowchart TD
    A([Open Task Module]) --> B[Resolve signed-in role, department and branches]
    B --> C[Dashboard: separate My Tasks and Team Tasks counts]
    C --> D{Choose an action}
    D --> E[My Tasks: your assignments across allowed work branches]
    D --> F[Team Tasks: permitted team assignments]
    D --> G[Create task or use a template]
    D --> H[Reports: permitted report types]
    D --> I[Hand over your tasks]
    D --> J[Calendar, Activity and Task History]
    D --> K[Leaderboard: permitted management roles]
    D --> L[Workspace Setup: Admin only]
    G --> M{Task type}
    M --> N[Assign to another eligible person]
    M --> O[Self-created request]
    M --> P[Collaborative workflow]
    N --> Q[Check recipient, department, branch and work type]
    O --> R[Apply higher-up approval rules]
    Q --> S[Save task and generate task ID]
    R --> S
    P --> T[Final approver, coordinator and child assignments]
    S --> E
    T --> E
    E --> U[Start task, perform work and submit output]
    F --> U
    U --> V[Designated reviewer approves or returns work]
    V --> W[Completed work retained in History]
    W --> X[Eligible accomplishments feed reports and leaderboard]
    H --> Y[Opening Rounds, narrative reports or intern reports]
    Y --> U
    I --> Z[Select your open tasks and eligible recipient]
    Z --> AA[Recipient accepts or declines each request]
    AA --> E
    L --> AB[Configure people, task options, task IDs and sounds]
    J --> E
    K --> AC[Inspect completed or overdue tasks]
    AC --> E
    C -. IT users .-> AD[Switch between Tasks and IT Tickets]
```

## 2. Standard tasks and self-created requests

```mermaid
flowchart TD
    A([Create task or import XLSX]) --> B{Allowed to create?}
    B -- No --> C[Do not allow creation]
    B -- Yes --> D{Purpose}
    D -- Assign to someone --> E[Choose another person within assignment permissions]
    E --> F[Validate department, branch, dates and required fields]
    F --> G{IT Supervisor selected by another Team Leader?}
    G -- Yes --> H{Type of work}
    H -- IT support --> I[Open IT Ticketing]
    H -- Reportorial --> J[Save standard task]
    G -- No --> J
    D -- Self-created --> K[Assign the task to its creator]
    K --> L{Creator role}
    L -- EVP or IT Supervisor --> M[No higher-up approval to begin]
    L -- Other Team Leader or Supervisor --> N[Task branch Operations Manager]
    L -- Operations Manager, Chief Vet or Corporate Services --> O[EVP]
    L -- Utility employee --> P[Department Team Leader or Supervisor]
    N --> Q[Pending Approval]
    O --> Q
    P --> Q
    Q --> R{Approver decision}
    R -- Deny with feedback --> S[Denied]
    R -- Approve --> T[Not Started]
    M --> T
    J --> T
    T --> U[Owner opens overview]
    U --> V[Press Start task]
    V --> W[In Progress: record start time and unlock work controls]
    W --> X[Enter output or reference to completed work]
    X --> Y[Submit for review]
    Y --> Z[Pending Review: save submission time and elapsed time]
    Z --> AA{Designated reviewer decision}
    AA -- Return with feedback --> AB[Revision Needed]
    AB --> W
    AA -- Approve --> AC[Completed: save completion time]
    AC --> AD[Show in submissions and task history]
```

Creation approval and output review are different decisions. Assigning another person does not automatically require OM approval to begin. Team Leaders assigning another person review that person's output; other tasks use the designated reviewer resolved by the system. Standard assignment cannot be used to assign yourself. Ordinary employees do not create standard assignments; Utility has the self-created exception. Missing approvers or invalid permissions block saving rather than granting approval.

## 3. Collaborative workflow

```mermaid
flowchart TD
    A([Create collaborative workflow]) --> B[Step 1: final owner, title, description, dates and output]
    B --> C{Required fields valid?}
    C -- No --> B
    C -- Yes --> D[Step 2: choose coordinator and assignment]
    D --> E{Valid people, branch and deadlines?}
    E -- No --> D
    E -- Yes --> F[Save main task and coordinator assignment]
    D -. Back: keep entered values .-> B
    F --> G[Coordinator delegates permitted child assignments]
    G --> H[Optional prerequisites between sibling assignments]
    H --> I{Prerequisites completed and approved?}
    I -- No --> J[Block dependent work]
    J --> I
    I -- Yes --> K[Assigned owner starts work]
    K --> L[Perform own work or coordinate further child work]
    L --> M{All required child work approved?}
    M -- No --> N[Wait or request corrections]
    N --> M
    M -- Yes --> O[Submit text or link output]
    O --> P[Parent coordinator reviews child output]
    P --> Q{Decision}
    Q -- Return --> L
    Q -- Approve --> R[Child task Completed]
    R --> S{All assignments under main task approved?}
    S -- No --> G
    S -- Yes --> T[Final owner starts main task and enters final output]
    T --> U[Final owner completes and closes workflow]
```

Every parent/coordinator submission and child submission needs text or a link. A child deadline may be the same as its parent's deadline, but cannot be later. A task cannot start before its prerequisites are approved. A coordinator with child assignments cannot hand over that coordinating task through the standard handover flow.

## 4. Reports

```mermaid
flowchart TD
    A([Open Reports]) --> B{Permitted report type}
    B --> C[IT Opening Rounds: one shared report per branch per day]
    C --> D{No IT staff at the branch today?}
    D -- Yes --> E[IT Supervisor dismisses today's branch report]
    D -- No --> F[Eligible IT worker starts and fills checklist]
    F --> G[Record checks, warnings and issue links]
    G --> H{Submitting worker}
    H -- IT Supervisor --> I[Completed without another approval]
    H -- IT employee or intern --> J[Pending Review by designated reviewer]
    J --> K{Decision}
    K -- Return --> F
    K -- Approve --> I
    I --> L[Branch report complete; no second submission needed]
    B --> M[IT Narrative Reports: Daily, Weekly or Monthly]
    M --> N[Select report period and work branch]
    N --> O[Automatic Summary from eligible completed tasks in that period]
    O --> P[Enter Issues / Problems, Solutions and Follow-ups]
    P --> Q[Submit for designated review]
    Q --> R{Decision}
    R -- Return --> P
    R -- Approve --> S[Completed report]
    B --> T[Intern report, where permitted]
    T --> U[Fill report; eligible completed work populates the report summary]
    U --> Q
    S --> V[View saved reports by date or Report History]
    L --> V
    E --> V
```

Report visibility follows role and report permissions. A completed task must belong to the relevant person and reporting period to appear in their automatic accomplishments. Opening Rounds warnings are shown in both tile and list views. Completing today's shared branch report does not complete another branch or another day.

## 5. Single or multiple task handovers

```mermaid
flowchart TD
    A([Press Hand over tasks]) --> B[Show only your eligible open standard tasks]
    B --> C[Select one or more tasks; maximum 50]
    C --> D[Filter recipient departments using Create Task department access]
    D --> E[Choose a person eligible for every selected task's branch]
    E --> F[Enter instructions and send requests]
    F --> G{All selected shared records valid and current?}
    G -- No --> H[Show error; do not save a partial shared batch]
    H --> C
    G -- Yes --> I[Pending handovers; original owner remains responsible]
    I --> J{Recipient decision for each task}
    J -- Accept --> K[Change owner and department to recipient]
    K --> L[Keep deadline and previous owner's work in History]
    L --> M[Recipient starts a new work timer]
    J -- Decline --> N[Original owner keeps task]
    I -- Sender cancels --> N
    M --> O[Normal submission and review flow]
```

Tasks awaiting creation approval or output review, closed tasks, tasks with a pending handover, and coordinating tasks with children are excluded. Future repetitions remain with the original recurring-task owner. The recipient accepts each task separately; sending a request does not transfer responsibility immediately. Employees' handovers stay within their own department; management department choices follow the departments available through Create Task.

## 6. Repeating tasks and supporting features

```mermaid
flowchart TD
    A[Set frequency: Daily, Weekly or Monthly] --> B[Save repeating schedule]
    B --> C[Next scheduled period is due]
    C --> D[System creates a separate occurrence when recurring generation runs]
    D --> E[New task ID, shifted dates and reset work timestamps]
    E --> F{Self-created approval required for this occurrence?}
    F -- Yes --> G[Pending Approval]
    F -- No --> H[Not Started]
    G -- Approved --> H
    H --> I[Start, work, submit and review]
    I --> J[Preserve each occurrence's own history]
    J --> C
    K[Import XLSX] --> L[Validate file, headings and every task row]
    L --> M{Errors found?}
    M -- Yes --> N[List errors by row and field; fix before import]
    N --> L
    M -- No --> O[Normal assignment permissions and approval rules]
    P[Export XLSX] --> Q[Export the selected or filtered view]
    Q --> R[Workbook table begins at B2 with gridlines hidden]
    S[Task events] --> T[Notifications, Activity and task History]
    S --> U[Admin System Logs]
    V[Completed eligible tasks] --> W[Leaderboard points, separate completion counts and score breakdown]
    X[Overdue unfinished tasks] --> Y[Overdue counts and task drill-down]
    Z[Calendar] --> AA[Group work by deadline and show overdue work]
    AB[Admin Workspace Setup] --> AC[Maintain task options, people overrides, task IDs and sounds]
    AC --> AD{Task ID format scope}
    AD -- New tasks only --> AE[Keep existing IDs]
    AD -- Existing and new tasks --> AF[Regenerate existing IDs and record previous IDs in History]
```

Recurring tasks create separate records; they do not erase the previous period's work. Approval waits and output review are distinct from work in progress. Leaderboard demo values are simulated and separate from actual accomplishments. Display preferences include dark mode and compatibility mode. Workspace person overrides affect the Task Module; Employee Management remains the staff source.

## Code references

- `app/Services/TaskModuleAccess.php`: roles, assignment access and reviewer resolution.
- `app/Services/TaskModuleWriter.php`: task creation, approvals, work timestamps, submissions and collaborative checks.
- `app/Services/TaskModuleTurnover.php` and `app/Http/Controllers/TaskModuleController.php`: single and multiple handovers.
- `app/Services/TaskModuleRecurrence.php`: recurring occurrences.
- `resources/js/Pages/Tasks/Index.jsx`: navigation, preview behavior and task/report interfaces.
- `resources/js/Pages/Tasks/taskApproval.mjs`, `collaborativeTasks.mjs`, `taskCsv.mjs`: preview approval, collaboration and import flows.

## Interface wording (20 November 2026)

Decorative dashboard greetings, taglines, task-form introductions and cat-themed list/leaderboard phrases were removed or replaced with plain headings and empty-state messages. Functional workflow instructions, counts, filters and permission rules remain unchanged.


24 November 2026: The scoring rubric now uses raw Time (0-2) + Priority (0/2/4/7) + Returns (0/0.5/1) points, maximum 10. The user confirmed full final-completer allocation after handovers, superseding the former 50% shared pool. Low can earn up to 3 points. See task-module-scoring.md for rules, policy migration, examples and tests. Role preview remains restored for local testing.
