<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Team Members</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Manage staff and leadership profiles</p>
      </div>
      <NuxtLink
        to="/admin/team-members/create"
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
        Add Team Member
      </NuxtLink>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search team members..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.departmentId" class="form-input text-sm">
          <option value="">All Departments</option>
          <option v-for="dept in departments" :key="dept.id" :value="dept.id">
            {{ dept.translations?.en?.name }}
          </option>
        </select>
      </template>
    </AdminUiAdminSearchFilter>

    <AdminUiAdminDataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :meta="meta"
      @page-change="handlePageChange"
      @row-click="(row) => navigateTo(`/admin/team-members/${row.id}/edit`)"
    >
      <template #[`cell-translations.en.name`]="{ row }">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden"
          >
            <UiBaseImage
              v-if="row.photo"
              :src="row.photo"
              :alt="row.translations?.en?.name"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                />
              </svg>
            </div>
          </div>
          <div class="min-w-0">
            <p class="font-medium text-gray-900 dark:text-white truncate">
              {{ row.translations?.en?.name || 'Unnamed' }}
            </p>
            <p class="text-xs text-gray-500 truncate">
              {{ row.translations?.en?.position || 'No position' }}
            </p>
          </div>
        </div>
      </template>
      <template #cell-department="{ row }">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{
          getDepartmentName(row.departmentId)
        }}</span>
      </template>
      <template #cell-displayOrder="{ value }">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ value }}</span>
      </template>
      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <NuxtLink
            :to="`/admin/team-members/${row.id}/edit`"
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
          title="No team members found"
          description="Get started by adding your first team member."
          action-to="/admin/team-members/create"
          action-label="Add Team Member"
      /></template>
    </AdminUiAdminDataTable>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Team Member"
      :message="`Are you sure you want to delete '${itemToDelete?.translations?.en?.name}'?`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminTeamMember, AdminDepartment } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, deleting, meta, fetchAll, remove } =
    useAdminCrud<AdminTeamMember>('team-members')
  const { items: departments, fetchAll: fetchDepartments } =
    useAdminCrud<AdminDepartment>('departments')

  const filters = reactive({ search: '', departmentId: '' })
  const hasActiveFilters = computed(() => !!filters.search || !!filters.departmentId)
  function clearFilters() {
    filters.search = ''
    filters.departmentId = ''
  }

  const columns = [
    { key: 'translations.en.name', label: 'Name', sortable: true },
    { key: 'department', label: 'Department', width: '180px' },
    { key: 'displayOrder', label: 'Order', sortable: true, width: '80px' }
  ]

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminTeamMember | null>(null)

  function getDepartmentName(deptId: number | null): string {
    if (!deptId) return 'No department'
    const dept = departments.value.find((d) => d.id === deptId)
    return dept?.translations?.en?.name || 'Unknown'
  }

  function confirmDelete(item: AdminTeamMember) {
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
    if (filters.departmentId) params.departmentId = filters.departmentId
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => {
    fetchDepartments({ perPage: 100 })
    fetchData()
  })
</script>
