# Admin Reports Page Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the admin reports list page with inline stats, color-coded categories, file size column, working search, bulk actions, and server-side sorting.

**Architecture:** Backend-first approach — each API change is built and tested before wiring the frontend. The bulk endpoint is a new file; all other backend changes modify the existing `handleList` in `server/api/admin/reports/index.ts`. All frontend changes land in `pages/admin/reports/index.vue`.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Drizzle ORM (MySQL), Tailwind CSS, Vitest

---

## File Map

| File | Responsibility | Action |
|------|---------------|--------|
| `server/api/admin/reports/index.ts` | List + create reports API | Modify: add counts, search, sorting |
| `server/api/admin/reports/bulk.post.ts` | Bulk actions API | Create |
| `pages/admin/reports/index.vue` | Admin reports list page | Modify: stats, badges, file size, bulk UI, sort |

---

### Task 1: Add Counts to the Reports List API

**Files:**
- Modify: `server/api/admin/reports/index.ts` — `handleList` function (lines 30–122)

- [ ] **Step 1: Add counts query alongside existing list query**

In `server/api/admin/reports/index.ts`, inside `handleList`, after the existing `count` query (line 71–74) and before the `reports` query (line 77), add a counts aggregation. Replace the return block (lines 118–121) to include counts.

Add these two new queries after line 74 (after `const [{ count }]`):

```typescript
  // Count published
  const [{ publishedCount }] = await db
    .select({ publishedCount: sql<number>`count(*)` })
    .from(schema.auditReports)
    .where(and(...(conditions.length > 0 ? conditions : []), eq(schema.auditReports.isPublished, true)))

  // Count drafts
  const [{ draftCount }] = await db
    .select({ draftCount: sql<number>`count(*)` })
    .from(schema.auditReports)
    .where(and(...(conditions.length > 0 ? conditions : []), eq(schema.auditReports.isPublished, false)))
```

Replace the return statement (lines 118–121):

```typescript
  return {
    data,
    meta: buildPaginationMeta(Number(count), page, perPage),
    counts: {
      total: Number(count),
      published: Number(publishedCount),
      drafts: Number(draftCount)
    }
  }
```

- [ ] **Step 2: Verify with curl**

Start the dev server if not running (`npm run dev`), then:

```bash
# Get a token first
TOKEN=$(curl -s http://localhost:3000/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@audit.gov.gh","password":"change-this-password"}' | \
  node -e "process.stdin.on('data',d=>process.stdout.write(JSON.parse(d).token))")

# Test the counts
curl -s http://localhost:3000/api/admin/reports?perPage=1 \
  -H "Authorization: Bearer $TOKEN" | node -e "
  process.stdin.on('data', d => {
    const r = JSON.parse(d);
    console.log('counts:', JSON.stringify(r.counts));
    console.log('meta:', JSON.stringify(r.meta));
  })"
```

Expected: `counts` object with `total`, `published`, `drafts` as numbers. `total` should equal `meta.total`.

- [ ] **Step 3: Commit**

```bash
git add server/api/admin/reports/index.ts
git commit -m "feat(admin): add counts to reports list API response"
```

---

### Task 2: Implement Search in the Reports List API

**Files:**
- Modify: `server/api/admin/reports/index.ts` — `handleList` function (lines 63–67)

- [ ] **Step 1: Replace the TODO block with search implementation**

In `server/api/admin/reports/index.ts`, replace lines 63–67 (the TODO comment block):

```typescript
  // Search in translations
  // TODO: Implement search filtering after fetching due to join complexity
  // if (query.search && typeof query.search === 'string') { ... }
```

With:

```typescript
  // Search in translations via subquery
  if (query.search && typeof query.search === 'string') {
    const searchTerm = `%${query.search}%`
    conditions.push(
      sql`${schema.auditReports.id} IN (
        SELECT ${schema.auditReportTranslations.auditReportId}
        FROM ${schema.auditReportTranslations}
        WHERE ${schema.auditReportTranslations.title} LIKE ${searchTerm}
           OR ${schema.auditReportTranslations.summary} LIKE ${searchTerm}
      )`
    )
  }
```

