# Admin Portal — Full Visual & Functional QA Audit

**Date:** 2026-06-17
**Branch:** `test/admin-portal-qa-audit`
**Build tested:** local dev (`npm run dev`, Nuxt 3.21.8) against Docker MySQL with the existing seeded dataset (206 reports, 95 news, 30 events, 24 gallery albums, etc.)
**Method:** Playwright-driven browser walkthrough of every `/admin/*` route at desktop (1440×900) and mobile (390×844), exercising real CRUD flows, capturing console errors and failed network requests, and reading the rendered UI. Throwaway records created during testing were soft-deleted afterward.
**Login used:** `admin@audit.gov.gh` (role `admin`, all modules) — so every nav section was visible.

> Scope note: this is an **audit only** — no application source was modified. Findings are grouped by priority. Each item lists where it reproduces and the evidence (screenshot / console / network / DB).

---

## Summary

| Priority | Count | Items |
|---|---|---|
| **P0 — Blocker** | 0 | — none found; auth, routing, and every page loaded without a crash |
| **P1 — High** | 2 | Mobile admin navigation is completely inaccessible; News create returns HTTP 500 when "Excerpt" is empty |
| **P2 — Medium** | 2 | Slug-uniqueness check fails with 401 (no auth header) on all content forms; mobile hamburger button has no accessible name |
| **P3 — Low / cosmetic** | 4 | Oversized "Role Permissions" heading; TipTap duplicate-extension warning; report-count mismatch (205 vs 206); Geo chart unlabeled bar |
| **Informational** | 2 | Reports with "0 B" file size (seed data); transient blank page on first create-form load (dev-only) |

**Overall:** the portal is in good shape. Login, the dashboard, all 20+ list pages, search/filters/pagination, the full News create→edit→soft-delete cycle, client-side validation on most forms, all 7 analytics dashboards (with graceful GeoIP degradation), and the logged-out auth guard all work correctly. The two P1 issues are the priorities: one blocks all mobile admin use, the other turns a missing optional-looking field into a server error.

---

## P1 — High

### P1-1. Admin navigation is completely inaccessible on mobile / narrow viewports
- **Where:** every `/admin/*` page below the Tailwind `lg` breakpoint (<1024px). Reproduced at 390px.
- **What happens:** the sidebar `<aside>` is rendered with the static classes `... hidden lg:block`. The header hamburger button (`button.lg:hidden`) toggles an open/close state, but nothing binds that state to the aside's visibility, so the aside stays `display:none` no matter how many times the button is pressed. There is no separate mobile drawer/overlay. Result: on a phone or tablet an admin can only ever see the single page they navigated to directly — they cannot move between Dashboard, Reports, News, Analytics, etc.
- **Evidence:** `screenshots/35-mobile-sidebar-open.png` (hamburger pressed, no drawer). DOM probe: `aside` resolves to `display:none`, `width:0` after toggling; the 41 admin nav links live inside that hidden aside. Aside classList: `fixed top-0 left-0 z-50 h-screen … w-16 hidden lg:block`.
- **Why it matters:** this is a government site with an explicit responsive/WCAG target; the admin portal is effectively desktop-only today.
- **Likely fix direction:** bind the aside's visibility/transform to the mobile-open state (e.g. `:class` driven by the toggle) instead of relying solely on the `lg:` breakpoint, and add the backdrop/overlay the layout appears to intend.

### P1-2. Creating a News article returns HTTP 500 when "Excerpt" is left empty
- **Where:** `/admin/news/create`.
- **What happens:** the **Excerpt** field is not marked required (no asterisk) and has no client-side validation, but the `news_articles.excerpt` column is `NOT NULL`. Submitting the form with Title + Content but no Excerpt produces `POST /api/admin/news → 500`, and the user sees a generic red banner "Something went wrong. Please try again." with no indication that Excerpt is the cause. Filling Excerpt in and resubmitting succeeds.
- **Evidence:** `screenshots/07-news-list.png` (form), 500 response body (`"message":"Something went wrong. Please try again."`), and the dev server log: **`[admin:news] Column 'excerpt' cannot be null`**.
- **Contrast:** the Events create form handles the same situation correctly — empty submit shows inline "This field is required" messages and never reaches the server. So this is a News-form inconsistency, not a global pattern.
- **Likely fix direction:** mark Excerpt required in the UI with client validation, **or** make the column nullable / default it server-side, **and** return a 400 with a field-level message instead of a 500 on the null case.

---

## P2 — Medium

### P2-1. Slug-uniqueness check returns 401 (Unauthorized) — request is sent without the auth header
- **Where:** content create/edit forms with a slug field. Confirmed on `/admin/news/create`; the same `check-slug` endpoint pattern is shared by Reports, Publications, and Gallery Albums.
- **What happens:** as you type a title, the form calls `GET /api/admin/news/check-slug?slug=…`, but the request carries **no `Authorization: Bearer` header**, so the admin-auth middleware rejects it with `401`. The failure is swallowed silently — no availability indicator (✓/✗) is ever shown, so the slug-uniqueness feature is effectively dead. (Creation still works because the server enforces uniqueness on insert; the user just gets no advance warning.)
- **Evidence:** console `Failed to load resource: 401 … /api/admin/news/check-slug?slug=qa-test-article-2026-delete-me`; captured request headers show no `authorization`; dev log: `[…/check-slug] Missing or invalid authorization`.
- **Likely fix direction:** route the check-slug fetch through the same authenticated client the CRUD calls use (e.g. `useAdminApi`) so the bearer token is attached.

