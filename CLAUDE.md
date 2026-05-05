# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This repo is a small monorepo wrapping a single application with its infrastructure:

- `ghana-audit-service/` — the Nuxt 3 app (frontend + Nitro server + Drizzle/MySQL data layer + admin panel). Has its own `CLAUDE.md` with app-specific guidance — **read it when working inside that directory**.
- `docker-compose.yml` — root-level orchestration: builds the frontend image and runs MySQL 8 alongside it on the `gas-network` bridge.
- `init-db/01-init.sql` — MySQL bootstrap (currently mounted via the commented-out volume in `docker-compose.yml`; uncomment to use).
- `.env.example` — root-level env vars consumed by `docker-compose.yml` (DB creds, public site config, JWT secret, optional Sentry DSN). The app has a separate `ghana-audit-service/.env.example` for local non-Docker dev.
- `PLAN.md`, `component-reusability-plan.md` — historical planning docs, not authoritative; treat the code as the source of truth.

## Common Commands

### Running the full stack via Docker
```bash
docker compose up --build      # frontend on :3000, MySQL on :3306
docker compose down            # stop; add -v to also wipe the mysql-data volume
```
Frontend healthcheck hits `http://localhost:3000/`; MySQL healthcheck uses `mysqladmin ping`.

### Running the app locally (most day-to-day work)
All app commands run from `ghana-audit-service/`. See that directory's `CLAUDE.md` for the full list. The most common:
```bash
cd ghana-audit-service
npm run dev                    # http://localhost:3000
npm run typecheck              # vue-tsc --noEmit
npm run lint                   # ESLint
npm run test:run               # Vitest (single run)
npm run test -- path/to/x.test.ts   # single test file in watch mode
npm run test:e2e               # Playwright e2e
npm run db:generate            # drizzle-kit: emit SQL migrations from schema
npm run db:migrate             # drizzle-kit push (applies schema to DB)
npm run db:studio              # Drizzle Studio UI
npm run db:seed                # seeds via tsx + .env
```

The app expects a reachable MySQL. Easiest path: `docker compose up mysql -d` from the repo root, then `npm run dev` inside `ghana-audit-service/`.

## Architecture (cross-cutting)

### Two env-var surfaces
There are two `.env` files and they are **not** interchangeable:
- Root `.env` — read by `docker-compose.yml` to template container env. Variables here flow into the frontend container as `DB_*`, `NUXT_PUBLIC_*`, `JWT_SECRET`, etc.
- `ghana-audit-service/.env` — read directly by Nuxt/Nitro and `drizzle-kit` when running outside Docker. `drizzle.config.ts` and `server/database/index.ts` both fall back to `localhost:3306` / `root` if unset.

When changing DB connectivity or JWT, update the relevant file (or both, if you run in both modes).

### Data layer
- ORM: **Drizzle** targeting **MySQL 2** (`drizzle-orm/mysql2`). Schema lives in `ghana-audit-service/server/database/schema/` split by domain (`audit-reports`, `news`, `media`, `careers`, `events`, `publications`, `regional-offices`, `tenders`, `users`, `organization`). The aggregated export is `schema/index.ts`.
- Connection: singleton pool in `server/database/index.ts` (`getDatabase()` / `getPool()` / `closeDatabase()`).
- Migrations: `drizzle-kit generate` writes to `server/database/migrations/`; `drizzle-kit push` applies. `drizzle.config.ts` is the source of truth for credentials during migration commands.
- Despite `better-sqlite3` being in dependencies, the live config is MySQL — don't get misled by stale references in older docs.

### API surface
Nitro routes under `ghana-audit-service/server/api/`:
- **Public** routes (e.g. `news`, `publications`, `reports`, `vacancies`, `gallery`, `events`, `tenders`, `regional-offices`, `management-team`, `videos`, `search`, `contact.post`, `newsletter.post`, `csrf.get`) — open, no auth.
- **Admin** routes under `server/api/admin/**` — gated by `server/middleware/adminAuth.ts`, which requires a `Bearer` JWT (verified via `server/utils/jwt.ts`) and looks up the user in `schema.users` to confirm they are still active and not soft-deleted (`isActive=true AND deletedAt IS NULL`). The authenticated user is attached to `event.context.auth`. Only `/api/admin/auth/login` is exempt.
- DTO shaping happens in `server/utils/transform*.ts` files — keep DB rows out of API responses; route handlers should return transformed objects.

### Frontend conventions (summary — see inner CLAUDE.md for details)
- Nuxt 3 + `<script setup lang="ts">`, auto-imported components prefixed by their folder (`<UiBaseCard />`, `<CommonAppHeader />`, `<AdminLayout... />`).
- Composables in `composables/` are the data-fetching layer (e.g., `useReports`, `usePublications`, `useAdminApi`, `useAdminAuth`, `useAdminCrud`).
- i18n via `@nuxtjs/i18n` with `prefix_except_default` (English at `/`, Akan at `/ak/`). When adding user-facing copy, update **both** `i18n/locales/en.json` and `i18n/locales/ak.json`.
- Tailwind theme uses Ghana flag colors (`primary`/`ghana-green` `#006B3F`, `secondary`/`ghana-red` `#CE1126`, `accent`/`ghana-gold` `#FCD116`).

### Pre-commit
The app uses Husky + lint-staged (`*.{js,ts,vue}` → eslint --fix + prettier; `*.{json,css,md,yml,yaml}` → prettier). Don't bypass hooks unless explicitly asked.

## Conventions from CONTRIBUTING.md

- Branch prefixes: `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`.
- Conventional commit format: `<type>(<scope>): <description>`.
- Before opening a PR: `npm run test:run`, `npm run lint`, `npm run format:check`, `npm run typecheck` (all from `ghana-audit-service/`).
- Accessibility target is **WCAG 2.1 AA** — this is a government site; semantic HTML, ARIA, keyboard nav, and contrast are non-negotiable on UI changes.