The `sql` template literal parameterizes `searchTerm` — no injection risk.

- [ ] **Step 2: Verify with curl**

```bash
curl -s "http://localhost:3000/api/admin/reports?search=petroleum&perPage=3" \
  -H "Authorization: Bearer $TOKEN" | node -e "
  process.stdin.on('data', d => {
    const r = JSON.parse(d);
    console.log('found:', r.meta.total, 'reports');
    r.data.forEach(x => console.log(' -', x.translations?.en?.title?.substring(0, 60)));
  })"
```

Expected: Only reports with "petroleum" in their title or summary.

- [ ] **Step 3: Commit**

```bash
git add server/api/admin/reports/index.ts
git commit -m "feat(admin): implement search across report translations"
```

---

### Task 3: Add Server-Side Sorting to the Reports List API

**Files:**
- Modify: `server/api/admin/reports/index.ts` — `handleList` function

- [ ] **Step 1: Add sort parameter handling and the column allowlist**

In `server/api/admin/reports/index.ts`, add these imports at the top (update the existing import from `drizzle-orm`):

```typescript
import { eq, and, isNull, sql, desc, asc } from 'drizzle-orm'
```

Inside `handleList`, after parsing pagination (`const { page, perPage, offset } = ...`) and before building where conditions, add:

```typescript
  // Sort parameters
  const sortColumnMap: Record<string, typeof schema.auditReports.publishedAt | typeof schema.auditReports.category | typeof schema.auditReports.isPublished | typeof schema.auditReports.fileSize> = {
    publishedAt: schema.auditReports.publishedAt,
    category: schema.auditReports.category,
    isPublished: schema.auditReports.isPublished,
    fileSize: schema.auditReports.fileSize
  }

  const sortBy = typeof query.sortBy === 'string' ? query.sortBy : null
  const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc'
  const sortByTitle = sortBy === 'translations.en.title'
```

- [ ] **Step 2: Replace the hardcoded orderBy with dynamic sorting**

Replace the existing reports query (the `.orderBy(desc(schema.auditReports.publishedAt))` block) with:

```typescript
  // Fetch reports — with optional title sort via join
  let reportRows
  if (sortByTitle) {
    const reports = await db
      .select({ report: schema.auditReports })
      .from(schema.auditReports)
      .leftJoin(
        schema.auditReportTranslations,
        and(
          eq(schema.auditReportTranslations.auditReportId, schema.auditReports.id),
          eq(schema.auditReportTranslations.locale, 'en')
        )
      )
      .where(whereClause)
      .orderBy(sortDir === 'asc'
        ? asc(schema.auditReportTranslations.title)
        : desc(schema.auditReportTranslations.title))
      .limit(perPage)
      .offset(offset)

    reportRows = reports.map(r => r.report)
  } else {
    const sortColumn = sortBy && sortColumnMap[sortBy]
      ? sortColumnMap[sortBy]
      : schema.auditReports.publishedAt
    const orderFn = sortDir === 'asc' ? asc : desc

    reportRows = await db
      .select()
      .from(schema.auditReports)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(perPage)
      .offset(offset)
  }
```

Then update references from `reports` to `reportRows` in the rest of `handleList`:

```typescript
  // Fetch translations for each report
  const reportIds = reportRows.map((r) => r.id)
```

And:

```typescript
  // Combine reports with translations
  const data = reportRows.map((report) => ({
    ...report,
    translations: translationsByReport[report.id] || {}
  }))
```

- [ ] **Step 3: Verify with curl**

