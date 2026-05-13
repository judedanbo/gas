# Admin Grid Views, File Modal & Event Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add grid/table view toggle to publications, news, and events admin index pages; generalize the report file modal for publications; fix event end-date validation.

**Architecture:** Generalize two report-specific components (`AdminReportCard` → `AdminEntityCard`, `AdminReportFileModal` → `AdminFileModal`) via props so they work for all entity types. Add a `fileSize` column to the publications DB table. Add cross-field `endDate > startDate` validation on both client and server.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Drizzle ORM (MySQL), Zod, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Rename+Modify | `components/admin/ui/AdminReportCard.vue` → `AdminEntityCard.vue` | Generic grid card for any entity |
| Modify | `pages/admin/reports/index.vue` | Switch to `AdminEntityCard`, keep existing behavior |
| Modify | `pages/admin/publications/index.vue` | Add view toggle + grid section |
| Modify | `pages/admin/news/index.vue` | Add view toggle + grid section |
| Modify | `pages/admin/events/index.vue` | Add view toggle + grid section |
| Rename+Modify | `components/admin/form/AdminReportFileModal.vue` → `AdminFileModal.vue` | Generic file modal with `resource` prop |
| Modify | `pages/admin/reports/create.vue` | Use renamed `AdminFileModal` |
| Modify | `pages/admin/reports/[id]/edit.vue` | Use renamed `AdminFileModal` |
| Modify | `pages/admin/publications/create.vue` | Replace inline upload with file modal |
| Modify | `pages/admin/publications/[id]/edit.vue` | Replace inline upload with file modal |
| Create | `server/api/admin/publications/generate-thumbnail.post.ts` | Publication thumbnail generation endpoint |
| Modify | `server/database/schema/publications.ts` | Add `fileSize` column |
| Modify | `server/utils/validation.ts` | Add `fileSize` to publication schema; add `superRefine` to event schema |
| Modify | `types/admin.ts` | Add `fileSize` to `PublicationInput` |
| Modify | `server/api/admin/publications/index.ts` | Handle `fileSize` in create |
| Modify | `server/api/admin/publications/[id].ts` | Handle `fileSize` in update |
| Modify | `pages/admin/events/create.vue` | Wire endDate error + validation rule |
| Modify | `pages/admin/events/[id]/edit.vue` | Wire endDate error + validation rule |
| Rename+Modify | `tests/unit/components/admin/form/AdminReportFileModal.test.ts` → `AdminFileModal.test.ts` | Update test for renamed component |

---

### Task 1: Generalize AdminReportCard → AdminEntityCard

**Files:**
- Rename: `components/admin/ui/AdminReportCard.vue` → `components/admin/ui/AdminEntityCard.vue`
- Modify: `pages/admin/reports/index.vue`

- [ ] **Step 1: Rename the component file**

```bash
cd ghana-audit-service
git mv components/admin/ui/AdminReportCard.vue components/admin/ui/AdminEntityCard.vue
```

- [ ] **Step 2: Rewrite AdminEntityCard.vue with generic props**

Replace the entire contents of `components/admin/ui/AdminEntityCard.vue` with:

```vue
<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 dark:bg-gray-800"
    :class="
      selected
        ? 'border-primary ring-2 ring-primary/20'
        : 'border-gray-200 hover:border-primary/40 hover:shadow-md dark:border-gray-700'
    "
  >
    <div
      class="relative bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
      @click="$emit('click')"
    >
      <div class="aspect-[3/2] w-full">
        <img
          :src="thumbnail || '/img/reports/default-cover.svg'"
          alt=""
          class="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>

      <label
        class="absolute top-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 bg-white/90 backdrop-blur-sm transition-colors cursor-pointer"
        :class="
          selected
            ? 'border-primary bg-primary text-white'
            : 'border-gray-300 hover:border-primary dark:border-gray-500 dark:bg-gray-800/90'
        "
        @click.stop
      >
        <input
          type="checkbox"
          class="sr-only"
          :checked="selected"
          @change="$emit('toggle-select')"
        />
        <svg
          v-if="selected"
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </label>

      <span
        class="absolute top-2 right-2 z-10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shadow-sm"
        :class="
          isPublished
            ? 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
        "
      >
        {{ isPublished ? 'Published' : 'Draft' }}
      </span>
    </div>

    <div class="flex flex-1 flex-col p-4">
      <h3
        class="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-white cursor-pointer hover:text-primary transition-colors"
        :title="title"
        @click="$emit('click')"
      >
        {{ title }}
      </h3>

      <div v-if="badgeLabel" class="mb-3">
        <span
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          :class="badgeClass"
        >
          {{ badgeLabel }}
        </span>
      </div>

      <div
        v-if="metadata.length > 0"
        class="mt-auto flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
      >
        <span v-for="(item, i) in metadata" :key="i">{{ item }}</span>
      </div>

      <div class="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <NuxtLink
          :to="editUrl"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-primary"
          @click.stop
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Edit
        </NuxtLink>
        <button
          type="button"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          @click.stop="$emit('delete')"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Delete
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
  defineProps<{
    title: string
    thumbnail: string | null
    selected: boolean
    editUrl: string
    badgeLabel: string | null
    badgeClass: string
    metadata: string[]
    isPublished: boolean
  }>()

  defineEmits<{
    click: []
    'toggle-select': []
    delete: []
  }>()
</script>
```

