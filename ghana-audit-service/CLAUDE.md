# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ghana Audit Service official website — Nuxt 3 (Vue 3 + TypeScript strict) public site with a built-in authenticated **admin panel**. Data is served from MySQL via Drizzle ORM through Nitro server routes. The site is bilingual (English / Akan), PWA-enabled, and aims for WCAG 2.1 AA.

The repo root (`..`) holds `docker-compose.yml` (frontend + MySQL) and another `CLAUDE.md` describing the monorepo. Read that file when work crosses container/infra boundaries.

## Common Commands

```bash
# Dev / build
npm run dev          # http://localhost:3000
npm run build        # production build (runs vue-tsc in production mode)
npm run generate     # static generation (note: admin routes are excluded)
npm run preview      # serve the production build

# Quality gates (run all four before opening a PR)
npm run lint         # ESLint
npm run lint:fix
npm run format:check # Prettier
npm run typecheck    # vue-tsc --noEmit (dev typecheck is disabled in nuxt.config.ts)

# Tests
npm run test                          # Vitest, watch mode
npm run test:run                      # Vitest, single run
npm run test -- tests/unit/foo.test.ts   # single test file (watch)
npm run test:run tests/unit/foo.test.ts  # single test file (one-shot)
npm run test:coverage                 # v8 coverage
npm run test:e2e                      # Playwright
npm run test:e2e:ui                   # Playwright UI runner

# Database (Drizzle / MySQL — needs DB env vars or .env)
npm run db:generate                # emit SQL migrations from schema/
npm run db:migrate                 # drizzle-kit push (apply schema)
npm run db:studio                  # Drizzle Studio
npm run db:seed                    # full seed via tsx + .env
npm run db:seed:management-team    # targeted seed
```

Tests run with `happy-dom` and `@nuxt/test-utils`; layout under `tests/unit/`, `tests/integration/`, `tests/e2e/` with shared `tests/setup.ts`.

## Architecture

### Tech stack
- **Nuxt 3** + Vue 3 Composition API (`<script setup lang="ts">` everywhere), strict TypeScript.
- **Nitro** server (`server/`) for API routes and middleware.
- **Drizzle ORM** + **mysql2** pool against **MySQL 8** (despite `better-sqlite3` lingering in `package.json`, the live config is MySQL — see `drizzle.config.ts` and `server/database/index.ts`).
- **Tailwind** with custom Ghana flag palette; `@nuxtjs/color-mode` for system-aware dark mode.
- **@nuxtjs/i18n** with `prefix_except_default` (English at `/`, Akan at `/ak/`).
- **PWA** via `@vite-pwa/nuxt` (autoUpdate, runtime caching for Google Fonts).
- **Auth**: JWT (`jsonwebtoken`) + `bcrypt` password hashing; CSRF on mutating public endpoints.
- **Validation**: `zod` and `validator`.

### Directory map
- `pages/` — file-based routing. `pages/admin/` holds the admin SPA-within-a-site; everything else is public.
- `layouts/` — `default.vue`, `minimal.vue` (and admin layouts under `components/admin/layout/`).
- `components/`
  - `ui/` — design-system primitives (`BaseButton`, `BaseCard`, `BaseModal`, `Badge`, `LoadingSpinner`, etc.) auto-imported as `<Ui*>`.
  - `common/` — site chrome (`AppHeader`, `AppFooter`, `AppNavigation`) auto-imported as `<Common*>`.
  - Feature folders: `home/`, `reports/`, `publications/`, `media/`, `careers/`, `search/`, `seo/`.
  - `admin/` — split into `form/`, `layout/`, `ui/`; auto-imported as `<Admin*>`.
- `composables/` — data + cross-cutting hooks: `useReports`, `usePublications`, `useSearch`, `useNewsletter`, `useFormValidation`, `useAccessibility`, `useLocaleDate`, `useCategoryBadge`, `useSchemaOrg`, plus the admin trio `useAdminAuth` / `useAdminApi` / `useAdminCrud`.
- `middleware/admin-auth.global.ts` — **client-side** route guard: redirects unauthenticated `/admin/**` traffic to `/admin/login` and bounces logged-in users away from the login page.
- `server/`
  - `api/` — Nitro endpoints. **Public** routes at the top level (`reports/`, `news/`, `publications/`, `vacancies/`, `events`, `gallery`, `tenders`, `regional-offices`, `management-team`, `videos`, `search`, `contact.post`, `newsletter.post`, `csrf.get`). **Admin** routes under `server/api/admin/**` (auth, users, audit-logs, content CRUD, uploads).
  - `middleware/adminAuth.ts` — **server-side** gate. Runs on every `/api/admin/**` request except `/api/admin/auth/login`. Verifies the `Bearer` JWT, looks the user up in `schema.users` filtered by `isActive = true AND deletedAt IS NULL`, and attaches `event.context.auth = { user, token }`. Handlers can rely on that context.
  - `middleware/rateLimit.ts` — paired with `server/utils/rateLimiter.ts`.
  - `database/` — `index.ts` (singleton pool + `getDatabase`/`getPool`/`closeDatabase`/`checkConnection`), `schema/` split by domain, `migrations/`, `seeds/`, `seed.ts`. `schema.old.ts` is legacy — don't add to it.
  - `utils/` — JWT, password hashing, CSRF, file upload, audit logging, validation, plus `transform*.ts` DTO shapers (one per domain). **API handlers should return transformed objects, not raw DB rows.**
  - `plugins/` — Nitro server plugins.
