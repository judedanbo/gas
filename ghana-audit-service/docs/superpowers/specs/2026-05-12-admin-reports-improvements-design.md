# Admin Reports Page Improvements

**Date:** 2026-05-12
**Scope:** `/admin/reports` page, reports admin API, `AdminDataTable` sort wiring

## Summary

Improve the admin reports list page with better visual design and new functionality: compact inline stats, color-coded category badges, file size column, working search, bulk actions (publish/unpublish/archive/delete), and server-side column sorting.

## 1. Compact Inline Stats

**What:** Replace the current subtitle ("Manage audit reports") with 3 pill-shaped counters: total, published, drafts.

**API change:** `GET /api/admin/reports` response gains a `counts` object:
```json
{ "data": [...], "meta": {...}, "counts": { "total": 205, "published": 189, "drafts": 16 } }
```

Counts come from a single aggregate query run alongside the list query. They respect the same filter conditions (minus pagination), so pill values update as the user filters.

**Frontend:** Pills sit beneath the "A-G Reports" heading, left-aligned. Styled as small rounded badges: gray bg for total, green for published, amber for drafts.

**Files:**
- `server/api/admin/reports/index.ts` — add counts query to `handleList`
- `pages/admin/reports/index.vue` — replace subtitle with pills

## 2. Color-Coded Category Badges

**What:** Each audit category gets a distinct color instead of the current uniform green.

**Color map:**
| Category | Tailwind Classes |
|----------|-----------------|
| financial | `bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300` |
| compliance | `bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300` |
| it | `bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300` |
| performance | `bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300` |
| technical | `bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300` |
| follow-up | `bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300` |
| special | `bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300` |

**Scope:** Local to the reports page — a `Record<string, string>` map used in the `#cell-category` template slot. No shared component since these categories are specific to audit reports.

**Files:**
- `pages/admin/reports/index.vue` — add `categoryStyles` map, update `#cell-category` slot

## 3. File Size Column

**What:** Add a "Size" column to the table showing the PDF file size.

**Column definition:** `{ key: 'fileSize', label: 'Size', width: '100px' }` — positioned between "Published" and "Status".

**Data:** Already present in the API response (`fileSize` field). The seed data stores human-readable strings (e.g., "4.2 MB"). Null/empty values render as "—".

**Files:**
- `pages/admin/reports/index.vue` — add column to `columns` array, add `#cell-fileSize` slot

## 4. Fix Search

**What:** Implement the TODO at `server/api/admin/reports/index.ts:66` — search across report translations.

**Approach:** When `search` query param is present, add a subquery condition:
```sql
WHERE audit_reports.id IN (
  SELECT audit_report_id FROM audit_report_translations
  WHERE title LIKE '%term%' OR summary LIKE '%term%'
)
```

Case-insensitive via MySQL default collation. Combines with existing filters (category, year, isPublished). The `%` wildcards are parameterized to prevent injection.

**Files:**
- `server/api/admin/reports/index.ts` — implement search in `handleList`

## 5. Bulk Actions

### Frontend

Enable `selectable` prop on `AdminDataTable`. When 1+ rows are selected, show a floating action bar between filters and table with:

- Selection count ("3 reports selected")
- **Publish** button — sets `isPublished: true`
- **Unpublish** button — sets `isPublished: false`
- **Archive** button — soft-deletes (sets `deletedAt`) with confirmation dialog
- **Delete** button — soft-deletes with confirmation dialog (same backend action as archive; separate button for semantic clarity)

After any bulk action: clear selection, refetch table data.

### Backend

New endpoint: `POST /api/admin/reports/bulk`

**Request:**
```json
{
  "action": "publish" | "unpublish" | "archive" | "delete",
  "ids": [1, 2, 3]
}
```

**Behavior:**
- Validates action against allowed values
- Permission check: `update` for publish/unpublish, `delete` for archive/delete
- Runs update in a transaction
- Logs each change to audit log
- Returns `{ success: true, affected: 3 }`

**Validation:** `ids` must be a non-empty array of positive integers, capped at 50 per request.

**Files:**
- `server/api/admin/reports/bulk.post.ts` — new endpoint
- `pages/admin/reports/index.vue` — enable selection, add bulk action bar and handlers

## 6. Server-Side Sorting

### Frontend

Wire the `@sort` event from `AdminDataTable`. Store `sortBy` and `sortDir` in the page's reactive state. Include them in every `fetchData()` call.

### Backend

`GET /api/admin/reports` accepts `sortBy` and `sortDir` query params.

**Allowlist mapping:**
| `sortBy` value | DB column |
|---|---|
| `translations.en.title` | `audit_report_translations.title` (requires join on `locale = 'en'`) |
| `category` | `audit_reports.category` |
| `publishedAt` | `audit_reports.published_at` |
| `isPublished` | `audit_reports.is_published` |
| `fileSize` | `audit_reports.file_size` |

**Validation:** `sortBy` must be in the allowlist. `sortDir` must be `asc` or `desc`. Invalid values are ignored (falls back to default). Default sort: `publishedAt desc`.

For title sorting, a LEFT JOIN on `audit_report_translations` filtered to `locale = 'en'` is added to the query.

**Files:**
- `server/api/admin/reports/index.ts` — add sort params to `handleList`
- `pages/admin/reports/index.vue` — wire `@sort` event, pass sort params to `fetchData`

## Files Changed (Summary)

| File | Change |
|------|--------|
| `pages/admin/reports/index.vue` | Stats pills, category colors, file size column, bulk action bar, sort wiring |
| `server/api/admin/reports/index.ts` | Counts query, search implementation, sort support |
| `server/api/admin/reports/bulk.post.ts` | New bulk actions endpoint |

## Out of Scope

- Sorting on other admin list pages (reports only for now)
- Shared bulk action bar component (extract later if needed)
- CSV export
- Thumbnail previews in the table