- [ ] **Step 3: Update reports index to use AdminEntityCard**

In `pages/admin/reports/index.vue`, replace the grid card usage. Change line 268-277 from:

```vue
          <AdminUiAdminReportCard
            v-for="report in items"
            :key="report.id"
            :report="report"
            :selected="isSelected(report)"
            :category-class="categoryStyles[report.category] || 'bg-gray-100 text-gray-700'"
            @click="handleRowClick(report)"
            @toggle-select="toggleCardSelect(report)"
            @delete="confirmDelete(report)"
          />
```

to:

```vue
          <AdminUiAdminEntityCard
            v-for="report in items"
            :key="report.id"
            :title="report.translations?.en?.title || 'Untitled'"
            :thumbnail="report.thumbnail"
            :selected="isSelected(report)"
            :edit-url="`/admin/reports/${report.id}/edit`"
            :badge-label="report.category?.replace('-', ' ') || null"
            :badge-class="categoryStyles[report.category] || 'bg-gray-100 text-gray-700'"
            :metadata="formatReportMeta(report)"
            :is-published="report.isPublished"
            @click="handleRowClick(report)"
            @toggle-select="toggleCardSelect(report)"
            @delete="confirmDelete(report)"
          />
```

Add the `formatReportMeta` helper in `<script setup>` (in the existing script section, after the `categoryStyles` definition):

```ts
  function formatFileSize(value: unknown): string {
    if (!value) return ''
    const str = String(value)
    if (str.includes('MB') || str.includes('KB') || str.includes('GB')) return str
    const bytes = Number(str)
    if (isNaN(bytes) || bytes === 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  function formatReportMeta(report: AdminAuditReport): string[] {
    const meta: string[] = []
    if (report.publishedAt) meta.push(new Date(report.publishedAt).toLocaleDateString())
    const size = formatFileSize(report.fileSize)
    if (size) meta.push(size)
    return meta
  }
```

- [ ] **Step 4: Run typecheck to verify**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: PASS with no errors related to `AdminReportCard` or `AdminEntityCard`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): generalize AdminReportCard into AdminEntityCard

Rename AdminReportCard to AdminEntityCard with generic props (title,
thumbnail, badgeLabel, metadata, etc.) instead of report-specific
AdminAuditReport type. Reports index page maps report fields to the
new generic props."
```

---

### Task 2: Add grid/table view toggle to publications index

**Files:**
- Modify: `pages/admin/publications/index.vue`

- [ ] **Step 1: Add view toggle buttons and viewMode state**

In `pages/admin/publications/index.vue`, replace the page header `<div>` (lines 3-21) with:

```vue
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Publications</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Manage publications and documents</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          <button
            type="button"
            class="rounded-md p-2 transition-colors"
            :class="
              viewMode === 'table'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            "
            title="Table view"
            @click="viewMode = 'table'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            class="rounded-md p-2 transition-colors"
            :class="
              viewMode === 'grid'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            "
            title="Grid view"
            @click="viewMode = 'grid'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
        <NuxtLink to="/admin/publications/create" class="btn btn-primary inline-flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Publication
        </NuxtLink>
      </div>
    </div>
