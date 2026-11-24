---
name: project-brave-development
description: Understand and safely change Project Brave in the TCC Purrtal repository. Use for asset management, accountability, and general project work.
---

# Project Brave development

## Inspect before changing

- This repository is the existing TCC Purrtal application with Project Brave asset accountability features integrated into it. Preserve the existing website and its workflows.
- Confirm `git status --short --branch`, read relevant `AGENTS.md` files, and inspect the route, controller, model, service, view, migration, and tests involved before editing.
- Do not assume details from the older standalone prototype apply to the live application. The Laravel app's current schema and code are authoritative.
- Do not connect to or modify the production database. Do not run migrations unless the task explicitly requires them and the target environment is known.

## Actual stack

- Backend: PHP 8.2+, Laravel 12, Eloquent, Laravel routes and controllers.
- Frontend: React 18/19, Inertia.js 2, Vite 7, Tailwind CSS.
- Database: Laravel-configured PDO database; inspect `.env` locally without exposing credentials. Do not infer the configured engine from the schema alone.
- Tests: Pest 4 / PHPUnit. `composer test` clears configuration then runs `php artisan test`; use focused tests first.
- Dependencies: Composer (`composer.json` / `composer.lock`) and npm (`package.json` / lockfile). Avoid introducing runtime packages without need.

## Useful locations

- `app/Models`: Eloquent models and relationships (`Asset`, `User`, `Branch`).
- `app/Http/Controllers`: request handling; `Staff/MyAssetController` supplies the signed-in user's accountability download.
- `app/Services`: reusable service logic; `AccountabilityPdfService` generates the staff accountability PDF.
- `routes/web.php`: web endpoints and middleware.
- `database/migrations`: schema history. Never rewrite history or add a migration for a presentation-only change.
- `resources/js`: React/Inertia pages and components; `resources/js/Assets/tcc_logo.png` is the clinic logo.
- `resources/views`: Blade views, including exports.
- `tests/Feature` and `tests/Unit`: automated checks.
- `public/build`: generated frontend output; do not edit hashed build artifacts by hand.
- `.agents/skills`: repository-specific Codex skills.

## Asset accountability data flow

The staff route is named `staff.assets.accountability-pdf`. `App\\Http\\Controllers\\Staff\\MyAssetController` loads the authenticated user's assets and department/branches, separates personal/shared accountability using the pivot/accountability type, and calls `App\\Services\\AccountabilityPdfService`. Preserve this authorization and assignment logic when changing document presentation. Asset tags and serial/model numbers are distinct fields.

## Conventions and safety

- Follow nearby Laravel conventions, use Eloquent relationships, validate input at request boundaries, and preserve authorization middleware/policies.
- Avoid changing asset assignment rules, authentication, database shape, or production data while implementing a document/UI improvement.
- Do not commit, push, deploy, or contact external people unless explicitly asked.
- Keep user and asset-specific values in the data flow, never hardcode them into reusable templates.

## Run locally

- Dependencies present: `composer install` and `npm install` (run only when necessary).
- App stack: `composer dev` (Laravel server, queue listener, Vite).
- Frontend build: `npm run build`.
- Tests: `php artisan test` or `composer test`; for style use `vendor/bin/pint --test`.
- Local server setup depends on `.env`, database availability, and migrations. Never run a migration against an unknown or production DB.

For PDF work, also read `professional-pdf-generation`. For broad change validation, read `testing-quality-assurance`.
