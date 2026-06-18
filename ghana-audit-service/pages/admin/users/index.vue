<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Manage admin users and permissions</p>
      </div>
      <NuxtLink
        v-if="hasPermission('manage_users')"
        to="/admin/users/create"
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
        Add User
      </NuxtLink>
    </div>

    <div
      v-if="resendResult"
      class="mb-4 p-4 rounded-lg border"
      :class="
        resendResult.emailSent
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
      "
      role="status"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="text-sm">
          <p v-if="resendResult.emailSent">
            A new invitation email was sent to <strong>{{ resendResult.name }}</strong
            >.
          </p>
          <p v-else>
            Email is not configured. Share the new initial password for
            <strong>{{ resendResult.name }}</strong> securely:
            <code class="ml-1 font-mono">{{ resendResult.password }}</code>
          </p>
        </div>
        <button
          type="button"
          class="text-current/70 hover:text-current"
          aria-label="Dismiss"
          @click="resendResult = null"
        >
          ✕
        </button>
      </div>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search users..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.role" class="form-input text-sm">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <select v-model="filters.status" class="form-input text-sm">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </template>
    </AdminUiAdminSearchFilter>

    <AdminUiAdminDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :meta="meta"
      @page-change="handlePageChange"
      @row-click="
        (row) => hasPermission('manage_users') && navigateTo(`/admin/users/${row.id}/edit`)
      "
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold"
          >
            {{ getInitials(row.name) }}
          </div>
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ row.name }}</p>
            <p class="text-xs text-gray-500">{{ row.email }}</p>
          </div>
        </div>
      </template>
      <template #cell-role="{ value }">
        <span class="badge" :class="roleClass(value as string)">{{
          formatRole(value as string)
        }}</span>
      </template>
      <template #cell-modules="{ row }">
        <div class="flex flex-wrap gap-1">
          <span v-if="row.role === 'admin'" class="badge badge-primary">All</span>
          <template v-else-if="row.modules && row.modules.length">
            <span
              v-for="m in row.modules"
              :key="m"
              class="badge badge-secondary"
              :title="moduleLabels[m]"
              >{{ moduleShortLabels[m] }}</span
            >
          </template>
          <span v-else class="text-xs text-gray-400 italic">None</span>
        </div>
      </template>
      <template #cell-status="{ row }">
        <span class="badge" :class="statusBadge(row).class">{{ statusBadge(row).label }}</span>
      </template>
      <template #cell-lastLoginAt="{ value }">
        <span class="text-sm text-gray-500">{{
          value ? formatDate(value as string) : 'Never'
        }}</span>
      </template>
      <template #actions="{ row }">
        <div
          v-if="hasPermission('manage_users') && row.id !== currentUser?.id"
          class="flex items-center justify-end gap-2"
        >
          <button
            v-if="row.status === 'pending'"
            type="button"
            title="Resend invitation"
            aria-label="Resend invitation"
            class="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            :disabled="resendingId === row.id"
            @click.stop="resendInvite(row)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </button>
          <NuxtLink
            :to="`/admin/users/${row.id}/edit`"
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
        <div v-else-if="row.id === currentUser?.id" class="text-xs text-gray-400 italic">You</div>
      </template>
      <template #empty
        ><AdminUiAdminEmptyState title="No users found" description="No users match your filters."
      /></template>
    </AdminUiAdminDataTable>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete User"
      :message="`Are you sure you want to delete '${itemToDelete?.name}'? This action cannot be undone.`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminUser, ModuleKey } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { user: currentUser, hasPermission } = useAdminAuth()
  const { items, loading, deleting, meta, fetchAll, remove } = useAdminCrud<AdminUser>('users')
  const api = useAdminApi()

  const filters = reactive({ search: '', role: '', status: '' })
  const hasActiveFilters = computed(() => !!filters.search || !!filters.role || !!filters.status)
  function clearFilters() {
    filters.search = ''
    filters.role = ''
    filters.status = ''
  }

  const columns = [
    { key: 'name', label: 'User', sortable: true },
    { key: 'role', label: 'Role', width: '100px' },
    { key: 'modules', label: 'Modules' },
    { key: 'status', label: 'Status', width: '110px' },
    { key: 'lastLoginAt', label: 'Last Login', width: '140px' }
  ]

  const resendingId = ref<number | null>(null)
  const resendResult = ref<{ name: string; password: string; emailSent: boolean } | null>(null)

  function statusBadge(row: AdminUser): { label: string; class: string } {
    if (row.status === 'pending') return { label: 'Pending', class: 'badge-accent' }
    if (!row.isActive || row.status === 'inactive')
      return { label: 'Inactive', class: 'badge-secondary' }
    return { label: 'Active', class: 'badge-success' }
  }

  async function resendInvite(row: AdminUser) {
    resendingId.value = row.id
    resendResult.value = null
    try {
      const res = await api.post<{ emailSent: boolean; generatedPassword: string }>(
        `users/${row.id}/resend-invitation`
      )
      resendResult.value = {
        name: row.name,
        password: res.generatedPassword,
        emailSent: res.emailSent
      }
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      resendResult.value = {
        name: row.name,
        password: err.data?.message || err.message || 'Failed to resend invitation',
        emailSent: false
      }
    } finally {
      resendingId.value = null
    }
  }

  const moduleLabels: Record<ModuleKey, string> = {
    reports: 'Audit Reports',
    content: 'Content',
    careers: 'Careers',
    organization: 'Organization',
    media: 'Media',
    analytics: 'Analytics & Audit Logs',
    communications: 'Communications'
  }

  const moduleShortLabels: Record<ModuleKey, string> = {
    reports: 'Reports',
    content: 'Content',
    careers: 'Careers',
    organization: 'Org',
    media: 'Media',
    analytics: 'Analytics',
    communications: 'Comms'
  }

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminUser | null>(null)

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  function formatRole(role: string): string {
    const labels: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }
    return labels[role] || role
  }

  function roleClass(role: string): string {
    const classes: Record<string, string> = {
      admin: 'badge-primary',
      editor: 'badge-accent',
      viewer: 'badge-secondary'
    }
    return classes[role] || ''
  }

  function formatDate(date: string): string {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString()
  }

  function confirmDelete(item: AdminUser) {
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
    if (filters.role) params.role = filters.role
    if (filters.status) params.status = filters.status
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => fetchData())
</script>