```

- [ ] **Step 2: Wrap existing data table in v-if and add grid section**

Wrap the existing `<AdminUiAdminDataTable>` with `v-if="viewMode === 'table'"`.

Then add this grid section right after the closing `</AdminUiAdminDataTable>` tag (before the `AdminUiAdminConfirmDialog`):

```vue
    <!-- Grid View -->
    <div v-if="viewMode === 'grid'">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>

      <div v-else-if="items.length === 0">
        <AdminUiAdminEmptyState
          title="No publications found"
          description="Get started by creating your first publication."
          action-to="/admin/publications/create"
          action-label="Add Publication"
        />
      </div>

      <template v-else>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AdminUiAdminEntityCard
            v-for="pub in items"
            :key="pub.id"
            :title="pub.translations?.en?.title || 'Untitled'"
            :thumbnail="pub.thumbnail"
            :selected="false"
            :edit-url="`/admin/publications/${pub.id}/edit`"
            :badge-label="pub.type?.replace(/-/g, ' ') || null"
            :badge-class="typeStyles[pub.type] || 'bg-gray-100 text-gray-700'"
            :metadata="formatPubMeta(pub)"
            :is-published="pub.isPublished"
            @click="navigateTo(`/admin/publications/${pub.id}/edit`)"
            @toggle-select="() => {}"
            @delete="confirmDelete(pub)"
          />
        </div>

        <div class="mt-6 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {{ (meta.page - 1) * meta.perPage + 1 }} to
            {{ Math.min(meta.page * meta.perPage, meta.total) }} of {{ meta.total }} results
          </span>
          <AdminUiAdminPagination
            v-if="meta.lastPage > 1"
            :current-page="meta.page"
            :last-page="meta.lastPage"
            @page-change="handlePageChange"
          />
        </div>
      </template>
    </div>
```

- [ ] **Step 3: Add viewMode state and helpers to script**

Add these to the `<script setup>` section:

```ts
  // View mode
  const viewMode = ref<'table' | 'grid'>(
    (typeof localStorage !== 'undefined' &&
      (localStorage.getItem('admin-publications-view') as 'table' | 'grid')) ||
      'table'
  )
  watch(viewMode, (v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('admin-publications-view', v)
  })

  const typeStyles: Record<string, string> = {
    'press-statement': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    bulletin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    guideline: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    manual: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    strategy: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    law: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  }

  function formatPubMeta(pub: AdminPublication): string[] {
    const meta: string[] = []
    if (pub.publishedAt) meta.push(new Date(pub.publishedAt).toLocaleDateString())
    return meta
  }
```

- [ ] **Step 4: Run typecheck**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pages/admin/publications/index.vue
git commit -m "feat(admin): add grid/table view toggle to publications index"
```

---

### Task 3: Add grid/table view toggle to news index

**Files:**
- Modify: `pages/admin/news/index.vue`

- [ ] **Step 1: Add view toggle to page header**

In `pages/admin/news/index.vue`, replace the header `<div>` (lines 3-19) with:

```vue
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">News Articles</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Manage news and announcements</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          <button
            type="button"
            class="rounded-md p-2 transition-colors"
            :class="
              viewMode === 'table'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            "
            title="Table view"
            @click="viewMode = 'table'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            class="rounded-md p-2 transition-colors"
            :class="
              viewMode === 'grid'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            "
            title="Grid view"
            @click="viewMode = 'grid'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
        <NuxtLink to="/admin/news/create" class="btn btn-primary inline-flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Article
        </NuxtLink>
      </div>
    </div>
```

- [ ] **Step 2: Wrap data table in v-if and add grid section**

Add `v-if="viewMode === 'table'"` to the `<AdminUiAdminDataTable>`.

Add this grid section after the closing `</AdminUiAdminDataTable>` tag (before `AdminUiAdminConfirmDialog`):

```vue
    <!-- Grid View -->
    <div v-if="viewMode === 'grid'">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>

      <div v-else-if="items.length === 0">
        <AdminUiAdminEmptyState
          title="No articles found"
          description="Get started by creating your first news article."
          action-to="/admin/news/create"
          action-label="Add Article"
        />
      </div>

      <template v-else>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AdminUiAdminEntityCard
            v-for="article in items"
            :key="article.id"
            :title="article.translations?.en?.title || 'Untitled'"
            :thumbnail="article.thumbnail"
            :selected="false"
            :edit-url="`/admin/news/${article.id}/edit`"
            :badge-label="article.author || null"
            :badge-class="'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
            :metadata="formatNewsMeta(article)"
            :is-published="article.isPublished"
            @click="navigateTo(`/admin/news/${article.id}/edit`)"
            @toggle-select="() => {}"
            @delete="confirmDelete(article)"
          />
        </div>

        <div class="mt-6 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {{ (meta.page - 1) * meta.perPage + 1 }} to
            {{ Math.min(meta.page * meta.perPage, meta.total) }} of {{ meta.total }} results
          </span>
          <AdminUiAdminPagination
            v-if="meta.lastPage > 1"
            :current-page="meta.page"
            :last-page="meta.lastPage"
            @page-change="handlePageChange"
          />
        </div>
      </template>
    </div>
```

