<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Newsletter Subscribers</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">View and manage email subscribers</p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-ghost" @click="exportSubscribers">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export CSV
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <AdminUiAdminStatsCard title="Total Subscribers" :value="stats.total" icon="users" />
      <AdminUiAdminStatsCard
        title="Confirmed"
        :value="stats.confirmed"
        icon="check"
        color="green"
      />
      <AdminUiAdminStatsCard
        title="Unsubscribed"
        :value="stats.unsubscribed"
        icon="x"
        color="red"
      />
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search by email..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.confirmed" class="form-input text-sm">
          <option value="">All Status</option>
          <option value="true">Confirmed</option>
          <option value="false">Unconfirmed</option>
        </select>
      </template>
    </AdminUiAdminSearchFilter>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div
          class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>

      <div v-else-if="items.length === 0" class="text-center py-12">
        <svg
          class="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <p class="text-gray-500 dark:text-gray-400">No subscribers found</p>
      </div>

      <table v-else class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Email
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28"
            >
              Status
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36"
            >
              Subscribed
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36"
            >
              Unsubscribed
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="subscriber in items"
            :key="subscriber.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900 dark:text-white">{{
                  subscriber.email
                }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <span v-if="subscriber.unsubscribedAt" class="badge badge-secondary"
                >Unsubscribed</span
              >
              <span v-else-if="subscriber.confirmed" class="badge badge-success">Confirmed</span>
              <span v-else class="badge badge-warning">Pending</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              {{ formatDate(subscriber.subscribedAt) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              {{ subscriber.unsubscribedAt ? formatDate(subscriber.unsubscribedAt) : '-' }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="meta.lastPage > 1" class="p-4 border-t border-gray-200 dark:border-gray-700">
        <AdminUiAdminPagination :meta="meta" @page-change="handlePageChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { NewsletterSubscriber } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, meta, fetchAll } = useAdminCrud<NewsletterSubscriber>('newsletter')

  const filters = reactive({ search: '', confirmed: '' })
  const hasActiveFilters = computed(() => !!filters.search || !!filters.confirmed)
  function clearFilters() {
    filters.search = ''
    filters.confirmed = ''
  }

  const stats = computed(() => {
    const total = meta.value.total
    const confirmed = items.value.filter((s) => s.confirmed && !s.unsubscribedAt).length
    const unsubscribed = items.value.filter((s) => s.unsubscribedAt).length
    return { total, confirmed, unsubscribed }
  })

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString()
  }

  function exportSubscribers() {
    const confirmedEmails = items.value
      .filter((s) => s.confirmed && !s.unsubscribedAt)
      .map((s) => s.email)
    const csv = 'Email\n' + confirmedEmails.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePageChange(page: number) {
    fetchData({ page })
  }

  function fetchData(overrides: Record<string, string | number | boolean | undefined> = {}) {
    const params: Record<string, string | number | boolean | undefined> = {
      page: meta.value.page,
      perPage: 50,
      ...overrides
    }
    if (filters.search) params.search = filters.search
    if (filters.confirmed) params.confirmed = filters.confirmed
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => fetchData())
</script>
