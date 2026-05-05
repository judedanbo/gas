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
        <select v-model="filters.isActive" class="form-input text-sm">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
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
      <template #cell-isActive="{ value }">
        <span :class="value ? 'badge badge-success' : 'badge badge-secondary'">{{
          value ? 'Active' : 'Inactive'
        }}</span>
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
          <NuxtLink
            :to="`/admin/users/${row.id}/edit`"
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
  import type { AdminUser } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { user: currentUser, hasPermission } = useAdminAuth()
  const { items, loading, deleting, meta, fetchAll, remove } = useAdminCrud<AdminUser>('users')

  const filters = reactive({ search: '', role: '', isActive: '' })
  const hasActiveFilters = computed(() => !!filters.search || !!filters.role || !!filters.isActive)
  function clearFilters() {
    filters.search = ''
    filters.role = ''
    filters.isActive = ''
  }

  const columns = [
    { key: 'name', label: 'User', sortable: true },
    { key: 'role', label: 'Role', width: '100px' },
    { key: 'isActive', label: 'Status', width: '100px' },
    { key: 'lastLoginAt', label: 'Last Login', width: '140px' }
  ]

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
    if (filters.isActive) params.isActive = filters.isActive
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => fetchData())
</script>