- [ ] **Step 3: Add viewMode state and helper to script**

Add to `<script setup>`:

```ts
  // View mode
  const viewMode = ref<'table' | 'grid'>(
    (typeof localStorage !== 'undefined' &&
      (localStorage.getItem('admin-news-view') as 'table' | 'grid')) ||
      'table'
  )
  watch(viewMode, (v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('admin-news-view', v)
  })

  function formatNewsMeta(article: AdminNewsArticle): string[] {
    const meta: string[] = []
    if (article.publishedAt) meta.push(new Date(article.publishedAt).toLocaleDateString())
    return meta
  }
```

- [ ] **Step 4: Run typecheck**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pages/admin/news/index.vue
git commit -m "feat(admin): add grid/table view toggle to news index"
```

---

### Task 4: Add grid/table view toggle to events index

**Files:**
- Modify: `pages/admin/events/index.vue`

- [ ] **Step 1: Add view toggle to page header**

In `pages/admin/events/index.vue`, replace the header `<div>` (lines 3-19) with:

```vue
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Manage events and schedules</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          <button
            type="button"
            class="rounded-md p-2 transition-colors"
            :class="
              viewMode === 'table'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            "
            title="Table view"
            @click="viewMode = 'table'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            class="rounded-md p-2 transition-colors"
            :class="
              viewMode === 'grid'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            "
            title="Grid view"
            @click="viewMode = 'grid'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
        <NuxtLink to="/admin/events/create" class="btn btn-primary inline-flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </NuxtLink>
      </div>
    </div>
```

- [ ] **Step 2: Wrap data table in v-if and add grid section**

Add `v-if="viewMode === 'table'"` to the `<AdminUiAdminDataTable>`.

Add this grid section after `</AdminUiAdminDataTable>` (before `AdminUiAdminConfirmDialog`):

```vue
    <!-- Grid View -->
    <div v-if="viewMode === 'grid'">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>

      <div v-else-if="items.length === 0">
        <AdminUiAdminEmptyState
          title="No events found"
          description="Get started by creating your first event."
          action-to="/admin/events/create"
          action-label="Add Event"
        />
      </div>

      <template v-else>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AdminUiAdminEntityCard
            v-for="evt in items"
            :key="evt.id"
            :title="evt.translations?.en?.title || 'Untitled'"
            :thumbnail="evt.thumbnail"
            :selected="false"
            :edit-url="`/admin/events/${evt.id}/edit`"
            :badge-label="evt.isVirtual ? 'Virtual' : 'In-Person'"
            :badge-class="evt.isVirtual ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'"
            :metadata="formatEventMeta(evt)"
            :is-published="evt.isPublished"
            @click="navigateTo(`/admin/events/${evt.id}/edit`)"
            @toggle-select="() => {}"
            @delete="confirmDelete(evt)"
          />
        </div>

        <div class="mt-6 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {{ (meta.page - 1) * meta.perPage + 1 }} to
            {{ Math.min(meta.page * meta.perPage, meta.total) }} of {{ meta.total }} results
          </span>
          <AdminUiAdminPagination
            v-if="meta.lastPage > 1"
            :current-page="meta.page"
            :last-page="meta.lastPage"
            @page-change="handlePageChange"
          />
        </div>
      </template>
    </div>
```

- [ ] **Step 3: Add viewMode state and helper to script**

Add to `<script setup>`:

```ts
  // View mode
  const viewMode = ref<'table' | 'grid'>(
    (typeof localStorage !== 'undefined' &&
      (localStorage.getItem('admin-events-view') as 'table' | 'grid')) ||
      'table'
  )
  watch(viewMode, (v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('admin-events-view', v)
  })

  function formatEventMeta(evt: AdminEvent): string[] {
    const meta: string[] = []
    if (evt.startDate) meta.push(new Date(evt.startDate).toLocaleDateString())
    const location = evt.translations?.en?.location
    if (location) meta.push(location)
    return meta
  }
```

- [ ] **Step 4: Run typecheck**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pages/admin/events/index.vue
git commit -m "feat(admin): add grid/table view toggle to events index"
```

---

### Task 5: Generalize AdminReportFileModal → AdminFileModal

