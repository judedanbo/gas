# Global Search Plan

Plan for replacing the current mock `/api/search` with a real, multi-domain
search across the Ghana Audit Service site, while keeping the existing
frontend (`pages/search.vue`, `composables/useSearch.ts`,
`components/common/SearchBar.vue`, `SearchSearchResultCard`) compatible.

This is a planning document only. No code changes accompany it.

## 1. Goal

Let a visitor type one query in the header search bar and find the most
relevant published content from anywhere on the site, ranked across
domains, paginated, filterable by content type and publish date, and
returned in the visitor's active locale (`en` / `ak`).

## 2. Current state

Frontend (already in place, can be reused unchanged):

- `pages/search.vue` reads `?q=` from the URL, drives type and date
  filters, paginates, renders `SearchSearchResultCard` per result.
- `composables/useSearch.ts` posts to `/api/search` with
  `query, type, category, dateFrom, dateTo, page, perPage`.
- `types/index.ts` defines `SearchResult` and `SearchFilters` with
  `type: 'report' | 'publication' | 'news' | 'page'`.

Backend (mock, needs replacement):

- `server/api/search.ts` filters a hand-written
  `mockSearchData: SearchResult[]` by `title` / `excerpt` substring,
  optionally narrows by `type` and date range, paginates in JS, returns
  `PaginatedResponse<SearchResult>`.

Data layer (Drizzle + MySQL 8) already has the relevant tables. Every
content domain follows the same shape: a base table holding
`slug`, `publishedAt`, `isPublished` plus a `*_translations` table
keyed by `(entity_id, locale)` with `title` and one of
`description` / `content` / `caption`. Domains we will search:

| Type value     | Base table             | Translations table              | Title field | Body field    | URL pattern                                  |
|----------------|------------------------|---------------------------------|-------------|---------------|----------------------------------------------|
| `report`       | `auditReports`         | `auditReportTranslations`       | `title`     | (n/a)         | `/reports/{slug}`                            |
| `publication`  | `publications`         | `publicationTranslations`       | `title`     | `content`     | `/publications/{category}/{slug}`            |
| `news`         | `newsArticles`         | `newsArticleTranslations`       | `title`     | `content`     | `/media/news/{slug}`                         |
| `event`        | `events`               | `eventTranslations`             | `title`     | `description` | `/media/events/{slug}`                       |
| `tender`       | `tenders`              | `tenderTranslations`            | `title`     | `description` | `/tenders/{slug}` (TBD — confirm route)      |
| `vacancy`      | `vacancies`            | `vacancyTranslations`           | `title`     | `description` | `/careers/{slug}`                            |
| `video`        | `videos`               | `videoTranslations`             | `title`     | `description` | `/media/videos` (or per-id deeplink)         |
| `gallery`      | `galleryAlbums`        | `galleryAlbumTranslations`      | `title`     | `description` | `/media/gallery?album={slug}`                |
| `team`         | `managementTeam`       | `managementTeamTranslations`    | `name`      | (bio, if any) | `/about/management-team/{slug}`              |
| `office`       | `regionalOffices`      | `regionalOfficeTranslations`    | `name`      | (n/a)         | `/about/regional-offices` (anchor by slug)   |
| `page`         | static                 | (none)                          | hardcoded   | hardcoded     | per page                                     |

Static pages (`/about`, `/about/the-service`, `/about/departmental-profile`,
`/about/past-auditors-general`, `/contact`, `/citizenseye`,
`/accessibility`, `/privacy-policy`, `/terms`, `/publications/...` index
pages, `/careers`) have no DB row. We will register them in a small
in-code table (see §6.4).

## 3. Scope

In scope:

- Real DB-backed `/api/search` returning ranked matches across the
  domains listed above.
- Locale awareness via `getRequestLocale(event)` — return the title and
  excerpt in the active locale, falling back to `en`.
- Type filter (`type=report|publication|news|event|tender|vacancy|video|gallery|team|office|page`)
  and multi-type via repeated `type=` params.
