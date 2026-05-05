<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Contact Submissions</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-1">View and manage contact form submissions</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <AdminUiAdminStatsCard title="Total" :value="stats.total" icon="inbox" />
      <AdminUiAdminStatsCard title="Pending" :value="stats.pending" icon="clock" color="yellow" />
      <AdminUiAdminStatsCard title="Read" :value="stats.read" icon="eye" color="blue" />
      <AdminUiAdminStatsCard
        title="Responded"
        :value="stats.responded"
        icon="check"
        color="green"
      />
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search submissions..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.status" class="form-input text-sm">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="read">Read</option>
          <option value="responded">Responded</option>
          <option value="archived">Archived</option>
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
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p class="text-gray-500 dark:text-gray-400">No submissions found</p>
      </div>

      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="submission in items"
          :key="submission.id"
          class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
          :class="{ 'bg-primary/5': submission.status === 'pending' }"
          @click="viewSubmission(submission)"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="badge text-xs" :class="statusClass(submission.status)">{{
                  formatStatus(submission.status)
                }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{
                  submission.subject
                }}</span>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <span>{{ submission.name }}</span>
                <span>{{ submission.email }}</span>
              </div>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {{ submission.message }}
              </p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-sm text-gray-500">{{ formatDate(submission.submittedAt) }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="meta.lastPage > 1" class="p-4 border-t border-gray-200 dark:border-gray-700">
        <AdminUiAdminPagination :meta="meta" @page-change="handlePageChange" />
      </div>
    </div>

    <!-- Submission Detail Modal -->
    <Teleport to="body">
      <div
        v-if="selectedSubmission"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="selectedSubmission = null"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        >
          <div
            class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
          >
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ selectedSubmission.subject }}
              </h3>
              <p class="text-sm text-gray-500">From {{ selectedSubmission.name }}</p>
            </div>
            <button
              type="button"
              class="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
              @click="selectedSubmission = null"
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
          <div class="p-4 space-y-4 overflow-y-auto max-h-[50vh]">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-gray-500">Name</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedSubmission.name }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Email</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  <a
                    :href="`mailto:${selectedSubmission.email}`"
                    class="text-primary hover:underline"
                    >{{ selectedSubmission.email }}</a
                  >
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Status</p>
                <p class="font-medium">
                  <span class="badge" :class="statusClass(selectedSubmission.status)">{{
                    formatStatus(selectedSubmission.status)
                  }}</span>
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Submitted</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ new Date(selectedSubmission.submittedAt).toLocaleString() }}
                </p>
              </div>
            </div>
            <div>
              <p class="text-sm text-gray-500 mb-2">Message</p>
              <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p class="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                  {{ selectedSubmission.message }}
                </p>
              </div>
            </div>
          </div>
          <div
            class="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
          >
            <div class="flex items-center gap-2">
              <button
                v-if="selectedSubmission.status === 'pending'"
                type="button"
                class="btn btn-ghost btn-sm"
                @click="updateStatus('read')"
              >
                Mark as Read
              </button>
              <button
                v-if="selectedSubmission.status !== 'responded'"
                type="button"
                class="btn btn-ghost btn-sm"
                @click="updateStatus('responded')"
              >
                Mark as Responded
              </button>
              <button
                v-if="selectedSubmission.status !== 'archived'"
                type="button"
                class="btn btn-ghost btn-sm"
                @click="updateStatus('archived')"
              >
                Archive
              </button>
            </div>
            <a
              :href="`mailto:${selectedSubmission.email}?subject=Re: ${selectedSubmission.subject}`"
              class="btn btn-primary btn-sm"
            >
              Reply via Email
            </a>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import type { ContactSubmission, SubmissionStatus } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, meta, fetchAll, update } =
    useAdminCrud<ContactSubmission>('contact-submissions')

  const filters = reactive({ search: '', status: '' })
  const hasActiveFilters = computed(() => !!filters.search || !!filters.status)
  function clearFilters() {
    filters.search = ''
    filters.status = ''
  }

  const selectedSubmission = ref<ContactSubmission | null>(null)

  const stats = computed(() => {
    const total = meta.value.total
    const pending = items.value.filter((s) => s.status === 'pending').length
    const read = items.value.filter((s) => s.status === 'read').length
    const responded = items.value.filter((s) => s.status === 'responded').length
    return { total, pending, read, responded }
  })

  function formatStatus(status: SubmissionStatus): string {
    const labels: Record<SubmissionStatus, string> = {
      pending: 'Pending',
      read: 'Read',
      responded: 'Responded',
      archived: 'Archived'
    }
    return labels[status] || status
  }

  function statusClass(status: SubmissionStatus): string {
    const classes: Record<SubmissionStatus, string> = {
      pending: 'badge-warning',
      read: 'badge-primary',
      responded: 'badge-success',
      archived: 'badge-secondary'
    }
    return classes[status] || ''
  }

  function formatDate(date: string): string {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  function viewSubmission(submission: ContactSubmission) {
    selectedSubmission.value = submission
    // Auto-mark as read if pending
    if (submission.status === 'pending') {
      update(submission.id, { status: 'read' as SubmissionStatus })
    }
  }

  async function updateStatus(status: SubmissionStatus) {
    if (!selectedSubmission.value) return
    await update(selectedSubmission.value.id, { status })
    selectedSubmission.value.status = status
    fetchData()
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