### P2-2. Mobile hamburger menu button has no accessible name (WCAG)
- **Where:** admin header on mobile (`button.lg:hidden`).
- **What happens:** the menu toggle is an icon-only `<button>` with no `aria-label`/visible text, so screen-reader users get an unnamed button. (It's also the button that doesn't work — see P1-1.) WCAG 2.1 AA: controls need an accessible name.
- **Evidence:** Playwright role query surfaced it as an unnamed button; classList `lg:hidden p-2 rounded-lg …` with no label.
- **Likely fix direction:** add `aria-label="Open navigation menu"` (and toggle `aria-expanded`).

---

## P3 — Low / Cosmetic

### P3-1. "Role Permissions" heading renders oversized/unstyled on the Add User page
- **Where:** `/admin/users/create` (bottom card).
- **What:** the "Role Permissions" heading is rendered in very large, seemingly unstyled type that's out of scale with the rest of the form — looks like a missing text-size/utility class on that heading. Cosmetic but reads as "broken."
- **Evidence:** `screenshots/28-users-create.png`.

### P3-2. TipTap rich-text editor: "Duplicate extension names found: ['link']"
- **Where:** every form using the rich-text editor (Reports, News, Events, etc.).
- **What:** console warning on editor mount — the `link` extension is registered twice in the editor config. Harmless today but flagged by TipTap as able to "lead to issues."
- **Evidence:** console `[tiptap warn]: Duplicate extension names found: ['link']`.

### P3-3. Report count mismatch: UI shows 205, database has 206
- **Where:** Dashboard "Total Reports" card and `/admin/reports` header ("205 total / 205 published / 0 drafts").
- **What:** the DB has 206 rows in `audit_reports` but the portal counts 205. Likely one soft-deleted or untranslated row excluded from the count but present in the table — worth confirming the count query and the list query agree.
- **Evidence:** `screenshots/02-dashboard-desktop.png`, `screenshots/03-reports-list-desktop.png`; `SELECT COUNT(*) FROM audit_reports` = 206.

### P3-4. Geo analytics: "Top countries" bar chart shows a single unlabeled bar in the degraded state
- **Where:** `/admin/analytics/geo` when GeoIP (MMDB) isn't mounted (all visits resolve to `??Unknown`).
- **What:** the bar chart draws one large green bar with no x-axis category label. The page otherwise degrades cleanly ("GEO-RESOLVED 0% … MMDB not mounted", `??Unknown` in the table). Cosmetic.
- **Evidence:** `screenshots/24-analytics-geo.png`.

---

## Informational / data (not code bugs)

- **Reports with "0 B" file size.** Several published reports list a 0 B file (e.g. "…Accounts Of District Assemblies…2024", "Special Audit Report on recoveries…"). Almost certainly seed/crawl artifacts where the PDF wasn't attached — worth a content audit so the public site doesn't link to empty downloads. `screenshots/03-reports-list-desktop.png`.
- **Transient blank page on first load of a create form.** The very first hit to `/admin/reports/create` rendered blank with a failed `_nuxt/.../runtime-dom.esm-bundler.js (ERR_ABORTED)`; a reload rendered the full form. This is a Vite dev-server optimize-deps/HMR hiccup, **not** a product bug — noted only so it isn't mistaken for one. `screenshots/04-reports-create-desktop.png`.

---

## What was verified working (regression baseline)

- **Auth:** valid login → dashboard; invalid password → clear "Invalid email or password" (no leak); logged-out access to a protected route → redirect to `/admin/login?redirect=/admin/reports` (return path preserved).
- **Dashboard:** stats, quick actions, recent activity, content overview all populate.
- **Lists:** Reports, Publications, News, Events, Vacancies, Tenders, Management Team, Departments, Team Members (empty state), Offices, Gallery, Videos, Tags, Users, Newsletter, Contact Submissions, Audit Logs — all render with no console errors; search, 3-way filters, sort, and pagination present and correct on Reports.
- **CRUD (News, full cycle):** create (with Excerpt) → appears in list → edit (toggle Published, Save) → delete confirmation modal → **soft delete** (`deleted_at` set, row hidden from list). All correct.
- **Validation:** Reports and Events create forms show inline "This field is required" on empty submit.
- **Analytics:** all 7 dashboards (Overview, Abuse, Capacity, Insights, Geo, Routes, PDF Report) render; ECharts draw real data; empty states are clean ("No data yet"); GeoIP absence degrades gracefully.
- **Responsive:** login and dashboard reflow correctly on mobile (stacked cards, hamburger present) — the only mobile failure is the nav drawer (P1-1).

---

## Screenshot index
All under `qa/screenshots/`:
`01-login-desktop` · `02-dashboard-desktop` · `03-reports-list-desktop` · `04-reports-create-desktop` (transient blank) · `05-reports-create-validation` · `06-publications-list` · `07-news-list` · `08-news-delete-modal` · `09-events-list` · `10-vacancies-list` · `11-tenders-list` · `12-management-team-list` · `13-departments-list` · `14-team-members-list-empty` · `15-offices-list` · `16-gallery-index` · `17-videos-list` · `18-tags` · `19-events-create` · `20-analytics-overview` · `21-analytics-abuse` · `22-analytics-capacity` · `23-analytics-insights` · `24-analytics-geo` · `25-analytics-routes` · `26-analytics-report` · `27-users-list` · `28-users-create` · `29-audit-logs` · `30-newsletter` · `31-contact-submissions` · `32-loggedout-protected-route` · `33-login-mobile` · `34-dashboard-mobile` · `35-mobile-sidebar-open` · `36-gallery-album-detail`