```bash
# Sort by category ascending
curl -s "http://localhost:3000/api/admin/reports?sortBy=category&sortDir=asc&perPage=3" \
  -H "Authorization: Bearer $TOKEN" | node -e "
  process.stdin.on('data', d => {
    const r = JSON.parse(d);
    r.data.forEach(x => console.log(x.category, '-', x.translations?.en?.title?.substring(0, 40)));
  })"

# Sort by title descending
curl -s "http://localhost:3000/api/admin/reports?sortBy=translations.en.title&sortDir=desc&perPage=3" \
  -H "Authorization: Bearer $TOKEN" | node -e "
  process.stdin.on('data', d => {
    const r = JSON.parse(d);
    r.data.forEach(x => console.log(x.translations?.en?.title?.substring(0, 60)));
  })"
```

Expected: Reports sorted by the requested column and direction.

- [ ] **Step 4: Commit**

```bash
git add server/api/admin/reports/index.ts
git commit -m "feat(admin): add server-side sorting to reports list API"
```

---

### Task 4: Create Bulk Actions API Endpoint

**Files:**
- Create: `server/api/admin/reports/bulk.post.ts`

- [ ] **Step 1: Create the bulk endpoint file**

Create `server/api/admin/reports/bulk.post.ts`:

```typescript
import { eq, and, isNull, sql, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction } from '../../../utils/auditLogger'
import { validateBody } from '../../../utils/validation'

const bulkActionSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive', 'delete']),
  ids: z.array(z.number().int().positive()).min(1).max(50)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { action, ids } = validateBody(bulkActionSchema, body)

  const needsDelete = action === 'archive' || action === 'delete'
  requirePermission(event, needsDelete ? 'delete' : 'update')

  const user = getCurrentUser(event)
  const db = getDatabase()

  const existingReports = await db
    .select({ id: schema.auditReports.id })
    .from(schema.auditReports)
    .where(
      and(
        sql`${schema.auditReports.id} IN (${sql.join(ids, sql`, `)})`,
        isNull(schema.auditReports.deletedAt)
      )
    )

  const validIds = existingReports.map(r => r.id)
  if (validIds.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'No valid reports found for the given IDs'
    })
  }

  const whereIds = sql`${schema.auditReports.id} IN (${sql.join(validIds, sql`, `)})`
  const now = new Date()

  if (action === 'publish') {
    await db
      .update(schema.auditReports)
      .set({ isPublished: true, updatedBy: user.id })
      .where(whereIds)
  } else if (action === 'unpublish') {
    await db
      .update(schema.auditReports)
      .set({ isPublished: false, updatedBy: user.id })
      .where(whereIds)
  } else {
    // archive and delete both soft-delete
    await db
      .update(schema.auditReports)
      .set({ deletedAt: now, updatedBy: user.id })
      .where(whereIds)
  }

  for (const id of validIds) {
    await logAuditAction(event, action === 'archive' || action === 'delete' ? 'delete' : 'update', 'audit_report', id, {
      action,
      bulkOperation: true
    })
  }

  return { success: true, affected: validIds.length }
})
```

- [ ] **Step 2: Verify with curl**

```bash
# Test bulk publish (use IDs from the database)
curl -s http://localhost:3000/api/admin/reports/bulk \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"unpublish","ids":[1436,1437]}' | node -p "JSON.parse(require('fs').readFileSync(0,'utf8'))"
```

Expected: `{ success: true, affected: 2 }`

```bash
# Republish them
curl -s http://localhost:3000/api/admin/reports/bulk \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"publish","ids":[1436,1437]}' | node -p "JSON.parse(require('fs').readFileSync(0,'utf8'))"
```

Expected: `{ success: true, affected: 2 }`

```bash
# Test validation - empty ids
curl -s http://localhost:3000/api/admin/reports/bulk \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"publish","ids":[]}' 2>&1 | head -5
```

Expected: 400 Validation Error

- [ ] **Step 3: Commit**

```bash
git add server/api/admin/reports/bulk.post.ts
git commit -m "feat(admin): add bulk actions endpoint for reports"
```

---

### Task 5: Frontend — Inline Stats Pills, Category Badges, File Size Column

**Files:**
- Modify: `pages/admin/reports/index.vue` — template and script