**Files:**
- Rename: `components/admin/form/AdminReportFileModal.vue` → `AdminFileModal.vue`
- Rename: `tests/unit/components/admin/form/AdminReportFileModal.test.ts` → `AdminFileModal.test.ts`
- Modify: `pages/admin/reports/create.vue`
- Modify: `pages/admin/reports/[id]/edit.vue`

- [ ] **Step 1: Rename the component and test files**

```bash
cd ghana-audit-service
git mv components/admin/form/AdminReportFileModal.vue components/admin/form/AdminFileModal.vue
git mv tests/unit/components/admin/form/AdminReportFileModal.test.ts tests/unit/components/admin/form/AdminFileModal.test.ts
```

- [ ] **Step 2: Add resource and label props to AdminFileModal**

In `components/admin/form/AdminFileModal.vue`, update the props interface and defaults. Replace lines 308-322:

```typescript
  interface Props {
    resource: 'reports' | 'publications'
    label?: string
    fileUrl?: string | null
    fileSize?: number | null
    thumbnail?: string | null
    error?: string
    required?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    label: 'File',
    fileUrl: null,
    fileSize: null,
    thumbnail: null,
    error: undefined,
    required: false
  })
```

- [ ] **Step 3: Update template text and upload type**

In the same file, make these changes:

1. Replace the `AdminFormGroup` label (line 6) — change `label="Report File"` to `:label="label"`.

2. Replace the "Attach Report" text (line 42) — change `Attach Report` to `Attach {{ label }}`.

3. Replace the modal title (line 90) — change `title="Report File"` to `:title="label"`.

4. Replace the upload type (line 97) — change `type="report"` to `:type="resource === 'reports' ? 'report' : 'publication'"`.

5. Replace the max size text (line 44) — change `PDF files (max 10 MB)` to `PDF files`.

- [ ] **Step 4: Update thumbnail generation endpoint**

Replace the hard-coded `reports/generate-thumbnail` call in the `generateThumbnail` function (line 394). Change:

```typescript
      const result = await api.post<{ success: boolean; thumbnailUrl: string }>(
        'reports/generate-thumbnail',
        { fileUrl: modalFileUrl.value }
      )
```

to:

```typescript
      const result = await api.post<{ success: boolean; thumbnailUrl: string }>(
        `${props.resource}/generate-thumbnail`,
        { fileUrl: modalFileUrl.value }
      )
```

- [ ] **Step 5: Update reports create page to use renamed component**

In `pages/admin/reports/create.vue`, replace line 50-59:

```vue
            <AdminFormAdminReportFileModal
              :file-url="form.fileUrl"
              :file-size="form.fileSize"
              :thumbnail="form.thumbnail"
              :error="errors.fileUrl"
              required
              @update:file-url="form.fileUrl = $event"
              @update:file-size="form.fileSize = $event"
              @update:thumbnail="form.thumbnail = $event"
            />
```

with:

```vue
            <AdminFormAdminFileModal
              resource="reports"
              label="Report File"
              :file-url="form.fileUrl"
              :file-size="form.fileSize"
              :thumbnail="form.thumbnail"
              :error="errors.fileUrl"
              required
              @update:file-url="form.fileUrl = $event"
              @update:file-size="form.fileSize = $event"
              @update:thumbnail="form.thumbnail = $event"
            />
```

- [ ] **Step 6: Update reports edit page to use renamed component**

In `pages/admin/reports/[id]/edit.vue`, replace line 107-116:

```vue
              <AdminFormAdminReportFileModal
                :file-url="form.fileUrl"
                :file-size="form.fileSize"
                :thumbnail="form.thumbnail"
                :error="errors.fileUrl"
                required
                @update:file-url="form.fileUrl = $event"
                @update:file-size="form.fileSize = $event"
                @update:thumbnail="form.thumbnail = $event"
              />
```

with:

```vue
              <AdminFormAdminFileModal
                resource="reports"
                label="Report File"
                :file-url="form.fileUrl"
                :file-size="form.fileSize"
                :thumbnail="form.thumbnail"
                :error="errors.fileUrl"
                required
                @update:file-url="form.fileUrl = $event"
                @update:file-size="form.fileSize = $event"
                @update:thumbnail="form.thumbnail = $event"
              />
```

- [ ] **Step 7: Update test file**

In `tests/unit/components/admin/form/AdminFileModal.test.ts`, change the describe block name (line 70) from `'AdminReportFileModal'` to `'AdminFileModal'`.

- [ ] **Step 8: Run typecheck and tests**

```bash
cd ghana-audit-service && npm run typecheck && npm run test:run tests/unit/components/admin/form/AdminFileModal.test.ts
```

