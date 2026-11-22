# Project Brave — Development Handoff

**Last updated:** 13 November 2026  
**Purpose:** Carry the Project Brave context, decisions, current implementation state, and development rules into the VS Code workspace.

---

## 1. Current project direction

### Important change (13 November 2026)

The original plan included a standalone native Android application. That direction has been cancelled.

**Current direction:** Integrate Project Brave's asset-management features directly into the existing, operational TCC Purrtal Asset Management website, specifically inside its Asset Management module.

Do not build a separate Android application unless the project owner explicitly changes this decision again.

The existing website must be preserved. This is an enhancement/integration project, not a rebuild.

### Immediate next steps

1. Obtain/confirm the GitHub URL for the existing TCC Purrtal website repository.
2. Clone it into a new local folder. Do not clone over or overwrite the existing backend folder.
3. Inspect the clone's Git status, current branch, framework, folder structure, database configuration, and existing Asset Management module.
4. Create a dedicated branch named `project-brave` (or another agreed name if that branch already exists).
5. Review existing asset-management functionality before deciding which new features or backend changes are reusable.
6. Keep the original branch and production environment untouched until changes are reviewed and approved.

**Repository URL:** Not yet provided.  
**Local clone path:** Not yet decided.  
**Current production stack/schema:** Must be inspected in the repository; do not assume it matches the separate development backend described below.

---

## 2. Project scope and known requirements

- Project name: **Project Brave**
- Organization/system context: The Cat Clinic (TCC), existing Purrtal Asset Management website.
- Initial rollout branch: **Greenhills**.
- Future branches: **Makati** and **Alabang**.
- Branch codes:
  - Greenhills: `GH`
  - Makati: `MKT`
  - Alabang: `ALB`
- One database record per physical asset; quantity is expected to be 1 for each physical asset.
- Asset tag is distinct from serial number.
- Asset tags should follow the branch-based convention already discussed, e.g. `GH-00034`.
- Excel workbooks are separate per branch.
- Excel import/export work must use a separate copy and preserve the original workbook.
- Verify the existing TCC Purrtal depreciation formula before implementing or changing depreciation logic. Do not assume straight-line depreciation.
- One primary photo per asset is planned, with optional additional photos later.
- Photo naming convention discussed: asset tag, e.g. `GH-00034.jpg`.
- Photo capture date is separate from the current development scope/timeline.
- Company OneDrive is the intended photo storage. If integration is needed, use Microsoft Graph through the server/backend; do not put Microsoft credentials or secrets in browser code.
- Official company database must not be connected to or modified until separately authorized.
- Development should use an independent database/environment first.

### Known asset fields discussed

- `branch_id`
- `asset_tag`
- `name`
- `category`
- `model_number`
- `serial_number`
- `color`
- `department`
- `assigned_personnel`
- `area`
- `acquired_at`
- `supplier`
- `warranty_expiration`
- `condition`
- `status`
- `asset_classification`
- `unit_value`
- `quantity`
- `total_value`
- `depreciation_months`
- `accumulated_depreciation`
- `current_book_value`
- `photo_info_link`

These are fields in the separate Laravel prototype backend, not yet confirmed against the existing website repository. Reconcile them with the website's actual schema before integration.

---

## 3. Existing website and repository status

The existing TCC Purrtal Asset Management website is operational. The intent is to add Project Brave functionality inside its Asset Management module and polish existing functionality as appropriate.

The repository URL has not yet been supplied in the conversation. Do not guess it.

Before editing:
- Inspect the repository README and project manifests.
- Identify the actual framework and runtime versions.
- Inspect routes, controllers, models, migrations/schema, authentication, authorization, and frontend structure.
- Identify how the current asset module works.
- Identify existing audit/history functionality before creating another implementation.
- Check `git status` before making changes.
- Never overwrite production configuration or credentials with local development settings.

---

## 4. Separate Laravel prototype backend already developed

A separate Laravel backend was created during the earlier standalone-app plan.

**Local path:** `C:\Users\Jamiero\backend`  
**Framework:** Laravel 13.42.0  
**PHP:** 8.5.12  
**Database:** MySQL, database name `project_brave`  
**Local database environment:** XAMPP MySQL, port 3306  
**Local Laravel URL when serving:** `http://127.0.0.1:8000`  
**phpMyAdmin:** `http://localhost/phpmyadmin/`

This is an independent development prototype. It is not confirmed to be the same codebase as the existing Purrtal website. Do not merge it or connect it to the official database until its reuse is assessed.