- [ ] **Step 1: Update the script section**

In `pages/admin/reports/index.vue`, update the script to add:
1. A `counts` ref to hold stats from the API
2. The `categoryStyles` map
3. Updated `columns` with `fileSize`
4. Updated `fetchData` to store counts

Replace the entire `<script setup lang="ts">` section:

```typescript
<script setup lang="ts">
  import type { AdminAuditReport } from '~/types/admin'

  definePageMeta({
    layout: 'admin'
  })

  const { items, loading, deleting, meta, fetchAll, remove } =
    useAdminCrud<AdminAuditReport>('reports')

  // Stats counts from API
  const counts = ref({ total: 0, published: 0, drafts: 0 })

  // Filters
  const filters = reactive({
    search: '',
    category: '',
    year: '',
    isPublished: ''
  })

  const hasActiveFilters = computed(() => {
    return !!filters.search || !!filters.category || !!filters.year || !!filters.isPublished
  })

  function clearFilters() {
    filters.search = ''
    filters.category = ''
    filters.year = ''
    filters.isPublished = ''
  }

  // Categories
  const categories = [
    { value: 'financial', label: 'Financial Audit' },
    { value: 'compliance', label: 'Compliance Audit' },
    { value: 'it', label: 'IT Audit' },
    { value: 'performance', label: 'Performance Audit' },
    { value: 'technical', label: 'Technical Audit' },
    { value: 'follow-up', label: 'Follow-up Review' },
    { value: 'special', label: 'Special Audit' }
  ]

  const categoryStyles: Record<string, string> = {
    financial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    compliance: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    it: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    performance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    technical: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    'follow-up': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    special: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  }

  // Years (current year to 2000)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1999 }, (_, i) => currentYear - i)

  // Table columns
  const columns = [
    { key: 'translations.en.title', label: 'Title', sortable: true },
    { key: 'category', label: 'Category', sortable: true, width: '150px' },
    { key: 'publishedAt', label: 'Published', sortable: true, width: '120px' },
    { key: 'fileSize', label: 'Size', width: '100px' },
    { key: 'isPublished', label: 'Status', width: '120px' }
  ]

  // Sort state
  const sortBy = ref<string | null>(null)
  const sortDir = ref<'asc' | 'desc'>('desc')

  function handleSort(column: string, direction: 'asc' | 'desc') {
    sortBy.value = column
    sortDir.value = direction
    fetchData({ page: 1 })
  }

  // Delete
  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminAuditReport | null>(null)

  function confirmDelete(item: AdminAuditReport) {
    itemToDelete.value = item
    showDeleteDialog.value = true
  }

  function handleRowClick(row: AdminAuditReport) {
    navigateTo(`/admin/reports/${row.id}/edit`)
  }

  async function handleDelete() {
    if (!itemToDelete.value) return

    const success = await remove(itemToDelete.value.id)
    if (success) {
      showDeleteDialog.value = false
      itemToDelete.value = null
    }
  }

  // Pagination
  function handlePageChange(page: number) {
    fetchData({ page })
  }

  // Fetch data
  const api = useAdminApi()

  async function fetchData(overrides: Record<string, string | number | boolean | undefined> = {}) {
    const params: Record<string, string | number | boolean | undefined> = {
      page: meta.value.page,
      perPage: 20,
      ...overrides
    }

    if (filters.search) params.search = filters.search
    if (filters.category) params.category = filters.category
    if (filters.year) params.year = filters.year
    if (filters.isPublished) params.isPublished = filters.isPublished
    if (sortBy.value) params.sortBy = sortBy.value
    if (sortBy.value) params.sortDir = sortDir.value

    // Use raw API to capture counts alongside data
    try {
      const response = await api.get<{
        data: AdminAuditReport[]
        meta: { total: number; page: number; perPage: number; lastPage: number }
        counts: { total: number; published: number; drafts: number }
      }>('reports', params)

      items.value = response.data
      meta.value = response.meta
      if (response.counts) {
        counts.value = response.counts
      }
    } catch {
      await fetchAll(params)
    }
  }

  // Watch filters
  watch(
    filters,
    () => {
      fetchData({ page: 1 })
    },
    { deep: true }
  )

  // Initial fetch
  onMounted(() => {
    fetchData()
  })
</script>
```

