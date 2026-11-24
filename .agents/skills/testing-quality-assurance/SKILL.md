---
name: testing-quality-assurance
description: Validate TCC Purrtal changes with focused tests, regression checks, and truthful reporting of coverage and limitations.
---

# Testing and quality assurance

Read `project-brave-development` for local commands and safety constraints. Tests and checks are appropriate when requested or necessary to establish that an implementation works.

## Test selection

- Inspect existing tests and choose the narrowest relevant test first. Prefer Pest feature tests for route/data-flow behavior and unit tests for isolated service logic.
- For PHP changes, run `php -l` on edited files and focused `php artisan test --filter=...` or test paths. Run the full suite only when useful and the local environment supports it.
- For React/Vite changes, run the relevant build (`npm run build`) and existing lint/type checks if configured.
- Use `vendor/bin/pint --test` for Laravel formatting when relevant.

## Regression and edge cases

- Check changed behavior plus neighboring paths: authorization, empty/missing data, long or malformed input, failure responses, and repeated calls.
- For generated documents, validate text/data and page structure, then render and inspect all pages visually. A successful file download alone is not sufficient.
- Never use or mutate a production database to test. Do not run migrations on an unknown environment.

## Report clearly

- State each command/check and whether it passed, failed, or could not run.
- Separate automated test results from manual visual inspection.
- Note relevant coverage gaps and why they remain. Do not imply checks were run if they were not.