### Existing local environment details

- Windows PowerShell.
- VS Code is the preferred editor.
- Use `code <path>` to open files. **Do not instruct the user to use Notepad.**
- PHP 8.5.12 at `C:\php\php.exe`.
- Composer 2.11.1.
- Node v24.13.0 / npm 11.6.2.
- XAMPP Apache and MySQL.
- Laravel 13.42.0.
- Sanctum package discovered successfully.

Local `.env` database settings previously used:
```dotenv
APP_NAME="Project Brave"
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=project_brave
DB_USERNAME=root
DB_PASSWORD=
```
Never ask the user to paste passwords, API tokens, or secrets into chat.

### Existing prototype database

Tables and records previously confirmed:
- `branches` table with:
  - ID 1 — Greenhills — `GH`
  - ID 2 — Makati — `MKT`
  - ID 3 — Alabang — `ALB`
- `assets` table with the asset fields listed above.
- `users` table; one user existed at last check.
- `personal_access_tokens` table for Sanctum.
- `asset_histories` table was just created.

Do not assume the current row counts without checking.

**Migration safety:** Never use `php artisan migrate:fresh`, `migrate:refresh`, or destructive database commands. Do not drop existing tables or data.

---

## 5. Laravel prototype API already implemented

The separate prototype has Sanctum authentication and these routes:

| Method | Route | Controller |
|---|---|---|
| POST | `/api/login` | `AuthController@login` |
| POST | `/api/logout` | `AuthController@logout` |
| GET | `/api/me` | `AuthController@me` |
| GET | `/api/branches` | `BranchController@index` |
| GET | `/api/branches/{id}` | `BranchController@show` |
| GET | `/api/assets` | `AssetController@index` |
| POST | `/api/assets` | `AssetController@store` |
| GET | `/api/assets/{id}` | `AssetController@show` |
| PUT/PATCH | `/api/assets/{id}` | `AssetController@update` |
| GET | `/api/assets/{id}/history` | `AssetHistoryController@assetHistory` |
| GET | `/api/asset-histories` | `AssetHistoryController@index` |

All routes other than login are inside `auth:sanctum` middleware (the `/api/user` route is also protected).

Previously verified API operations:
- Login and token generation.
- Authenticated `/api/me`.
- Branch list and branch detail.
- Asset listing, filtering, search, pagination.
- Asset registration, retrieval, and update.
- Temporary test asset was deleted.
- An earlier exposed token was revoked; do not reuse it.

The prototype API has not yet been fully tested after adding audit logging.

---

## 6. Asset history and audit-log implementation status in the prototype

The user chose asset history and audit logs as the next backend feature before changing project direction.

### Completed in `C:\Users\Jamiero\backend`

1. Created migration:
   `database/migrations/2026_11_11_054425_create_asset_histories_table.php`
2. Ran the migration successfully. Laravel reported `DONE`.
3. Created `app/Models/AssetHistory.php`.
4. Added a `histories()` relationship to `app/Models/Asset.php`.
5. Created `app/Observers/AssetObserver.php`.
6. Registered the observer in `app/Providers/AppServiceProvider.php`.
7. Created `app/Http/Controllers/Api/AssetHistoryController.php`.
8. Registered the two history routes in `routes/api.php`.
9. `php artisan route:list --path=api` showed both new history routes.
10. PHP syntax checks passed for the files checked.

### Prototype `asset_histories` schema

The migration created:
- `id`
- nullable unsigned bigint `asset_id` (no foreign key)
- nullable unsigned bigint `user_id` (no foreign key)
- `action` varchar(50)
- nullable `asset_tag`
- `asset_name`
- nullable JSON `old_values`
- nullable JSON `new_values`
- timestamps
- indexes on `asset_id`, `user_id`, and `action`

No foreign keys were intentionally used, so logs survive permanent deletion of the related asset or user. This is a prototype design decision; reconsider it after inspecting the existing website's schema and retention requirements.

### Prototype `AssetHistory` model

It has fillable fields:
- `asset_id`, `user_id`, `action`, `asset_tag`, `asset_name`, `old_values`, `new_values`

Casts:
- `old_values` => `array`
- `new_values` => `array`

Relationships:
- `asset()` belongs to `Asset`
- `user()` belongs to `User`

### Prototype `Asset` relationship

`histories(): HasMany` returns:
```php
return $this->hasMany(AssetHistory::class)->latest();
```
The `Asset` model imports both `BelongsTo` and `HasMany`.

### Prototype observer registration