- Date range filter (`dateFrom`, `dateTo`) against `publishedAt` for
  domains that have it; ignored for static pages and team/offices.
- Pagination (`page`, `perPage`, max 50).
- Excerpt generation: ~200 char snippet from the body field with the
  matched term highlighted server-side via a `<mark>` (or returned as
  plain text and let the card render highlighting).
- Type widening in `types/index.ts`: extend the `type` union; update
  `useSearch.typeFilters`.
- Tests: replace the existing mock-based integration test
  (`tests/integration/api/search.test.ts`) with one that mocks the
  Drizzle DB pool and asserts query shape + ranking.

Out of scope (explicit, follow-up work):

- Full PDF body indexing for audit reports. The schema does not store
  PDF text; reports already have title and category which is enough
  for v1. Indexing PDF text needs a separate ingestion job — track
  separately.
- Search-as-you-type / autocomplete in the header bar. The existing
  search bar submits to `/search` only; autocomplete is a follow-up.
- External search engines (Meilisearch / OpenSearch / Algolia). MySQL
  alone is sufficient for the current dataset size (low thousands of
  rows total). A migration path is sketched in §10 but not done now.
- Admin search. The admin panel has its own `AdminSearchFilter` and is
  scoped per-resource — leave it alone.
- Tag / category facets. Filterable categories already exist on the
  reports and publications listing pages; this plan keeps them out
  of the global search response shape and revisits in v2.

## 4. API contract

`GET /api/search` query params:

- `query` (required, min 2 chars after trim — return empty results
  with a hint if shorter)
- `type` (optional, repeatable) — one of the `type` values in §2
- `dateFrom`, `dateTo` (optional, ISO date) — applied to `publishedAt`
- `page` (default 1), `perPage` (default 10, max 50)

Response (unchanged shape, slightly extended `SearchResult`):

```ts
interface SearchResult {
  id: string                // "report-{numericId}", "publication-{id}", ...
  type: 'report' | 'publication' | 'news' | 'event' | 'tender'
       | 'vacancy' | 'video' | 'gallery' | 'team' | 'office' | 'page'
  title: string             // localized
  excerpt: string           // localized, ~200 chars, may include <mark>…</mark>
  url: string               // localized prefix applied client-side
  publishedAt?: string      // ISO; absent for pages, team, offices
  score?: number            // for client-side debug; not sorted on
}
```

The `category` filter on `SearchFilters` is currently unused by the
frontend and remains a no-op server-side — leave it documented as
reserved.

`PaginatedResponse<SearchResult>` shape stays unchanged (`data`, `meta`).

## 5. Database approach

We have two options.

### Option A — `LIKE '%term%'` per domain (recommended for v1)

- Simple, no schema migrations, works with existing indexes for the
  `isPublished` and `publishedAt` filters.
- Per domain run:
  `SELECT base.id, base.slug, base.published_at, t.title, t.{body}
   FROM base JOIN translations t ON t.entity_id = base.id
   WHERE base.is_published = 1
     AND t.locale = ?  -- with COALESCE fallback to 'en'
     AND (t.title LIKE ? OR t.{body} LIKE ?)
     AND base.published_at BETWEEN ? AND ?`
- Score in SQL with a simple expression:
  `score = (title LIKE ?)*3 + (body LIKE ?)*1` (or `INSTR(...)`).
- UNION ALL the per-domain SELECTs into a single ranked list, then
  `ORDER BY score DESC, published_at DESC LIMIT/OFFSET`.
- Excerpt: take the body field, find the first match offset, return
  `SUBSTRING_INDEX(...)` or do snippeting in JS post-query.

Trade-offs: `LIKE '%term%'` cannot use a regular B-tree index, so it
becomes a full scan of each translations table. With current data
volume (low thousands of rows) this is acceptable; query latency
should stay under ~50ms on the dev DB and well under cache TTL.

### Option B — MySQL FULLTEXT

- Requires a migration adding `FULLTEXT` indexes to each
  `*_translations` table on `(title, body)`, and `ENGINE=InnoDB` with
  `innodb_ft_min_token_size` tuned for short query terms.
