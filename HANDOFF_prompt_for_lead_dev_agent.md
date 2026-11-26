# Handoff prompt: brief a new AI assistant on TCC Purrtal (`project-brave`)

Date: 2026-11-24

How to use: paste everything under "Prompt" into the lead developer's AI agent. It
asks the agent for a read-only briefing document, with no secrets, that a second AI
assistant can read to get up to speed on the asset accountability module.

## Prompt

I'm onboarding another AI coding assistant onto the TCC Purrtal Employee Portal, branch `project-brave` (the asset accountability module). Please write a briefing document for it. This is read-only: don't change any code, don't run migrations, and don't touch any production or live database.

Do NOT include any secrets: no passwords, API keys, tokens, client secrets, .env values, or real employee data. Describe settings by name only (for example "ONEDRIVE_TENANT_ID is required"), never by value.

Cover these points, and mark anything you're unsure of as "unsure" instead of guessing:

1. Project and stack
   - What the portal is, and the exact versions of Laravel, PHP, Node, React and Inertia in use.
   - Which PHP version the live server actually runs, and which PHP version composer.lock targets. (phpoffice/phpspreadsheet 1.30.4 in the lock requires PHP below 8.5, so what's the plan?)
   - How code reaches production: the GitHub deployment workflow, which branch deploys, and whether `project-brave` or `main` is the deploy branch.

2. Branching and collaboration rules
   - Which branch we commit to, whether we use pull requests, and who reviews and merges.
   - Rules on commit messages, force-push, and rebase vs merge.
   - Whether anyone must be told before touching shared files like Assets.jsx and AssetController.php.

3. The asset accountability module
   - Goals and scope of Project Brave: what's finished, what's in progress, what's planned, and what's out of scope.
   - Business rules not obvious from the code: personal vs shared accountability, team leader rules, asset tag format (for example GH-00034), branch codes GH, MKT, ALB, and how depreciation should work (the handoff notes say to verify the existing formula).
   - The photo submit, review and approve workflow, and how OneDrive storage is meant to work in production.
   - Who may do what, and why AssetAccess.php hardcodes five manager names.
   - Known bugs, tech debt, and half-finished features in this module.

4. Data
   - The assets, asset_user, asset_photo_submissions and asset_import_* tables, and how `assets.branch` (free text) relates to the `branches` table.
   - How we're expected to get test data: seeders, backups, or something else. I already restored a Nov 10 backup locally; confirm that's allowed for development.
   - The migration conflict: migrations 2026_11_22_000005 and 2026_11_23_000001 failed on the backup because the columns already existed, and were then made idempotent in commit 917e092. On the live server, are those migrations recorded as run, and did the columns get added by hand?

5. Local setup and testing
   - How to run the app locally, which test accounts exist, and which .env keys are required to boot (names only).
   - How to run the tests, and which tests are known to matter for this module.
   - Anything that differs between local and production that could surprise a developer.

6. The next tasks
   - The top few tasks for the person onboarding, in priority order, each with the files involved and the definition of done.
   - Anything that's blocked on IT, such as Microsoft tenant admin consent for OneDrive.

Format: Markdown with short sections and a file path next to each claim where possible. Save it as a new file named PROJECT_BRAVE_BRIEFING.md, outside any tracked folder, or output it in chat. Do not commit it.