`app/Providers/AppServiceProvider.php` currently contains:
```php
use App\Models\Asset;
use App\Observers\AssetObserver;
```
and:
```php
public function boot(): void
{
    Asset::observe(AssetObserver::class);
}
```
User confirmed this file content is correct.

### Important: audit observer still needs functional verification

The observer currently intends to log:
- `created`: full asset business-field snapshot into `new_values`
- `updated`: changed fields in `new_values`, previous values in `old_values`
- `deleted`: full asset snapshot in `old_values`

It uses `Auth::id()` for actor identification.

**Do not assume audit logging works just because syntax checks passed.** Before reusing the implementation:
- Inspect the actual `AssetObserver.php`.
- Verify that old values are captured correctly during Laravel's `updated` event. The current approach uses `getChanges()` and `getOriginal()` and needs a real test against the installed Laravel version.
- Confirm actor attribution under authenticated HTTP requests.
- Confirm that history records are retained after asset deletion.
- Consider database transactions so asset changes and audit records succeed/fail together.
- Consider whether bulk query updates/deletes bypass Eloquent model events.
- Consider immutable audit-log permissions and authorization policies.
- Consider logging branch snapshots or transfer details if needed.
- Ensure sensitive fields are excluded from audit records.

The history API controller:
- `assetHistory(Request $request, string $id)` loads an asset and paginates its histories with user details.
- `index(Request $request)` returns global audit logs, optionally filtered by `action` (`created`, `updated`, `deleted`), paginated.
These routes are protected by Sanctum in the prototype.

**No end-to-end audit workflow test has yet been confirmed.** The user had just been asked to verify observer registration, then changed project direction.

---

## 7. Known prototype file locations

- `app/Models/Branch.php`
- `app/Models/Asset.php`
- `app/Models/AssetHistory.php`
- `app/Models/User.php`
- `app/Observers/AssetObserver.php`
- `app/Providers/AppServiceProvider.php`
- `app/Http/Controllers/Api/AuthController.php`
- `app/Http/Controllers/Api/BranchController.php`
- `app/Http/Controllers/Api/AssetController.php`
- `app/Http/Controllers/Api/AssetHistoryController.php`
- `routes/api.php`
- `bootstrap/app.php`
- `database/migrations/2026_11_11_054425_create_asset_histories_table.php`

The `bootstrap/app.php` API handling was adjusted so unauthenticated API requests return JSON `{"message":"Unauthenticated."}` rather than redirecting to an undefined login route. Preserve the existing behavior if the prototype is reused.

---

## 8. Project timeline and working arrangement

A previous planning discussion stated:
- Development start target: 15 November.
- Two IT interns start: 23 November.
- Target completion: 12 December.
- User is the project PM and primary implementer.
- The initial feasibility discussion considered website + Android app; the Android app has now been cancelled in favor of website integration.

Reassess the schedule and task breakdown based on the actual website repository and removal of the Android app. Do not assume previous estimates remain valid.

A weekly Project Brave check-in automation was already created:
- Mondays at 9:00 AM, Asia/Manila.
- Starting 16 November 2026.
- Do not create a duplicate.

---

## 9. Development guidance and collaboration preferences

The user prefers:
- Beginner-friendly, step-by-step guidance.
- One step at a time, with verification before moving forward.
- Exact PowerShell commands.
- Clear distinction between commands to type and expected output.
- VS Code for editing files (`code <path>`), never Notepad.
- Reusing information and outputs already supplied; do not repeatedly ask for the same files or command results.
- No assumptions that a step succeeded without verification.
- Explain what each command changes and whether it affects the database.
- Avoid destructive commands.
- Avoid asking for secrets or tokens.

When guiding work:
1. Explain the goal of the step.
2. Give the exact command.
3. State expected output separately.
4. Ask for the result before moving to the next step when verification is useful.
5. Preserve the current code and data; prefer small, reviewable changes.
6. Check `git status` before edits and review diffs before commits.
7. Never commit `.env`, credentials, access tokens, or production secrets.

---

## 10. Immediate next action for the VS Code AI assistant

The user asked whether all prior Project Brave discussion can be transferred into VS Code. This document is the handoff context.

Continue by asking for the **existing TCC Purrtal website GitHub repository URL**. Then guide the user to clone it into a new folder and create the `project-brave` branch.

Do not start implementing new code in the existing website until its repository, framework, database schema, asset module, and Git working tree have been inspected.

Keep `C:\Users\Jamiero\backend` as a separate prototype for reference until a deliberate reuse/porting decision is made.
