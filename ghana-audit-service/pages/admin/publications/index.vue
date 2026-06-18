<template>
  <div>
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
            aria-label="Table view"
            @click="viewMode = 'table'"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
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
            aria-label="Grid view"
            @click="viewMode = 'grid'"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
        </div>
        <NuxtLink
          to="/admin/publications/create"
          class="btn btn-primary inline-flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Publication
        </NuxtLink>
      </div>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search publications..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.type" class="form-input text-sm">
          <option value="">All Types</option>
          <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <select v-model="filters.isPublished" class="form-input text-sm">
          <option value="">All Status</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
      </template>
    </AdminUiAdminSearchFilter>

    <AdminUiAdminDataTable
      v-if="viewMode === 'table'"
      :columns="columns"
      :data="items"
      :loading="loading"
      :meta="meta"
      @page-change="handlePageChange"
      @row-click="(row) => navigateTo(`/admin/publications/${row.id}/edit`)"
    >
      <template #[`cell-translations.en.title`]="{ row }">
        <div class="max-w-xs">
          <p class="font-medium text-gray-900 dark:text-white truncate">
            {{ row.translations?.en?.title || 'Untitled' }}
          </p>
          <p class="text-xs text-gray-500 truncate">{{ row.slug }}</p>
        </div>
      </template>
      <template #cell-type="{ value }">
        <span class="badge badge-primary capitalize">{{
          (value as string)?.replace(/-/g, ' ')
        }}</span>
      </template>
      <template #cell-isPublished="{ value }">
        <span :class="value ? 'badge badge-success' : 'badge badge-warning'">{{
          value ? 'Published' : 'Draft'
        }}</span>
      </template>
      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <NuxtLink
            :to="`/admin/publications/${row.id}/edit`"
            aria-label="Edit"
            class="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
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
            aria-label="Delete"
            class="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
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
          title="No publications found"
          description="Get started by creating your first publication."
          action-to="/admin/publications/create"
          action-label="Add Publication"
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
            default-thumbnail="/img/publications/default-cover.png"
            :selected="false"
            :edit-url="`/admin/publications/${pub.id}/edit`"
            :badge-label="pub.type?.replaceAll('-', ' ') || null"
            :badge-class="
              typeStyles[pub.type] ||
              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            "
            :metadata="formatPubMeta(pub)"
            :is-published="pub.isPublished"
            @click="navigateTo(`/admin/publications/${pub.id}/edit`)"
            @toggle-select="() => {}"
            @delete="confirmDelete(pub)"
          />
        </div>

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

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Publication"
      :message="`Are you sure you want to delete '${itemToDelete?.translations?.en?.title}'?`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminPublication } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, deleting, meta, fetchAll, remove } =
    useAdminCrud<AdminPublication>('publications')

  const filters = reactive({ search: '', type: '', isPublished: '' })
  const hasActiveFilters = computed(
    () => !!filters.search || !!filters.type || !!filters.isPublished
  )
  function clearFilters() {
    filters.search = ''
    filters.type = ''
    filters.isPublished = ''
  }

  const types = [
    { value: 'press-statement', label: 'Press Statement' },
    { value: 'bulletin', label: 'Bulletin' },
    { value: 'guideline', label: 'Guideline' },
    { value: 'manual', label: 'Manual' },
    { value: 'strategy', label: 'Strategy' },
    { value: 'law', label: 'Law' }
  ]

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

  const columns = [
    { key: 'translations.en.title', label: 'Title', sortable: true },
    { key: 'type', label: 'Type', sortable: true, width: '150px' },
    { key: 'isPublished', label: 'Status', width: '120px' }
  ]

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminPublication | null>(null)

  function confirmDelete(item: AdminPublication) {
    itemToDelete.value = item
    showDeleteDialog.value = true
  }
  async function handleDelete() {
    if (itemToDelete.value && (await remove(itemToDelete.value.id))) {
      showDeleteDialog.value = false
      itemToDelete.value = null
    }
  }
  function handlePageChange(page: number) {
    fetchData({ page })
  }

  function fetchData(overrides: Record<string, string | number | boolean | undefined> = {}) {
    const params: Record<string, string | number | boolean | undefined> = {
      page: meta.value.page,
      perPage: 20,
      ...overrides
    }
    if (filters.search) params.search = filters.search
    if (filters.type) params.type = filters.type
    if (filters.isPublished) params.isPublished = filters.isPublished
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => fetchData())
</script>
