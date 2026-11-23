<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Pop-ups</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Schedule an image and link to show when a page on the public site loads
        </p>
      </div>
      <NuxtLink to="/admin/popups/create" class="btn btn-primary inline-flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add Pop-up
      </NuxtLink>
    </div>

    <div
      v-if="liveCount > 1"
      role="status"
      class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200"
    >
      {{ liveCount }} pop-ups are live at the same time. Visitors only see one — the one that
      started most recently.
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search pop-ups..."
      :has-active-filters="!!filters.search"
      @clear-filters="filters.search = ''"
    />

    <AdminUiAdminDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :meta="meta"
      @page-change="(page) => fetchData({ page })"
      @row-click="(row) => navigateTo(`/admin/popups/${row.id}/edit`)"
    >
      <template #cell-title="{ row }">
        <div class="flex items-center gap-3 max-w-sm">
          <UiBaseImage
            :src="row.imageUrl"
            alt=""
            class="w-12 h-12 flex-shrink-0 object-cover rounded"
          />
          <div class="min-w-0">
            <p class="font-medium text-gray-900 dark:text-white truncate">{{ row.title }}</p>
            <p class="text-xs text-gray-500 truncate">{{ row.linkUrl || 'No link' }}</p>
          </div>
        </div>
      </template>
      <template #cell-startsAt="{ row }">
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ formatSchedule(row) }}
        </span>
      </template>
      <template #cell-displaySeconds="{ row }">
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ row.displaySeconds }}s · {{ row.isDismissible ? 'closable' : 'not closable' }}
        </span>
      </template>
      <template #cell-isActive="{ row }">
        <span class="badge" :class="STATUS[getPopupStatus(row)].class">
          {{ STATUS[getPopupStatus(row)].label }}
        </span>
      </template>
      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <NuxtLink
            :to="`/admin/popups/${row.id}/edit`"
            :aria-label="`Edit ${row.title}`"
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
            v-if="hasPermission('delete')"
            type="button"
            :aria-label="`Delete ${row.title}`"
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
          title="No pop-ups found"
          description="Create a pop-up to show an image and link when the site loads."
          action-to="/admin/popups/create"
          action-label="Add Pop-up"
        />
      </template>
    </AdminUiAdminDataTable>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Pop-up"
      :message="`Are you sure you want to delete '${itemToDelete?.title}'?`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminPopup } from '~/types/admin'
  import type { PopupStatus } from '~/utils/popupStatus'
  definePageMeta({ layout: 'admin' })

  const { items, loading, deleting, meta, fetchAll, remove } = useAdminCrud<AdminPopup>('popups')
  const { hasPermission } = useAdminAuth()

  const filters = reactive({ search: '' })

  const columns = [
    { key: 'title', label: 'Pop-up' },
    { key: 'startsAt', label: 'Schedule (GMT)', width: '260px' },
    { key: 'displaySeconds', label: 'Display', width: '160px' },
    { key: 'isActive', label: 'Status', width: '110px' }
  ]

  const STATUS: Record<PopupStatus, { label: string; class: string }> = {
    live: { label: 'Live', class: 'badge-success' },
    scheduled: { label: 'Scheduled', class: 'badge-info' },
    ended: { label: 'Ended', class: 'badge-gray' },
    inactive: { label: 'Inactive', class: 'badge-warning' }
  }

  const liveCount = computed(
    () => items.value.filter((item) => getPopupStatus(item) === 'live').length
  )

  // Schedule times are entered and stored as GMT (Ghana time), so show them
  // that way whatever the admin's own device is set to.
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  })

  function formatSchedule(popup: AdminPopup): string {
    const start = popup.startsAt ? dateFormat.format(new Date(popup.startsAt)) : null
    const end = popup.endsAt ? dateFormat.format(new Date(popup.endsAt)) : null
    if (start && end) return `${start} – ${end}`
    if (start) return `From ${start}`
    if (end) return `Until ${end}`
    return 'Always'
  }

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminPopup | null>(null)

  function confirmDelete(item: AdminPopup) {
    itemToDelete.value = item
    showDeleteDialog.value = true
  }

  async function handleDelete() {
    if (itemToDelete.value && (await remove(itemToDelete.value.id))) {
      showDeleteDialog.value = false
      itemToDelete.value = null
    }
  }

  function fetchData(overrides: Record<string, string | number | boolean | undefined> = {}) {
    const params: Record<string, string | number | boolean | undefined> = {
      page: meta.value.page,
      perPage: 20,
      ...overrides
    }
    if (filters.search) params.search = filters.search
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => fetchData())
</script>
