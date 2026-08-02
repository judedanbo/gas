<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Board Members</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Manage the members of the governing board
        </p>
      </div>
      <NuxtLink
        to="/admin/board-members/create"
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
        Add Member
      </NuxtLink>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search board members..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.role" class="form-input text-sm">
          <option value="">All Roles</option>
          <option value="chairperson">Chairperson</option>
          <option value="member">Member</option>
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
      @row-click="(row) => navigateTo(`/admin/board-members/${row.id}/edit`)"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <UiBaseImage
              v-if="row.photo"
              :src="row.photo"
              :alt="row.name"
              class="w-10 h-10 rounded-full object-cover"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
            >
              <svg
                class="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
          <div class="min-w-0">
            <p class="font-medium text-gray-900 dark:text-white truncate">
              {{ row.name || 'Unnamed' }}
            </p>
            <p class="text-xs text-gray-500 truncate">{{ row.title }}</p>
          </div>
        </div>
      </template>
      <template #cell-role="{ value }">
        <span class="badge" :class="roleClass(value as BoardRole)">{{
          formatRole(value as BoardRole)
        }}</span>
      </template>
      <template #cell-isActive="{ value }">
        <span :class="value ? 'badge badge-success' : 'badge badge-secondary'">{{
          value ? 'Active' : 'Inactive'
        }}</span>
      </template>
      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <NuxtLink
            :to="`/admin/board-members/${row.id}/edit`"
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
          title="No board members found"
          description="Get started by adding the board chairperson or members."
          action-to="/admin/board-members/create"
          action-label="Add Member"
      /></template>
    </AdminUiAdminDataTable>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Board Member"
      :message="`Are you sure you want to delete '${itemToDelete?.name}'?`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminBoardMember, BoardRole } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, deleting, meta, fetchAll, remove } =
    useAdminCrud<AdminBoardMember>('board-members')

  const filters = reactive({ search: '', role: '', isActive: '' })
  const hasActiveFilters = computed(() => !!filters.search || !!filters.role || !!filters.isActive)
  function clearFilters() {
    filters.search = ''
    filters.role = ''
    filters.isActive = ''
  }

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'role', label: 'Role', width: '160px' },
    { key: 'displayOrder', label: 'Order', width: '80px' },
    { key: 'isActive', label: 'Status', width: '100px' }
  ]

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminBoardMember | null>(null)

  function formatRole(role: BoardRole): string {
    const labels: Record<BoardRole, string> = {
      chairperson: 'Chairperson',
      member: 'Member'
    }
    return labels[role] || role
  }

  function roleClass(role: BoardRole): string {
    const classes: Record<BoardRole, string> = {
      chairperson: 'badge-primary',
      member: 'badge-secondary'
    }
    return classes[role] || ''
  }

  function confirmDelete(item: AdminBoardMember) {
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