Expected: Both PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(admin): generalize AdminReportFileModal into AdminFileModal

Add resource and label props to support both reports and publications.
Upload type and thumbnail generation endpoint are derived from the
resource prop. Reports pages updated to pass resource='reports'."
```

---

### Task 6: Add publication fileSize — DB schema, server validation, types

**Files:**
- Modify: `server/database/schema/publications.ts`
- Modify: `server/utils/validation.ts`
- Modify: `types/admin.ts`
- Modify: `server/api/admin/publications/index.ts`
- Modify: `server/api/admin/publications/[id].ts`

- [ ] **Step 1: Add fileSize column to publications DB schema**

In `server/database/schema/publications.ts`, add the `fileSize` column after line 34 (`fileUrl`):

```typescript
    fileSize: varchar('file_size', { length: 50 }),
```

(Add the `fileSize` line between the `fileUrl` and `thumbnail` lines.)

- [ ] **Step 2: Add fileSize to publication Zod schema**

In `server/utils/validation.ts`, add `fileSize` to the `publicationSchema` (after the `fileUrl` line at line 86):

```typescript
  fileSize: z.coerce.number().optional().nullable(),
```

- [ ] **Step 3: Add fileSize to PublicationInput type**

In `types/admin.ts`, add to the `PublicationInput` interface (after line 397 `fileUrl`):

```typescript
  fileSize?: number | null
```

- [ ] **Step 4: Handle fileSize in publication create endpoint**

In `server/api/admin/publications/index.ts`, update the INSERT SQL (lines 126-138). Change:

```typescript
    const [result] = await connection.execute(
      `INSERT INTO publications (slug, type, published_at, file_url, thumbnail, is_published, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.type,
        new Date(input.publishedAt),
        input.fileUrl || null,
        input.thumbnail || null,
        input.isPublished,
        user.id,
        user.id
      ]
    )
```

to:

```typescript
    const [result] = await connection.execute(
      `INSERT INTO publications (slug, type, published_at, file_url, file_size, thumbnail, is_published, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.type,
        new Date(input.publishedAt),
        input.fileUrl || null,
        input.fileSize || null,
        input.thumbnail || null,
        input.isPublished,
        user.id,
        user.id
      ]
    )
```

- [ ] **Step 5: Handle fileSize in publication update endpoint**

In `server/api/admin/publications/[id].ts`, update the UPDATE SQL (lines 106-117). Change:

```typescript
    await connection.execute(
      `UPDATE publications SET slug = ?, type = ?, published_at = ?, file_url = ?, thumbnail = ?, is_published = ?, updated_by = ? WHERE id = ?`,
      [
        input.slug,
        input.type,
        new Date(input.publishedAt),
        input.fileUrl || null,
        input.thumbnail || null,
        input.isPublished,
        user.id,
        id
      ]
    )
```

to:

```typescript
    await connection.execute(
      `UPDATE publications SET slug = ?, type = ?, published_at = ?, file_url = ?, file_size = ?, thumbnail = ?, is_published = ?, updated_by = ? WHERE id = ?`,
      [
        input.slug,
        input.type,
        new Date(input.publishedAt),
        input.fileUrl || null,
        input.fileSize || null,
        input.thumbnail || null,
        input.isPublished,
        user.id,
        id
      ]
    )

- [ ] **Step 6: Run DB migration**

```bash
cd ghana-audit-service && npm run db:generate && npm run db:migrate
```

- [ ] **Step 7: Run typecheck**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(admin): add fileSize column to publications

Add file_size varchar column to publications table, update Zod schema,
TypeScript types, and create/update API handlers."
```

---

### Task 7: Create publications thumbnail generation endpoint

**Files:**
- Create: `server/api/admin/publications/generate-thumbnail.post.ts`

- [ ] **Step 1: Create the endpoint**

Create `server/api/admin/publications/generate-thumbnail.post.ts`:

```typescript
import { requirePermission } from '../../../utils/adminHelpers'
import { resolvePublicAsset } from '../../../utils/publicFiles'
import { generateThumbnailFromPdf } from '../../../utils/generateThumbnail'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')

  const body = await readBody<{ fileUrl?: string }>(event)
  const fileUrl = body?.fileUrl

  if (!fileUrl || typeof fileUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'fileUrl is required' })
  }

  if (!fileUrl.startsWith('/uploads/publications/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
  }

  const pdfPath = resolvePublicAsset(fileUrl)
  if (!pdfPath) {
    throw createError({ statusCode: 422, statusMessage: 'PDF file not found' })
  }

  const thumbnailUrl = generateThumbnailFromPdf(pdfPath)
  if (!thumbnailUrl) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
    })
  }

  return { success: true, thumbnailUrl }
})
```

- [ ] **Step 2: Commit**

```bash
git add server/api/admin/publications/generate-thumbnail.post.ts
git commit -m "feat(admin): add publications thumbnail generation endpoint"
```

---

### Task 8: Integrate file modal into publication create/edit pages

**Files:**
- Modify: `pages/admin/publications/create.vue`
- Modify: `pages/admin/publications/[id]/edit.vue`

- [ ] **Step 1: Update publication create page**

In `pages/admin/publications/create.vue`, replace the Document section (lines 41-49):

```vue
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Document</h2>
            <AdminFormAdminFileUpload
              v-model="form.fileUrl"
              type="publication"
              label="PDF File"
              :error="errors.fileUrl"
            />
          </div>
