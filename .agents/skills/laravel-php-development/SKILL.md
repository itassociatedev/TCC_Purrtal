---
name: laravel-php-development
description: Implement and review backend changes in this Laravel 12 / PHP application, including routes, Eloquent, validation, security, and tests.
---

# Laravel and PHP development in TCC Purrtal

This project uses Laravel 12 and PHP 8.2+ (see `composer.json`). Read `project-brave-development` for repository-specific architecture and safety rules.

## Laravel conventions

- Keep HTTP concerns in `app/Http/Controllers`, reusable application logic in `app/Services`, persistence in Eloquent models, and routes in `routes/`.
- Use form requests or explicit Laravel validation at boundaries. Return normal Laravel responses and use framework error handling rather than leaking exceptions or secrets.
- Prefer Eloquent relationships and eager loading when retrieving related data. Check nullable relationships and missing optional data.
- Put schema changes in a new migration only when required; migrations are durable history. Do not run destructive or production migrations without explicit authorization.
- Keep route middleware, policies, and authorization checks intact. Never rely on hiding a UI action as authorization.

## Data safety

- Use database transactions when a logical operation updates multiple related records.
- Preserve pivot metadata and existing assignment rules when modifying many-to-many asset accountability.
- Do not place passwords, tokens, database credentials, or Microsoft Graph secrets in source, logs, or client code.
- For uploads, validate size and content type, generate safe server-side names, use Laravel storage disks, and avoid trusting user paths.
- Avoid raw SQL unless needed; bind values if raw SQL is used.

## API and errors

- Keep response shape and status codes consistent with neighboring endpoints.
- Validate and normalize request data; handle missing records with framework 404 behavior.
- Log useful operational context without logging secrets or unnecessary personal information.

## Tests and debugging

- Read the relevant feature/unit tests before changing behavior. Use factories and isolated test configuration.
- Run a focused `php artisan test --filter=...` or the relevant test file, followed by broader checks when appropriate.
- Use `php artisan route:list` for route inspection and `vendor/bin/pint --test` for formatting.
- Never run `migrate` against an unknown database. Inspect `.env` privately and confirm the environment before database operations.
