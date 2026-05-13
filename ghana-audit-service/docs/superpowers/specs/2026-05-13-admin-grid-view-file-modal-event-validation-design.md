# Admin Publications, News & Events Improvements

**Date:** 2026-05-13
**Scope:** Grid views, publication file modal, event end-date validation

---

## 1. Generalized Entity Card Component

### Current State

`AdminReportCard.vue` is hard-coded to the `AdminAuditReport` type with report-specific props (`report`, `categoryClass`) and report-specific rendering (category badge, file size).

### Design

Rename `components/admin/ui/AdminReportCard.vue` to `AdminEntityCard.vue`. Make it entity-agnostic via generic props:

```ts
interface Props {
  title: string
  thumbnail: string | null
  selected: boolean
  editUrl: string
  badgeLabel: string | null
  badgeClass: string
  metadata: string[]       // formatted strings like "May 13, 2026", "2.4 MB"
  isPublished: boolean
}

defineEmits<{
  click: []
  'toggle-select': []
  delete: []
}>()
```

The card renders what it's given — no entity-specific logic inside. Each index page maps its entity fields to these props.

**Reports index page** switches from `<AdminUiAdminReportCard>` to `<AdminUiAdminEntityCard>`, constructing the same visual output via props. The `formatFileSize` helper moves to the index page (or a shared util).

### Files Changed

- `components/admin/ui/AdminReportCard.vue` → renamed to `AdminEntityCard.vue`
- `pages/admin/reports/index.vue` — update component usage + extract prop mapping
- Tests referencing `AdminReportCard` updated

---

## 2. View Toggle for Publications, News, and Events

### Current State

Only the reports index has a table/grid toggle with localStorage persistence. Publications, news, and events are table-only.

### Design

Add the identical view toggle pattern (two icon buttons in the page header) to all three index pages.

**View mode persistence** — localStorage keys:
- `admin-publications-view`
- `admin-news-view`
- `admin-events-view`

**Grid layout:** `grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

**Grid card prop mapping per entity:**

| Entity | Badge | Badge Style | Metadata |
|--------|-------|-------------|----------|
| Publications | Type label (e.g. "Press Statement") | Type-specific color class | Published date |
| News | Author name (if present) | Neutral gray | Published date |
| Events | "Virtual" / "In-Person" | accent (virtual) / secondary (in-person) | Start date, location |

**Grid section includes:**
- Loading spinner (same as reports)
- Empty state with entity-specific messaging
- Pagination with "Showing X to Y of Z" + `<AdminUiAdminPagination>`

**No bulk actions** — publications, news, and events don't have bulk actions in table mode, so none are added for grid mode.

### Files Changed

- `pages/admin/publications/index.vue` — add view toggle + grid section (~70 lines template, ~5 lines script)
- `pages/admin/news/index.vue` — same pattern
- `pages/admin/events/index.vue` — same pattern

---

## 3. Generalized File Modal for Publications

### Current State

`AdminReportFileModal.vue` handles PDF upload, inline iframe preview, and thumbnail generation (auto from PDF or custom upload). It's hard-coded to reports: calls `reports/generate-thumbnail` and validates `/uploads/reports/` paths.

Publications currently use a plain `AdminFileUpload` inline + a separate standalone thumbnail upload.

### Design

Rename `components/admin/form/AdminReportFileModal.vue` to `AdminFileModal.vue`. Add a `resource` prop to make it configurable:

```ts
interface Props {
  resource: 'reports' | 'publications'
  label?: string              // default: "File"
  fileUrl?: string | null
  fileSize?: number | null
  thumbnail?: string | null
  error?: string
  required?: boolean
}
```

**What the `resource` prop controls:**
- Upload type passed to `AdminFileUpload`: `resource === 'reports' ? 'report' : 'publication'`
- Thumbnail generation endpoint: `` `${resource}/generate-thumbnail` ``
- Display text adapts: "Attach Report" → "Attach Publication" (driven by `label`)
- Modal title: uses `label` prop (e.g. "Report File", "Publication File")

**Server-side:** Create `server/api/admin/publications/generate-thumbnail.post.ts` mirroring the reports endpoint but validating `/uploads/publications/` paths. Both use the same `generateThumbnailFromPdf()` utility.

**Publication create/edit page integration:**
- Replace inline `AdminFileUpload` + standalone thumbnail upload with `<AdminFormAdminFileModal resource="publications" label="Publication File" ... />`
- Same event wiring as reports: `@update:file-url`, `@update:file-size`, `@update:thumbnail`
- `PublicationInput` type needs `fileSize` field added (currently absent)

**Reports pages:** Update to use renamed component with `resource="reports"` `label="Report File"` — identical behavior.

### Files Changed

- `components/admin/form/AdminReportFileModal.vue` → renamed to `AdminFileModal.vue`
- `server/api/admin/publications/generate-thumbnail.post.ts` — new endpoint
- `pages/admin/publications/create.vue` — replace file upload section
- `pages/admin/publications/[id]/edit.vue` — replace file upload section
- `pages/admin/reports/create.vue` — update component name
- `pages/admin/reports/[id]/edit.vue` — update component name
- `types/admin.ts` — add `fileSize?: number | null` to `PublicationInput` (currently missing; needed for file modal)
- Tests referencing `AdminReportFileModal` updated

---

## 4. Event End Date Validation Fix

### Current State

- `endDate` field on create/edit forms has no `:error` binding — validation errors are invisible
- No client-side check that endDate > startDate
- Server Zod schema allows optional/nullable endDate but doesn't validate ordering

### Design — Three Layers

**Layer 1: Wire error display (create + edit pages)**

Add `:error="errors.endDate"` to the `AdminDatePicker` for endDate on both:
- `pages/admin/events/create.vue`
- `pages/admin/events/[id]/edit.vue`

**Layer 2: Client-side cross-field validation (create + edit pages)**

Add a custom validation rule in `validationRules`. The `ValidationRule` type is `(value: unknown) => true | string` (no access to the full form), so the rule uses a closure over the reactive `form` object:

```ts
endDate: [
  (value: unknown) => {
    if (!value) return true  // optional field
    if (!form.startDate) return true
    const end = Date.parse(String(value))
    const start = Date.parse(form.startDate)
    if (isNaN(end)) return 'Invalid date'
    return end > start || 'End date must be after start date'
  }
]
```

**Layer 3: Server-side Zod refinement (`server/utils/validation.ts`)**

Add `.superRefine()` to `eventSchema`:

```ts
export const eventSchema = z.object({
  // ... existing fields
}).superRefine((data, ctx) => {
  if (data.endDate && data.startDate) {
    if (Date.parse(data.endDate) <= Date.parse(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be after start date',
        path: ['endDate']
      })
    }
  }
})
```

### Files Changed

- `pages/admin/events/create.vue` — add `:error` binding + validation rule
- `pages/admin/events/[id]/edit.vue` — add `:error` binding + validation rule
- `server/utils/validation.ts` — add `.superRefine()` to `eventSchema`

---

## Implementation Order

1. Generalized entity card (rename + generalize `AdminReportCard`)
2. View toggle on publications, news, events index pages
3. Generalized file modal (rename + generalize `AdminReportFileModal`)
4. Publication thumbnail generation endpoint
5. Integrate file modal into publication create/edit pages
6. Event end-date validation fix (client + server)
7. Update all tests

## Out of Scope

- Bulk actions for publications, news, or events
- File modal for news or events (they use image thumbnails, not PDF documents)
- Changes to public-facing pages