- Better ranking via `MATCH ... AGAINST` and built-in relevance score.
- Queries become per-domain: `MATCH(title, body) AGAINST(? IN NATURAL
  LANGUAGE MODE) AS rel` + the same `is_published` / locale / date
  filters.
- Worth doing only after we hit perf issues. Defer.

**Recommendation: Option A in v1, leave Option B as a tracked
follow-up. Either way the public API contract stays identical.**

## 6. Implementation outline

### 6.1 Search service module — new file

`server/utils/searchService.ts` (or `server/services/search.ts`,
matching project convention — check what `transform*.ts` siblings do).

Exports a single `runGlobalSearch(opts: { query, types, dateFrom,
dateTo, locale, page, perPage }): Promise<PaginatedResponse<SearchResult>>`.

Internally:

1. Normalize query: trim, lowercase, collapse whitespace, build the
   `LIKE` pattern as `%term%` (escape `%` and `_`).
2. For each requested type (or all types if none requested) call a
   per-domain searcher (see §6.2).
3. Run all per-domain queries in parallel via `Promise.all`.
4. Merge, sort by `(score desc, publishedAt desc)`, slice for pagination,
   compute `meta`.
5. Localize URLs server-side as plain `/path/...` — the frontend
   prepends the locale prefix when rendering `<NuxtLink>`.

### 6.2 Per-domain searchers

Co-locate small helpers in the same file. One per type. They share a
common signature returning `Array<RawSearchHit>` where
`RawSearchHit = { id, type, title, body, slug, publishedAt, score }`.

Use existing transform helpers from `server/utils/transform*.ts` only
where they already produce the correct shape — mostly we'll write
domain-specific projections because the search response is narrower
than detail DTOs.

### 6.3 Excerpt generation

Helper `buildExcerpt(body: string, term: string, max = 200): string`.
Find first case-insensitive match, return a window around it, prepend
`…` if not at start, append `…` if not at end. HTML-escape, then wrap
the matched substring in `<mark>…</mark>`. The
`SearchSearchResultCard` already renders `excerpt` as HTML — confirm
this before merging; if not, adjust the card template (separate small
PR) to use `v-html` with a sanitized whitelist of `<mark>` only.

### 6.4 Static pages registry

`server/utils/staticSearchablePages.ts` exports a typed array:

```ts
export const staticSearchablePages = [
  { id: 'page-about',          path: '/about',                        i18nKey: 'pages.about' },
  { id: 'page-the-service',    path: '/about/the-service',            i18nKey: 'pages.theService' },
  { id: 'page-dept-profile',   path: '/about/departmental-profile',   i18nKey: 'pages.departmentalProfile' },
  { id: 'page-past-ag',        path: '/about/past-auditors-general',  i18nKey: 'pages.pastAuditorsGeneral' },
  { id: 'page-contact',        path: '/contact',                      i18nKey: 'pages.contact' },
  { id: 'page-citizenseye',    path: '/citizenseye',                  i18nKey: 'pages.citizensEye' },
  { id: 'page-accessibility',  path: '/accessibility',                i18nKey: 'pages.accessibility' },
  { id: 'page-privacy',        path: '/privacy-policy',               i18nKey: 'pages.privacyPolicy' },
  { id: 'page-terms',          path: '/terms',                        i18nKey: 'pages.terms' },
  { id: 'page-publications',   path: '/publications',                 i18nKey: 'pages.publications' },
  { id: 'page-careers',        path: '/careers',                      i18nKey: 'pages.careers' },
] as const
```

Each entry needs a `title`/`description` string in both
`i18n/locales/en.json` and `ak.json` under a new `pages` namespace.
The static-page searcher resolves them by reading the locale file
once at module init (Nitro side — server $i18n is not directly
available, so read the JSON files directly under
`~/i18n/locales/{locale}.json`).

### 6.5 Locale resolution