- [ ] **Step 2: Update the template — header with stats pills**

Replace the page header block (lines 3–19 in the original template) with:

```html
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">A-G Reports</h1>
        <div class="flex flex-wrap gap-2 mt-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {{ counts.total }} total
          </span>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            {{ counts.published }} published
          </span>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {{ counts.drafts }} drafts
          </span>
        </div>
      </div>
      <NuxtLink to="/admin/reports/create" class="btn btn-primary inline-flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add Report
      </NuxtLink>
    </div>
```

- [ ] **Step 3: Update the template — category badges and file size cell**

Replace the category cell slot:

```html
      <template #cell-category="{ value }">
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
          :class="categoryStyles[value as string] || 'bg-gray-100 text-gray-700'"
        >
          {{ (value as string)?.replace('-', ' ') }}
        </span>
      </template>
```

Add a file size cell slot (after the `publishedAt` slot):

```html
      <template #cell-fileSize="{ value }">
        <span class="text-gray-500 dark:text-gray-400 text-sm">
          {{ value || '—' }}
        </span>
      </template>
```

- [ ] **Step 4: Wire the `@sort` event on the data table**

Update the `AdminUiAdminDataTable` element to include:

```html
    <AdminUiAdminDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :meta="meta"
      @page-change="handlePageChange"
      @row-click="handleRowClick"
      @sort="handleSort"
    >
```

- [ ] **Step 5: Verify in browser**

Navigate to `http://localhost:3000/admin/reports` and confirm:
- Stats pills show total, published, drafts beneath the title
- Category badges have distinct colors per type
- File size column appears with values (or "—" for empty)
- Clicking column headers triggers sort (arrow indicators appear)
- Filtering updates the stats pills

- [ ] **Step 6: Commit**

```bash
git add pages/admin/reports/index.vue
git commit -m "feat(admin): add stats pills, category colors, file size column, and sorting to reports page"
```

---

### Task 6: Frontend — Bulk Actions UI

**Files:**
- Modify: `pages/admin/reports/index.vue` — template and script

- [ ] **Step 1: Add bulk action state and handlers to the script**

Add these after the sort state block in the script:

```typescript
  // Bulk actions
  const selectedReports = ref<AdminAuditReport[]>([])
  const bulkLoading = ref(false)
  const showBulkDeleteDialog = ref(false)
  const pendingBulkAction = ref<string | null>(null)

  function handleSelectionChange(selected: AdminAuditReport[]) {
    selectedReports.value = selected
  }

  async function executeBulkAction(action: string) {
    if (selectedReports.value.length === 0) return

    bulkLoading.value = true
    try {
      const ids = selectedReports.value.map(r => r.id)
      await api.post('reports/bulk', { action, ids })
      selectedReports.value = []
      await fetchData()
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      console.error('Bulk action failed:', err.data?.message || err.message)
    } finally {
      bulkLoading.value = false
    }
  }

  function confirmBulkDelete(action: string) {
    pendingBulkAction.value = action
    showBulkDeleteDialog.value = true
  }

  async function handleBulkDelete() {
    if (!pendingBulkAction.value) return
    await executeBulkAction(pendingBulkAction.value)
    showBulkDeleteDialog.value = false
    pendingBulkAction.value = null
  }
```

- [ ] **Step 2: Enable selection on the data table and add bulk action bar**

Update the `AdminUiAdminDataTable` to enable selection:

```html
    <AdminUiAdminDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :meta="meta"
      selectable
      @page-change="handlePageChange"
      @row-click="handleRowClick"
      @sort="handleSort"
      @selection-change="handleSelectionChange"
    >
```

Add the bulk action bar between the search filter and the data table:

