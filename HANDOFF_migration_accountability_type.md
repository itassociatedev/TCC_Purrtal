# Handoff: `accountability_type` migration conflict with the Nov 10 backup

Date: 2026-11-24
Branch: `project-brave` (commit `2d8b817`)
Raised by: Nico (local setup, working with a coworker on the same branch)

## Summary

While setting up a local environment from the Nov 10 production backup, migration
`2026_11_22_000005_add_accountability_type_to_asset_user_table` failed because the
`asset_user.accountability_type` column **already exists in the backup**. The
migration has no existence check, so it errors on any database that already has the
column.

This probably also affects the live server: if the live DB has the column but this
migration is still pending in its `migrations` table, the next deploy
(`php artisan migrate`) will fail the same way.

## Evidence (verified locally)

- Database restored from `tccportal_1794280502.sql.gz` (backup date 2026-11-10,
  45 tables) into a separate local DB, `tccportal_backup_2026_11_10`.
- `php artisan migrate` ran 4 of 5 pending migrations, then failed on the 5th:

  ```
  SQLSTATE[42S21]: Column already exists: 1060 Duplicate column name
  'accountability_type' (SQL: alter table `asset_user` add `accountability_type`
  varchar(20) not null default 'personal' after `user_id`)
  ```
- Existing column in the backup: `varchar(20)`, NOT NULL, default `personal`.
  This matches the migration's definition exactly.
- Migrations run before the failure: `2026_11_22_000001` to `000004`.
- Because migrations run in order, the failure also blocked
  `2026_11_23_000001_stage_asset_photo_submissions_for_review` (it ran fine once
  the blocker was cleared).

## What was done locally (local DB only, not production)

1. Inserted `2026_11_22_000005_add_accountability_type_to_asset_user_table` into the
   local `migrations` table (batch 27) so Laravel treats it as already run.
2. Ran `php artisan migrate`; `2026_11_23_000001` applied successfully.
3. `php artisan migrate:status` now shows 0 pending locally.

No live data, live database or server files were touched.

## Most likely cause (unconfirmed)

The column was added to the live DB outside the normal deploy path (manually, or by
an earlier run of this migration under a different filename or branch), so the live
`migrations` table may not record it. I cannot see the live server, so this needs
checking.

## Suggested checks on the live server (read-only)

```sql
SHOW COLUMNS FROM asset_user LIKE 'accountability_type';
SELECT * FROM migrations WHERE migration LIKE '2026_11_22%' OR migration LIKE '2026_11_23%';
```

- Column present and migration row missing: the next deploy will fail.
- Column absent: the live DB differs from the backup, and the backup copy is not
  representative of this table.

## Suggested fix (for the lead developers to decide)

Per the turnover guide, structural changes should go through migrations, not manual
edits to the live DB. Making the migration safe to re-run avoids touching live data:

```php
public function up(): void
{
    if (Schema::hasColumn('asset_user', 'accountability_type')) {
        return;
    }

    Schema::table('asset_user', function (Blueprint $table) {
        $table->string('accountability_type', 20)->default('personal')->after('user_id');
    });
}
```

`down()` could get the matching `hasColumn` check. Any similar migration in this
branch that adds columns or tables may need the same guard.

## Other things noticed during setup (not part of this issue)

- `composer install` fails on PHP 8.5.13 with the committed `composer.lock`:
  `phpoffice/phpspreadsheet 1.30.4` requires PHP `<8.5.0` (used by
  `maatwebsite/excel`). Local install used `--ignore-platform-req=php`. The turnover
  guide specifies PHP 8.5.3, so it is worth confirming which PHP version the server
  and the lock file target, and testing Excel import/export on 8.5.
- `vite.config.js` had a hardcoded `hmr.host` LAN IP. Already fixed upstream in
  `2d8b817`.
- The repo has no `.env.example`, so the guide's "copy .env.example .env" step cannot
  be followed. A local `.env` was written from the guide's example values.