```

with:

```vue
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Document</h2>
            <AdminFormAdminFileModal
              resource="publications"
              label="Publication File"
              :file-url="form.fileUrl"
              :file-size="form.fileSize"
              :thumbnail="form.thumbnail"
              :error="errors.fileUrl"
              @update:file-url="form.fileUrl = $event"
              @update:file-size="form.fileSize = $event"
              @update:thumbnail="form.thumbnail = $event"
            />
          </div>
```

Also remove the standalone Thumbnail section (lines 133-140):

```vue
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thumbnail</h2>
            <AdminFormAdminFileUpload
              v-model="form.thumbnail"
              type="thumbnail"
              label="Cover Image"
            />
          </div>
```

Remove that entire `<div>` block (thumbnail is now handled inside the file modal).

- [ ] **Step 2: Add fileSize to form reactive**

In the `<script setup>`, update the `form` reactive (line 178-186). Add `fileSize`:

```typescript
  const form = reactive<PublicationInput>({
    slug: '',
    type: 'press-statement',
    fileUrl: '',
    fileSize: undefined,
    thumbnail: '',
    isPublished: false,
    publishedAt: '',
    translations: { en: { title: '', excerpt: '', content: '' } }
  })
```

- [ ] **Step 3: Update publication edit page — replace file upload section**

In `pages/admin/publications/[id]/edit.vue`, replace the Document section (lines 53-61):

```vue
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Document</h2>
              <AdminFormAdminFileUpload
                v-model="form.fileUrl"
                type="publication"
                label="PDF File"
                :error="errors.fileUrl"
              />
            </div>
```

with:

```vue
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Document</h2>
              <AdminFormAdminFileModal
                resource="publications"
                label="Publication File"
                :file-url="form.fileUrl"
                :file-size="form.fileSize"
                :thumbnail="form.thumbnail"
                :error="errors.fileUrl"
                @update:file-url="form.fileUrl = $event"
                @update:file-size="form.fileSize = $event"
                @update:thumbnail="form.thumbnail = $event"
              />
            </div>
```

Also remove the standalone Thumbnail section (lines 145-152):

```vue
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thumbnail</h2>
              <AdminFormAdminFileUpload
                v-model="form.thumbnail"
                type="thumbnail"
                label="Cover Image"
              />
            </div>
```

- [ ] **Step 4: Add fileSize to edit form reactive and onMounted**

In the `<script setup>`, update the form reactive (line 195-203). Add `fileSize`:

```typescript
  const form = reactive<PublicationInput>({
    slug: '',
    type: 'press-statement',
    fileUrl: '',
    fileSize: undefined,
    thumbnail: '',
    isPublished: false,
    publishedAt: '',
    translations: { en: { title: '', excerpt: '', content: '' } }
  })
```

In the `onMounted` callback (around line 291-301), add after `form.fileUrl = item.fileUrl || ''`:

```typescript
      form.fileSize = (item as any).fileSize || undefined
```

- [ ] **Step 5: Run typecheck**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add pages/admin/publications/create.vue pages/admin/publications/\[id\]/edit.vue
git commit -m "feat(admin): integrate file modal into publication create/edit pages

Replace inline file upload and standalone thumbnail upload with the
generalized AdminFileModal component. Publications now get inline PDF
preview and auto-generated thumbnails like reports."
```

---

### Task 9: Fix event endDate validation — client + server

**Files:**
- Modify: `pages/admin/events/create.vue`
- Modify: `pages/admin/events/[id]/edit.vue`
- Modify: `server/utils/validation.ts`

- [ ] **Step 1: Wire endDate error display on create page**

