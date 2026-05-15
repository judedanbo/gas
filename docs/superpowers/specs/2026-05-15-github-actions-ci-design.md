# GitHub Actions CI — Lint, Typecheck, Test & Build

## Problem

The repo has no CI. Quality checks (typecheck, lint, test, build) run only locally via pre-commit hooks and manual invocation. Broken code can reach `main` if a contributor skips hooks or forgets a check.

## Decision

Add a single GitHub Actions workflow that runs the full quality gate on every push to `main` and every PR targeting `main`.

## Trigger Events

- **`push`** to `main` — catches direct pushes and completed merges.
- **`pull_request`** targeting `main` — validates PRs before merge.

## Workflow: `.github/workflows/ci.yml`

### Job: `quality-gate`

Runs on `ubuntu-latest`. All steps use `working-directory: ghana-audit-service/` since the app lives in a subdirectory.

| Step | Command | Purpose |
|------|---------|---------|
| 1. Checkout | `actions/checkout@v4` | Get the code |
| 2. Setup Node | `actions/setup-node@v4` with `node-version-file: '.nvmrc'`, `cache: 'npm'` | Pin Node 24, cache `~/.npm` |
| 3. Install | `npm ci` | Deterministic install from lockfile |
| 4. Typecheck | `npm run typecheck` | `vue-tsc --noEmit` — catches type errors first (fast, cheap) |
| 5. Lint | `npm run lint` | ESLint — catches style and correctness issues |
| 6. Test | `npm run test:run` | Vitest single run — validates logic |
| 7. Build | `npm run build` | Nuxt production build — ensures the app compiles |

Steps are ordered cheapest-to-most-expensive so the job fails fast.

### Caching strategy

`actions/setup-node@v4` with `cache: 'npm'` caches `~/.npm` keyed on the hash of `ghana-audit-service/package-lock.json`. This is simpler and more reliable than manually managing `actions/cache`. `npm ci` still runs every time (it must, to ensure deterministic `node_modules`), but downloads are served from cache.

The `cache-dependency-path` must be set to `ghana-audit-service/package-lock.json` since the lockfile is in a subdirectory, not at the repo root.

## New Files

| File | Content | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | Workflow YAML (see above) | CI automation |
| `.nvmrc` | `24` | Pin Node version for CI and local dev |

## Concurrency

Add a `concurrency` group keyed on `ci-${{ github.ref }}` with `cancel-in-progress: true` for PRs. This cancels stale CI runs when a PR is updated, saving CI minutes. Push events to `main` should not be cancelled.

## Not in Scope

These are future work, not part of this initial CI setup:

- E2E tests (Playwright — needs a running server and database)
- Deploy triggers
- GitHub branch protection rules (manual GitHub settings)
- Code coverage reporting
- Artifact uploads
- Notification integrations