Use `getCookie(event, 'i18n_redirected')` or the `accept-language`
header; or simpler — accept a `locale` query param from the frontend.
The cleanest fix is to plumb locale from the Nuxt app into the
fetch call. Add `locale` to `SearchFilters` and pass `useI18n().locale`
when calling `search()` in `pages/search.vue`. Server defaults to
`en` if missing.

### 6.6 Caching & route rules

`/api/search` is dynamic by query string. Add a `routeRules` entry
in `nuxt.config.ts` with a short SWR window:

```ts
'/api/search': { swr: 60 }   // 1 min — cheap to revalidate
```

Confirm SWR keys include the full query string; Nitro's default
behavior does, but verify.

### 6.7 Rate limiting

The site already has `server/middleware/rateLimit.ts`. Wire global
search through it with a moderate budget (e.g., 30 req/min/IP) — the
endpoint is unauthenticated and runs DB queries.

## 7. Frontend changes (small)

- `types/index.ts`: extend `SearchResult.type` union and add
  `locale?: string` to `SearchFilters`.
- `composables/useSearch.ts`:
  - Pass `locale` when calling `$fetch`.
  - Extend `typeFilters` to include the new types
    (Events, Tenders, Vacancies, Videos, Gallery, Team, Offices). Keep
    the four existing ones first to preserve UI muscle memory.
- `pages/search.vue`: no behavior change, just consumes the new
  filters list. URL prefix for results: when rendering
  `result.url`, prepend the active locale prefix
  (`localePath(result.url)` from `useI18n()`).
- `components/search/SearchResultCard.vue`: confirm/enable safe
  `<mark>` rendering for the excerpt. If it currently renders text,
  switch to `v-html` after sanitizing — only `<mark>` allowed.

No Vue components are added. No new pages.

## 8. i18n copy

New strings (both locales):

- `search.hint.minLength` ("Type at least 2 characters")
- `search.types.event`, `search.types.tender`, `search.types.vacancy`,
  `search.types.video`, `search.types.gallery`, `search.types.team`,
  `search.types.office`
- `pages.*` titles and descriptions for each entry in
  `staticSearchablePages` (used both by the static-page searcher and
  potentially by SEO metadata — reuse if helpful).

## 9. Tests

Replace `tests/integration/api/search.test.ts` (currently asserts
mock data behavior). New cases:

