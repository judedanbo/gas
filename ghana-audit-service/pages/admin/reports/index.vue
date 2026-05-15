<template>
  <div>
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">A-G Reports</h1>
        <div class="flex flex-wrap gap-2 mt-2">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          >
            {{ counts.total }} total
          </span>
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          >
            {{ counts.published }} published
          </span>
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          >
            {{ counts.drafts }} drafts
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <!-- View Toggle -->
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
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
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
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
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
    </div>

    <!-- Filters -->
    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search reports..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.category" class="form-input text-sm">
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat.value" :value="cat.value">
            {{ cat.label }}
          </option>
        </select>
        <select v-model="filters.year" class="form-input text-sm">
          <option value="">All Years</option>
          <option v-for="year in years" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
        <select v-model="filters.isPublished" class="form-input text-sm">
          <option value="">All Status</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
      </template>
    </AdminUiAdminSearchFilter>

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

    <!-- Data Table -->
    <AdminUiAdminDataTable
      v-if="viewMode === 'table'"
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
      <template #[`cell-translations.en.title`]="{ row }">
        <div class="max-w-xs">
          <p class="font-medium text-gray-900 dark:text-white truncate">
            {{ row.translations?.en?.title || 'Untitled' }}
          </p>
          <p class="text-xs text-gray-500 truncate">
            {{ row.slug }}
          </p>
        </div>
      </template>

      <template #cell-category="{ value }">
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
          :class="categoryStyles[value as string] || 'bg-gray-100 text-gray-700'"
        >
          {{ (value as string)?.replace('-', ' ') }}
        </span>
      </template>

      <template #cell-isPublished="{ value }">
        <span :class="value ? 'badge badge-success' : 'badge badge-warning'">
          {{ value ? 'Published' : 'Draft' }}
        </span>
      </template>

      <template #cell-publishedAt="{ value }">
        {{ value ? new Date(value as string).toLocaleDateString() : '-' }}
      </template>

      <template #cell-fileSize="{ value }">
        <span class="text-gray-500 dark:text-gray-400 text-sm">
          {{ formatFileSize(value) }}
        </span>
      </template>

      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <NuxtLink
            :to="`/admin/reports/${row.id}/edit`"
            class="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Edit"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </NuxtLink>
          <button
            type="button"
            class="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Delete"
            @click.stop="confirmDelete(row)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </template>

      <template #empty>
        <AdminUiAdminEmptyState
          title="No reports found"
          description="Get started by creating your first audit report."
          action-to="/admin/reports/create"
          action-label="Add Report"
        />
      </template>
    </AdminUiAdminDataTable>

    <!-- Grid View -->
    <div v-if="viewMode === 'grid'">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        />
      </div>

      <div v-else-if="items.length === 0">
        <AdminUiAdminEmptyState
          title="No reports found"
          description="Get started by creating your first audit report."
          action-to="/admin/reports/create"
          action-label="Add Report"
        />
      </div>

      <template v-else>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AdminUiAdminEntityCard
            v-for="report in items"
            :key="report.id"
            :title="report.translations?.en?.title || 'Untitled'"
            :thumbnail="report.thumbnail"
            :selected="isSelected(report)"
            :edit-url="`/admin/reports/${report.id}/edit`"
            :badge-label="report.category?.replaceAll('-', ' ') || null"
            :badge-class="categoryStyles[report.category] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
            :metadata="formatReportMeta(report)"
            :is-published="report.isPublished"
            @click="handleRowClick(report)"
            @toggle-select="toggleCardSelect(report)"
            @delete="confirmDelete(report)"
          />
        </div>

        <!-- Grid Pagination -->
        <div
          class="mt-6 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"
        >
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

    <!-- Delete Confirmation -->
    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Report"
      :message="`Are you sure you want to delete '${itemToDelete?.translations?.en?.title}'? This action cannot be undone.`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />

    <!-- Bulk Delete/Archive Confirmation -->
    <AdminUiAdminConfirmDialog
      v-model="showBulkDeleteDialog"
      :title="pendingBulkAction === 'archive' ? 'Archive Reports' : 'Delete Reports'"
      :message="`Are you sure you want to ${pendingBulkAction} ${selectedReports.length} report${selectedReports.length > 1 ? 's' : ''}? This action cannot be undone.`"
      :confirm-text="pendingBulkAction === 'archive' ? 'Archive' : 'Delete'"
      :loading="bulkLoading"
      @confirm="handleBulkDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminAuditReport } from '~/types/admin'

  definePageMeta({
    layout: 'admin'
  })

  const { items, loading, deleting, meta, fetchAll, remove } =
    useAdminCrud<AdminAuditReport>('reports')

  // View mode
  const viewMode = ref<'table' | 'grid'>(
    (typeof localStorage !== 'undefined' &&
      (localStorage.getItem('admin-reports-view') as 'table' | 'grid')) ||
      'table'
  )
  watch(viewMode, (v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('admin-reports-view', v)
  })

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

  function formatFileSize(value: unknown): string {
    if (!value) return '—'
    const str = String(value)
    if (str.includes('MB') || str.includes('KB') || str.includes('GB')) return str
    const bytes = Number(str)
    if (isNaN(bytes)) return str
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  function formatReportMeta(report: AdminAuditReport): string[] {
    const meta: string[] = []
    if (report.publishedAt) meta.push(new Date(report.publishedAt).toLocaleDateString())
    const size = formatFileSize(report.fileSize)
    if (size && size !== '—') meta.push(size)
    return meta
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

  // Bulk actions
  const selectedReports = ref<AdminAuditReport[]>([])
  const bulkLoading = ref(false)
  const showBulkDeleteDialog = ref(false)
  const pendingBulkAction = ref<string | null>(null)

  function handleSelectionChange(selected: AdminAuditReport[]) {
    selectedReports.value = selected
  }

  function isSelected(report: AdminAuditReport): boolean {
    return selectedReports.value.some((r) => r.id === report.id)
  }

  function toggleCardSelect(report: AdminAuditReport) {
    if (isSelected(report)) {
      selectedReports.value = selectedReports.value.filter((r) => r.id !== report.id)
    } else {
      selectedReports.value = [...selectedReports.value, report]
    }
  }

  async function executeBulkAction(action: string) {
    if (selectedReports.value.length === 0) return

    bulkLoading.value = true
    try {
      const ids = selectedReports.value.map((r) => r.id)
      await api.post('reports/bulk', { action, ids })
      selectedReports.value = []
      await fetchData()
    } catch {
      // bulk action failed — selection is preserved so user can retry
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
