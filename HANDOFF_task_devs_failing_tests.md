# Handoff: 12 failing task module tests

For: task module developers. Date: 2026-11-25.

## Summary

- 12 of 199 tests in `tests/*.mjs` fail on `beta` (`2af1dc7`). All are in the task module.
- The same 12 fail on `project-brave-merge` after beta was merged in. The task code and the test files
  listed here are identical on both, so the merge did not cause them.
- Nothing runs these tests automatically: `node --test` is not in `package.json` or `checks.yml`.
- The rules are newer than the tests. The task code last changed Nov 13 to 19, the tests Oct 25 to Nov 8.
  Most failures may be outdated tests, but **only you can say which behaviour is intended**.
- Nothing has been changed. No task code or tests were edited.

## Reproduce

```bash
node --test tests/*.mjs
```

Run with Node 22.23.5. `checks.yml` uses Node 24, which was not tried.

Paths below are under `resources/js/Pages/Tasks/` unless they start with `tests/`.

## Decide first: possible real bugs

### 1. Team Leaders cannot assign Operations Managers
- Test: `tests/assignmentDirectory.test.mjs:71`
- Expected Operations Managers for Alabang, Greenhills and Makati. Got none, although the directory has 3.
- Cause: the Team Leader rule at the end of `eligibleAssignees` (`assignmentDirectory.mjs`) allows Employees
  and some Team Leaders, but not Operations Managers.
- **Question:** should Team Leaders be able to assign Operations Managers?

### 2. The cleanup function does nothing
- Test: `tests/collaborativeTasks.test.mjs:93`
- Expected tasks 1, 2 and 5 removed. Got all five back.
- Cause: `removeIncorrectCollaborations` (`collaborativeTasks.mjs:77`) is now just `return tasks`, but the
  comment above it still says it removes tasks.
- **Question:** was it switched off on purpose? If so, delete it and its test.

### 3. A Supervisor cannot be the coordinator for an EVP
- Test: `tests/collaborativeTasks.test.mjs:72`
- Error: "Choose a coordinator within the final approver's assignment scope."
- Cause: `canMonitorCollaborative` accepts a Supervisor, but `createCollaborativeMain` also requires the
  person to be in the owner's `eligibleAssignees`. The EVP rule there does not include Supervisors, whose
  base role is Employee. The two rules disagree.
- **Question:** can an EVP pick a Supervisor as coordinator?

### 4. Task import is refused for an employee
- Test: `tests/taskEnhancements.test.mjs:9`
- Error: assignee "John Doe" is not available within your assignment permissions.
- Cause: the test uses the first Team Leader (Veterinary) and the first Employee (IT). Team Leaders can now
  assign employees only in their own department and branch.
- **Question:** is that limit intended? If so, the test needs a matching pair.

## Probably outdated tests: please confirm

### 5 to 7. Chief Vet is now allowed
| Test | Expects | Now |
|---|---|---|
| `tests/collaborativeTasks.test.mjs:13` | Chief Vet cannot create collaborations | Can |
| `tests/collaborativeOwners.test.mjs:6` | Chief Vet cannot own one | Can |
| `tests/assignmentDirectory.test.mjs:9` | EVP choices exclude Chief Vet | Includes 3 Chief Vets |

- Cause: `canCreateCollaborative` (`collaborativeTasks.mjs:10`) and the EVP rule in `eligibleAssignees` list
  Chief Vet explicitly.
- `assignmentDirectory.test.mjs:9` stops at its first failed check. Its later checks (Corporate Services and
  Operations Managers can assign everyone) also look outdated against the current rules.
- The error text in `createCollaborativeMain` still omits Chief Vet.

### 8. Editing lists one extra person
- Test: `tests/assignmentDirectory.test.mjs:46`
- Expected the same number as `eligibleAssignees` (1). Got 2.
- Cause: the extra person is the saved owner, who is outside the viewer's normal scope. The comment above
  `taskEditAssignees` says that is intended.

### 9. Leaderboard: Eve counts as overdue
- Test: `tests/leaderboard.test.mjs:40`
- Expected Alex and Bea. Got Alex, Bea and Eve.
- Cause: Eve's task is Not Started, past due and has `approvalRequired: true`. `leaderboardTaskIsOverdue`
  excludes only Pending Approval, Pending Review and closed tasks.
- **Question:** should unstarted tasks that need approval count as overdue?

### 10. Leaderboard: ties are alphabetical
- Test: `tests/leaderboard.test.mjs:78`
- Expected Bea first on an exact tie (lower ID). Got Alex.
- Cause: the final tie-break in `leaderboard.mjs:63` is now the name, labelled "Name A-Z".

## Cannot load

### 11 and 12. `companyDirectory` and `peopleSetup`
- Error: `ERR_IMPORT_ATTRIBUTE_MISSING`. No tests inside these files run.
- Cause: `companyDirectory.mjs:1` imports a JSON file without an import attribute. Vite accepts that; plain
  Node does not. The site build works.
- Possible fix, not tried: add `with { type: 'json' }` to the import, then re-run the tests and `npm run build`.
- Fixing this may reveal more failures, because these two files have never run in this setup.

## Suggested order

1. Answer the questions in items 1 to 4.
2. Fix the JSON import and re-run everything.
3. Update the outdated tests, or the code where a test turns out to be right.
4. Add `node --test tests/*.mjs` to `checks.yml` so these do not drift again.