1. Empty query → `data: []`, `meta.total = 0`.
2. Query under min length → empty, with hint flag (or just empty if
   we don't expose the hint in the response).
3. Mocked DB returning hits across two domains → results merged,
   ordered by score then `publishedAt`.
4. Type filter narrows to a single domain — ensure other domain
   queries are not even issued (use a spy).
5. Date filter prunes hits.
6. Pagination math: `meta.lastPage`, slicing.
7. Locale: when `locale=ak`, asserts the translation table is queried
   with `'ak'` and falls back to `'en'` rows when no `ak` row exists.
8. SQL injection — the query string contains `%`, `_`, `'`, `;`; the
   handler must escape and not crash.

Add an e2e to `tests/e2e/search.spec.ts`:

- Seed (or rely on existing seeds) → navigate to `/search?q=audit`,
  expect ≥ 1 result card and a `<mark>` highlight.

Pre-PR gate stays the same: `npm run test:run && npm run lint &&
npm run format:check && npm run typecheck` — all four must pass.

## 10. Phased rollout

**Phase 1 — backend + minimal frontend type plumbing.**
- New `server/utils/searchService.ts` covering reports, publications,
  news.
- Replace `server/api/search.ts` body with a call to
  `runGlobalSearch`.
- Extend types and `useSearch.typeFilters` to include the new types
  (even though only three are wired in phase 1).
- Tests for the three domains.
- Ship.

**Phase 2 — remaining domains.**
- Add searchers for events, tenders, vacancies, videos, gallery,
  team, offices.
- Add the static-pages searcher and i18n copy.
- Tests per domain.

**Phase 3 — quality.**
- Snippeting with `<mark>` and corresponding sanitized rendering in
  `SearchResultCard`.
- Rate limit wiring.
- SWR cache rule.
- Optional: MySQL FULLTEXT migration if Phase 1 latency is poor on
  prod-sized data.

**Phase 4 — autocomplete.**
- Lightweight `/api/search/suggest` returning top 5 titles. New work,
  separate plan.

## 11. File-level change list

Phase 1 (PR 1):

- Add `ghana-audit-service/server/utils/searchService.ts` — new.
- Edit `ghana-audit-service/server/api/search.ts` — replace mock with
  service call.
- Edit `ghana-audit-service/types/index.ts` — extend
  `SearchResult.type` union; add `locale?` to `SearchFilters`.
- Edit `ghana-audit-service/composables/useSearch.ts` — pass `locale`,
  extend `typeFilters`.
- Edit `ghana-audit-service/pages/search.vue` — pass
  `useI18n().locale.value` into the search call; wrap `result.url`
  with `localePath` in the card if needed.
- Edit `ghana-audit-service/tests/integration/api/search.test.ts` —
  rewrite for DB-mocked behavior.
- Edit `ghana-audit-service/i18n/locales/en.json`,
  `ghana-audit-service/i18n/locales/ak.json` — `search.hint.minLength`
  and any new type labels referenced by the UI.

Phase 2 (PR 2):

- Extend `searchService.ts` with new searchers.
- Add `ghana-audit-service/server/utils/staticSearchablePages.ts`.
- Add `pages.*` i18n keys (en + ak).
- Tests per domain.

Phase 3 (PR 3):

- Edit `ghana-audit-service/components/search/SearchResultCard.vue`
  to render `<mark>`-highlighted excerpts safely.
- Edit `ghana-audit-service/nuxt.config.ts` — `routeRules['/api/search']`.
- Wire `rateLimit` middleware path matcher to include `/api/search`.

## 12. Risks and open questions

1. **PDF text indexing.** Reports often match on full content, not
   just the title. Without PDF text in the DB, `/reports` search will
   feel shallow. Decision: out of scope for v1, track as a follow-up
   (a Nitro task that runs `pdf-parse` against
   `public/reports/*.pdf` during seed/build and writes to a new
   column or sidecar table).
2. **Excerpt rendering.** `SearchSearchResultCard` may treat
   `excerpt` as plain text. Confirm before relying on `<mark>`. If
   it does, adjust in Phase 1 or strip highlighting until Phase 3.
3. **Tender route.** `/tenders/{slug}` is assumed; verify the actual
   route under `pages/`. If tenders only live as a list page, fall
   back to `/tenders#${slug}` or omit the type from search.
4. **Video deep links.** `/media/videos.vue` is a single page;
   confirm whether per-video deep links exist before claiming
   `video` results.
5. **Locale fallback.** Akan translations may be sparse. Decide
   whether to (a) hide rows that have no `ak` translation, or
   (b) fall back to the `en` row but mark it. Recommendation: (b),
   with a small flag in the result so the card can show "(English)".
6. **Caching of static-pages translations.** Reading
   `i18n/locales/{locale}.json` per request is fine; cache them in a
   module-level `Map` keyed by locale.
7. **Public exposure of unpublished translations.** Ensure every
   per-domain query joins on the base table and filters
   `is_published = 1` (and `deletedAt IS NULL` where the column
   exists). Add a unit-test pattern that any new searcher must apply
   these filters — easiest to enforce via a tiny shared helper.
8. **Ranking quality.** Title match × 3 + body match × 1 is a rough
   start. Watch the staging logs after Phase 1; refine before
   Phase 3.

## 13. Acceptance criteria for v1 (Phase 1)

- `GET /api/search?query=audit` returns at least one real result from
  each of `report`, `publication`, `news` when seed data is loaded.
- `?type=report` narrows to reports only.
- `?dateFrom=2024-01-01&dateTo=2024-12-31` constrains by
  `published_at`.
- `?locale=ak` returns Akan titles where present, English otherwise.
- Pagination meta is correct.
- All four pre-PR gates pass.
- The existing search page renders results without code changes
  beyond the small ones in §11.