In `pages/admin/events/create.vue`, replace lines 114-118:

```vue
              <AdminFormAdminDatePicker
                v-model="form.endDate"
                label="End Date"
                type="datetime-local"
              />
```

with:

```vue
              <AdminFormAdminDatePicker
                v-model="form.endDate"
                label="End Date"
                type="datetime-local"
                :error="errors.endDate"
              />
```

- [ ] **Step 2: Add endDate validation rule on create page**

In the `validationRules` object (lines 187-192), add the `endDate` rule:

```typescript
  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required],
    startDate: [rules.required],
    registrationUrl: [rules.url],
    endDate: [
      (value: unknown) => {
        if (!value) return true
        if (!form.startDate) return true
        const end = Date.parse(String(value))
        const start = Date.parse(form.startDate)
        if (isNaN(end)) return 'Invalid date'
        return end > start || 'End date must be after start date'
      }
    ]
  }
```

- [ ] **Step 3: Wire endDate error display on edit page**

In `pages/admin/events/[id]/edit.vue`, replace lines 126-130:

```vue
                <AdminFormAdminDatePicker
                  v-model="form.endDate"
                  label="End Date"
                  type="datetime-local"
                />
```

with:

```vue
                <AdminFormAdminDatePicker
                  v-model="form.endDate"
                  label="End Date"
                  type="datetime-local"
                  :error="errors.endDate"
                />
```

- [ ] **Step 4: Add endDate validation rule on edit page**

In the `validationRules` object (lines 200-205), add the `endDate` rule:

```typescript
  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required],
    startDate: [rules.required],
    registrationUrl: [rules.url],
    endDate: [
      (value: unknown) => {
        if (!value) return true
        if (!form.startDate) return true
        const end = Date.parse(String(value))
        const start = Date.parse(form.startDate)
        if (isNaN(end)) return 'Invalid date'
        return end > start || 'End date must be after start date'
      }
    ]
  }
```

- [ ] **Step 5: Add server-side superRefine to eventSchema**

In `server/utils/validation.ts`, replace the `eventSchema` (lines 113-130):

```typescript
export const eventSchema = z.object({
  slug: slugSchema,
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  endDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date')
    .optional()
    .nullable(),
  isVirtual: z.boolean().default(false),
  registrationUrl: z.string().max(500).optional().nullable(),
  thumbnail: z.string().max(500).optional().nullable(),
  isPublished: z.boolean().default(false),
  translations: translationsSchema({
    title: z.string().min(1).max(500),
    description: z.string().optional().nullable(),
    location: z.string().max(500).optional().nullable()
  })
})
```

with:

```typescript
export const eventSchema = z
  .object({
    slug: slugSchema,
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid date')
      .optional()
      .nullable(),
    isVirtual: z.boolean().default(false),
    registrationUrl: z.string().max(500).optional().nullable(),
    thumbnail: z.string().max(500).optional().nullable(),
    isPublished: z.boolean().default(false),
    translations: translationsSchema({
      title: z.string().min(1).max(500),
      description: z.string().optional().nullable(),
      location: z.string().max(500).optional().nullable()
    })
  })
  .superRefine((data, ctx) => {
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

- [ ] **Step 6: Run typecheck and tests**

```bash
cd ghana-audit-service && npm run typecheck && npm run test:run
```

Expected: Both PASS.

- [ ] **Step 7: Commit**

```bash
git add pages/admin/events/create.vue pages/admin/events/\[id\]/edit.vue server/utils/validation.ts
git commit -m "fix(admin): wire endDate validation on event create/edit forms

Add :error binding to endDate date picker so validation errors display.
Add client-side cross-field validation (endDate must be after startDate).
Add server-side superRefine to eventSchema for the same check."
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full quality gate**

```bash
cd ghana-audit-service && npm run lint && npm run typecheck && npm run test:run
```

Expected: All PASS.

- [ ] **Step 2: Manual smoke test**

Start the dev server (`npm run dev`) and verify in the browser:

1. `/admin/reports` — grid/table toggle works, cards render correctly
2. `/admin/publications` — grid/table toggle works, cards show type badge
3. `/admin/news` — grid/table toggle works, cards show author badge
4. `/admin/events` — grid/table toggle works, cards show Virtual/In-Person
5. `/admin/publications/create` — file modal opens, PDF upload works, thumbnail generates
6. `/admin/events/create` — set endDate before startDate, submit → error shows under field
7. `/admin/events/create` — leave endDate empty, submit → no error for endDate
