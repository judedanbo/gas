<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-1">View system activity and user actions</p>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search logs..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.action" class="form-input text-sm">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
        </select>
        <select v-model="filters.entityType" class="form-input text-sm">
          <option value="">All Types</option>
          <option value="reports">Reports</option>
          <option value="publications">Publications</option>
          <option value="news">News</option>
          <option value="events">Events</option>
          <option value="vacancies">Vacancies</option>
          <option value="tenders">Tenders</option>
          <option value="users">Users</option>
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p class="text-gray-500 dark:text-gray-400">No audit logs found</p>
      </div>

      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="log in items"
          :key="log.id"
          class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
          @click="viewLog(log)"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center"
                :class="actionIconClass(log.action)"
              >
                <svg
                  v-if="log.action === 'create'"
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <svg
                  v-else-if="log.action === 'update'"
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <svg
                  v-else-if="log.action === 'delete'"
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <svg
                  v-else-if="log.action === 'login'"
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              <div>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ log.user?.name || 'System' }}
                  <span class="font-normal text-gray-500">{{ formatAction(log.action) }}</span>
                  <span v-if="log.entityType" class="text-primary">{{ log.entityType }}</span>
                  <span v-if="log.entityId" class="text-gray-400">#{{ log.entityId }}</span>
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ log.user?.email || 'Automated action' }}
                </p>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-sm text-gray-500">{{ formatDate(log.createdAt) }}</p>
              <p class="text-xs text-gray-400">{{ log.ipAddress || 'Unknown IP' }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="meta.lastPage > 1" class="p-4 border-t border-gray-200 dark:border-gray-700">
        <AdminUiAdminPagination :meta="meta" @page-change="handlePageChange" />
      </div>
    </div>

    <!-- Log Detail Modal -->
    <Teleport to="body">
      <div
        v-if="selectedLog"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="selectedLog = null"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        >
          <div
            class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
          >
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Log Details</h3>
            <button
              type="button"
              class="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
              @click="selectedLog = null"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div class="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">User</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedLog.user?.name || 'System' }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Action</p>
                <p class="font-medium">
                  <span class="badge" :class="actionBadgeClass(selectedLog.action)">{{
                    selectedLog.action
                  }}</span>
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Entity Type</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedLog.entityType || '-' }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Entity ID</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedLog.entityId || '-' }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">IP Address</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedLog.ipAddress || 'Unknown' }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Timestamp</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ new Date(selectedLog.createdAt).toLocaleString() }}
                </p>
              </div>
            </div>
            <div v-if="selectedLog.changes && Object.keys(selectedLog.changes).length > 0">
              <p class="text-sm text-gray-500 mb-2">Changes</p>
              <pre
                class="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 text-sm overflow-x-auto text-gray-800 dark:text-gray-200"
                >{{ JSON.stringify(selectedLog.changes, null, 2) }}</pre
              >
            </div>
            <div v-if="selectedLog.userAgent">
              <p class="text-sm text-gray-500 mb-2">User Agent</p>
              <p class="text-xs text-gray-600 dark:text-gray-400 break-all">
                {{ selectedLog.userAgent }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import type { AuditLogEntry } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, meta, fetchAll } = useAdminCrud<AuditLogEntry>('audit-logs')

  const filters = reactive({ search: '', action: '', entityType: '' })
  const hasActiveFilters = computed(
    () => !!filters.search || !!filters.action || !!filters.entityType
  )
  function clearFilters() {
    filters.search = ''
    filters.action = ''
    filters.entityType = ''
  }

  const selectedLog = ref<AuditLogEntry | null>(null)

  function formatAction(action: string): string {
    const labels: Record<string, string> = {
      create: 'created',
      update: 'updated',
      delete: 'deleted',
      login: 'logged in',
      logout: 'logged out'
    }
    return labels[action] || action
  }

  function actionIconClass(action: string): string {
    const classes: Record<string, string> = {
      create: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      update: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      delete: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      login: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      logout: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }
    return classes[action] || 'bg-gray-100 text-gray-600'
  }

  function actionBadgeClass(action: string): string {
    const classes: Record<string, string> = {
      create: 'badge-success',
      update: 'badge-primary',
      delete: 'badge-warning',
      login: 'badge-accent',
      logout: 'badge-secondary'
    }
    return classes[action] || ''
  }

  function formatDate(date: string): string {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  function viewLog(log: AuditLogEntry) {
    selectedLog.value = log
  }
  function handlePageChange(page: number) {
    fetchData({ page })
  }

  function fetchData(overrides: Record<string, string | number | boolean | undefined> = {}) {
    const params: Record<string, string | number | boolean | undefined> = {
      page: meta.value.page,
      perPage: 30,
      ...overrides
    }
    if (filters.search) params.search = filters.search
    if (filters.action) params.action = filters.action
    if (filters.entityType) params.entityType = filters.entityType
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => fetchData())
</script>