- `types/` — shared TS types: `index.ts` (domain), `admin.ts` (admin panel).
- `utils/` — client-side helpers (e.g. `iconMap.ts`).
- `i18n/locales/` — `en.json`, `ak.json`. **Both must be updated together** when adding user-facing copy.
- `assets/css/` — Tailwind entry and global styles.
- `public/` — static assets including PWA icons.

### Auth flow (two layers — keep them in sync)
1. **Server gate** (`server/middleware/adminAuth.ts`): every `/api/admin/**` request must carry a valid JWT for an active, non-deleted user. Handlers read `event.context.auth.user`.
2. **Client guard** (`middleware/admin-auth.global.ts` + `useAdminAuth`): protects `/admin/**` pages and steers redirects.

If you add a new admin endpoint, **don't bypass the server middleware** — it's pathname-driven (`/api/admin/`). New admin pages need only live under `pages/admin/`; the global middleware picks them up automatically.

### Nitro route rules (`nuxt.config.ts`)
- Public API responses are cached at the edge with stale-while-revalidate (5 min for `reports`/`news`/`publications`/`events`, longer for `team` and `regional-offices`). When you change a transform or response shape, remember consumers may receive stale data for up to ~10 min.
- `/api/admin/**` has `cache: false` — admin always sees fresh data.
- `/admin/**` and `/ak/admin/**` set `X-Robots-Tag: noindex, nofollow` and are excluded from prerender.
- Strict global security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy) are applied to every route — be deliberate if a feature needs to relax them.

### Component & composable conventions
- Auto-import prefix matches the folder: `components/common/AppHeader.vue` → `<CommonAppHeader />`, `components/ui/BaseCard.vue` → `<UiBaseCard />`, `components/admin/form/Input.vue` → `<AdminFormInput />`. Use the prefixed name; don't add manual imports.
- Props/emits are typed with `defineProps<T>()` / `defineEmits<T>()`.
- Data fetching lives in composables that return reactive state (`{ items, loading, error, fetch* }`). Page components should call composables, not `$fetch` directly, so caching/error UX stays consistent.
- `useAdminCrud` is the generic CRUD hook for admin list/detail/edit pages — prefer extending it over hand-rolling per-entity hooks.

### Styling
Tailwind config (`tailwind.config.ts`) defines:
- `primary` / `ghana-green` `#006B3F`
- `secondary` / `ghana-red` `#CE1126`
- `accent` / `ghana-gold` `#FCD116`

Typography: Open Sans (body), Plus Jakarta Sans (headings) via `@nuxtjs/google-fonts` variable fonts. Dark mode is class-based with no suffix (`classSuffix: ''`).

### i18n
- `defaultLocale: 'en'`, strategy `prefix_except_default`. English routes have no prefix; Akan routes are under `/ak/`.
- Use `$t('key')` in templates or `useI18n()` in script.
- **Always update both `i18n/locales/en.json` and `i18n/locales/ak.json` together** — missing Akan keys fall back to keys, not English copy.

### Environment
Local dev reads `ghana-audit-service/.env` (see `.env.example`). When running via root `docker-compose.yml`, the container env is templated from the root `.env` — they're separate files.

Required for the server to function:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (defaults to `localhost:3306` / `root` / `ghana_audit_service` if unset — fine for local Docker, dangerous in prod).
- `JWT_SECRET` (admin auth will be unsafe with the placeholder).
- `NUXT_API_SECRET` and the `NUXT_PUBLIC_*` vars for site identity.

### Pre-commit
Husky + lint-staged: `*.{js,ts,vue}` → `eslint --fix` + `prettier --write`; `*.{json,css,md,yml,yaml}` → `prettier --write`. Don't `--no-verify` unless explicitly asked.

## Conventions worth remembering

- **Branch prefixes** (from `CONTRIBUTING.md`): `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`. **Commit format**: `<type>(<scope>): <description>` (conventional commits).
- **Pre-PR gate**: `npm run test:run && npm run lint && npm run format:check && npm run typecheck` — all four must pass.
- **Accessibility is a hard requirement** (WCAG 2.1 AA). Government site — semantic HTML, ARIA labels, keyboard nav, color contrast.
- **Don't return raw DB rows** from API routes; pipe them through `server/utils/transform*.ts`.
- The legacy `IMPLEMENTATION_PLAN.md`, `IMPROVEMENTS.md`, `NEW_FEATURES.md` files are **historical** — code is the source of truth.