```html
    <!-- Bulk Action Bar -->
    <div
      v-if="selectedReports.length > 0"
      class="mb-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 dark:border-primary/30 dark:bg-primary/10"
    >
      <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
        {{ selectedReports.length }} report{{ selectedReports.length > 1 ? 's' : '' }} selected
      </span>
      <div class="flex items-center gap-2 ml-auto">
        <button
          type="button"
          class="btn btn-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          :disabled="bulkLoading"
          @click="executeBulkAction('publish')"
        >
          Publish
        </button>
        <button
          type="button"
          class="btn btn-sm bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          :disabled="bulkLoading"
          @click="executeBulkAction('unpublish')"
        >
          Unpublish
        </button>
        <button
          type="button"
          class="btn btn-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          :disabled="bulkLoading"
          @click="confirmBulkDelete('archive')"
        >
          Archive
        </button>
        <button
          type="button"
          class="btn btn-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          :disabled="bulkLoading"
          @click="confirmBulkDelete('delete')"
        >
          Delete
        </button>
      </div>
    </div>
```

- [ ] **Step 3: Add the bulk delete confirmation dialog**

Add after the existing delete confirmation dialog:

```html
    <!-- Bulk Delete/Archive Confirmation -->
    <AdminUiAdminConfirmDialog
      v-model="showBulkDeleteDialog"
      :title="pendingBulkAction === 'archive' ? 'Archive Reports' : 'Delete Reports'"
      :message="`Are you sure you want to ${pendingBulkAction} ${selectedReports.length} report${selectedReports.length > 1 ? 's' : ''}? This action cannot be undone.`"
      :confirm-text="pendingBulkAction === 'archive' ? 'Archive' : 'Delete'"
      :loading="bulkLoading"
      @confirm="handleBulkDelete"
    />
```

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:3000/admin/reports` and confirm:
- Checkboxes appear on each row and in the header
- Selecting rows shows the bulk action bar with count
- "Select all" checkbox in header toggles all visible rows
- Publish/Unpublish execute immediately
- Archive/Delete show a confirmation dialog first
- After any action, selection clears and table refreshes
- Stats pills update after bulk publish/unpublish

- [ ] **Step 5: Commit**

```bash
git add pages/admin/reports/index.vue
git commit -m "feat(admin): add bulk actions (publish/unpublish/archive/delete) to reports page"
```

---

### Task 7: Typecheck and Lint

**Files:**
- All modified files

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors. If there are type errors, fix them in the relevant files.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors. If there are lint errors, run `npm run lint:fix` and review changes.

- [ ] **Step 3: Run format check**

```bash
npm run format:check
```

Expected: No formatting issues. If there are issues, run `npx prettier --write` on the affected files.

- [ ] **Step 4: Run existing tests**

```bash
npm run test:run
```

Expected: All existing tests pass. No regressions.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix typecheck and lint issues from reports improvements"
```

Only create this commit if there were fixes needed. Skip if everything passed clean.

---

### Task 8: Manual Verification Checklist

- [ ] **Step 1: Full page walkthrough**

Open `http://localhost:3000/admin/reports` and verify each feature:

1. **Stats pills**: Three pills below the title show correct numbers
2. **Category badges**: Each category (financial, compliance, IT, performance, technical, follow-up, special) has a distinct color
3. **File size column**: Shows between Published and Status columns, values like "4.2 MB" or "—"
4. **Search**: Type a term in the search box — table filters, stats update
5. **Sorting**: Click Title, Category, Published, Status headers — arrow indicators appear, data reorders
6. **Bulk select**: Check rows, action bar appears; use Publish/Unpublish (immediate) and Archive/Delete (with dialog)
7. **Filters + sort combo**: Set a category filter, then sort by date — both work together
8. **Dark mode**: Toggle dark mode — all badges, pills, and action bar look correct
9. **Empty state**: Filter to something with no results — empty state shows correctly
10. **Pagination**: Navigate pages — selection clears on page change
