<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tenders</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Manage procurement tenders and bids</p>
      </div>
      <NuxtLink to="/admin/tenders/create" class="btn btn-primary inline-flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add Tender
      </NuxtLink>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search tenders..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.status" class="form-input text-sm">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="awarded">Awarded</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </template>
    </AdminUiAdminSearchFilter>

    <AdminUiAdminDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :meta="meta"
      @page-change="handlePageChange"
      @row-click="(row) => navigateTo(`/admin/tenders/${row.id}/edit`)"
    >
      <template #[`cell-translations.en.title`]="{ row }">
        <div class="max-w-xs">
          <p class="font-medium text-gray-900 dark:text-white truncate">
            {{ row.translations?.en?.title || 'Untitled' }}
          </p>
          <p class="text-xs text-gray-500">Ref: {{ row.referenceNumber }}</p>
        </div>
      </template>
      <template #cell-category="{ value }">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ value || '-' }}</span>
      </template>
      <template #cell-submissionDeadline="{ value }">
        <span :class="isExpired(value as string) ? 'text-red-600' : ''">{{
          value ? new Date(value as string).toLocaleDateString() : '-'
        }}</span>
      </template>
      <template #cell-status="{ value }">
        <span class="badge" :class="statusClass(value as TenderStatus)">{{
          formatStatus(value as TenderStatus)
        }}</span>
      </template>
      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <NuxtLink
            :to="`/admin/tenders/${row.id}/edit`"
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
      <template #empty
        ><AdminUiAdminEmptyState
          title="No tenders found"
          description="Get started by creating your first tender."
          action-to="/admin/tenders/create"
          action-label="Add Tender"
      /></template>
    </AdminUiAdminDataTable>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Tender"
      :message="`Are you sure you want to delete '${itemToDelete?.translations?.en?.title}'?`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminTender, TenderStatus } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, deleting, meta, fetchAll, remove } = useAdminCrud<AdminTender>('tenders')

  const filters = reactive({ search: '', status: '' })
  const hasActiveFilters = computed(() => !!filters.search || !!filters.status)
  function clearFilters() {
    filters.search = ''
    filters.status = ''
  }

  const columns = [
    { key: 'translations.en.title', label: 'Tender', sortable: true },
    { key: 'category', label: 'Category', width: '140px' },
    { key: 'submissionDeadline', label: 'Deadline', sortable: true, width: '120px' },
    { key: 'status', label: 'Status', width: '100px' }
  ]

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminTender | null>(null)

  function formatStatus(status: TenderStatus): string {
    const labels: Record<TenderStatus, string> = {
      open: 'Open',
      closed: 'Closed',
      awarded: 'Awarded',
      cancelled: 'Cancelled'
    }
    return labels[status] || status
  }

  function statusClass(status: TenderStatus): string {
    const classes: Record<TenderStatus, string> = {
      open: 'badge-success',
      closed: 'badge-secondary',
      awarded: 'badge-primary',
      cancelled: 'badge-warning'
    }
    return classes[status] || ''
  }

  function isExpired(deadline: string): boolean {
    return deadline ? new Date(deadline) < new Date() : false
  }

  function confirmDelete(item: AdminTender) {
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
    if (filters.status) params.status = filters.status
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => fetchData())
</script>
