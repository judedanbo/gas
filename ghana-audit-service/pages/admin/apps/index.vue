<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Apps</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Audit Service apps and websites, each with its own page and a card on
          <a href="/apps" target="_blank" rel="noopener noreferrer" class="text-primary underline"
            >Our Apps<span class="sr-only"> (opens in a new tab)</span></a
          >
        </p>
      </div>
      <NuxtLink
        v-if="hasPermission('create')"
        to="/admin/apps/create"
        class="btn btn-primary inline-flex items-center gap-2"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add App
      </NuxtLink>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search apps..."
      :has-active-filters="!!filters.search"
      @clear-filters="filters.search = ''"
    />

    <AdminUiAdminDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :meta="meta"
      @page-change="(page) => fetchData({ page })"
      @row-click="(row) => navigateTo(`/admin/apps/${row.id}/edit`)"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3 max-w-sm">
          <span
            class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-white border border-gray-200 dark:border-gray-600 p-1"
          >
            <img
              :src="appLogoUrl(row.logoUrl)"
              :alt="row.logoUrl ? '' : 'GAS logo (no app logo uploaded)'"
              class="max-w-full max-h-full object-contain"
            />
          </span>
          <div class="min-w-0">
            <p class="font-medium text-gray-900 dark:text-white truncate">
              {{ row.translations.en.name }}
            </p>
            <p class="text-xs text-gray-500 truncate">
              {{ row.translations.ak ? 'English and Akan' : 'English only' }}
            </p>
          </div>
        </div>
      </template>
      <template #cell-slug="{ row }">
        <span class="text-sm font-mono text-gray-600 dark:text-gray-400">/{{ row.slug }}</span>
      </template>
      <template #cell-url="{ row }">
        <span class="text-sm text-gray-600 dark:text-gray-400 truncate block max-w-[200px]">
          {{ hostOf(row.url) }}
        </span>
      </template>
      <template #cell-isActive="{ row }">
        <span class="badge" :class="row.isActive ? 'badge-success' : 'badge-warning'">
          {{ row.isActive ? 'Published' : 'Hidden' }}
        </span>
      </template>
      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <a
            v-if="row.isActive"
            :href="`/${row.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`View the ${row.translations.en.name} page (opens in a new tab)`"
            class="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            @click.stop
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
          <NuxtLink
            :to="`/admin/apps/${row.id}/edit`"
            :aria-label="`Edit ${row.translations.en.name}`"
            class="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            @click.stop
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
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
            :aria-label="`Delete ${row.translations.en.name}`"
            class="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            @click.stop="confirmDelete(row)"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
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
          title="No apps found"
          description="Add an Audit Service app or website to give it a page on this site."
          action-to="/admin/apps/create"
          action-label="Add App"
        />
      </template>
    </AdminUiAdminDataTable>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete App"
      :message="`Delete '${itemToDelete?.translations.en.name}'? Its page at /${itemToDelete?.slug} will stop working. To take it down for now, switch off Published instead.`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminServiceApp } from '~/types/admin'
  import { appLogoUrl } from '~/utils/serviceApps'
  definePageMeta({ layout: 'admin' })

  const { items, loading, deleting, meta, fetchAll, remove } = useAdminCrud<AdminServiceApp>('apps')
  const { hasPermission } = useAdminAuth()

  const filters = reactive({ search: '' })

  const columns = [
    { key: 'name', label: 'App' },
    { key: 'slug', label: 'Page' },
    { key: 'url', label: 'Opens' },
    { key: 'sortOrder', label: 'Order', width: '80px' },
    { key: 'isActive', label: 'Status', width: '110px' }
  ]

  function hostOf(url: string): string {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  }

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminServiceApp | null>(null)

  function confirmDelete(item: AdminServiceApp) {
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
