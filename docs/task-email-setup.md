# Task Module email trial

The trial uses the existing Laravel database and a dedicated `task-mail` queue. It does not change other modules' mail transports. `TASK_EMAIL_MODE=log` always selects the local `task-preview` mailer, even if the portal's default mailer is SMTP.

## Local setup

Run only this migration; do not run unrelated incoming migrations just to test emails:

```powershell
php -d extension=pdo_mysql artisan migrate --path=database/migrations/2026_10_25_000001_create_task_module_records.php
```

Local `.env` settings:

```dotenv
TASK_SERVER_ENABLED=true
TASK_EMAIL_MODE=log
TASK_MAIL_QUEUE_CONNECTION=database
```

Run `php artisan config:clear` after changing settings. The PHP installation on this computer requires `-d extension=pdo_mysql` when running database commands.

Process only the dedicated task queue:

```powershell
php -d extension=pdo_mysql artisan queue:work database --queue=task-mail --tries=3 --timeout=60
```

Generate an isolated, queued local preview with `php -d extension=pdo_mysql artisan tasks:email-preview`. It uses `TASK_TEST_EMAIL` (defaulting to a reserved `.invalid` address), a separate preview queue, and the log transport. This only addresses the preview; it does not deliver mail to that inbox. Preview output goes to `storage/logs/task-mail.log`.

## What is synchronized

New real-account creates, CSV imports, collaborative children, submissions, review decisions and deletions are persisted through authenticated Task Module endpoints. Reports use stable employee/date or branch/date keys. Records are refreshed on focus and every 20 seconds. Version checks reject stale writes. An audit event is saved for notification-worthy changes. Old browser-only tasks are not silently uploaded or bulk-emailed. Sample tasks and impersonated role previews stay local.

Use the actual assigned employee account to test emails; switching the role-preview dropdown does not impersonate that account on the server. To notify about old browser-only standard tasks, recreate them through their real creator after enabling server storage. Existing completed history is not backfilled with email events.

The task's notification recipients are resolved from Employee Management on the server. The browser never chooses recipient email addresses. Assignment/approval requests notify the employee, creator, and relevant reviewer; submissions notify the reviewer; decisions notify the employee and creator. Repeated versions do not create duplicate events. Draft edits do not send repeated messages.

Uploaded report photos remain in the existing browser attachment store; moving those attachments to shared file storage is separate from this email trial. Department/person overrides in browser-only Workspace Setup are not server authorization.

## Before actual delivery

1. Configure an approved sending account/service in Laravel's existing `MAIL_*` settings using the provider's supported authentication. Keep credentials out of Git.
2. Set `TASK_MAILER=smtp` (or the configured mailer name) and `TASK_EMAIL_MODE=send` in the deployment environment. Do not change local preview mode simply to test rendering.
3. Use the company's real HTTPS `APP_URL` and run a supervised worker for the `task-mail` queue. Restart workers after code/config deployments.
4. First validate delivery using designated test accounts before enabling production recipients.

No SMTP credentials, external delivery, production migration, deployment, or live user email is included in the local trial. Due-soon and overdue scheduled reminders are not enabled by this event-based implementation.

## Testing a specific recipient

Set `TASK_TEST_EMAIL=your-test-address@example.com` in the local `.env`, then clear configuration. Run `php -d extension=pdo_mysql artisan tasks:email-test` for a safe queued/logged preview.

When an approved sending mailer has been configured, `php -d extension=pdo_mysql artisan tasks:email-test --send` sends exactly one real test email to that address. It leaves `TASK_EMAIL_MODE=log` unchanged, so regular task events remain local previews. The command rejects the existing Mailtrap sandbox/local inbox configuration because it does not verify delivery to the requested Gmail/Outlook inbox.
