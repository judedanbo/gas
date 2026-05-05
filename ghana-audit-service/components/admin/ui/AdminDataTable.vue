<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700">
          <tr>
            <!-- Checkbox column -->
            <th v-if="selectable" class="w-12 px-4 py-3">
              <input
                type="checkbox"
                class="form-checkbox rounded"
                :checked="allSelected"
                :indeterminate="someSelected && !allSelected"
                @change="toggleAll"
              />
            </th>
            <!-- Data columns -->
            <th
              v-for="column in columns"
              :key="column.key"
              :class="[
                'px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider',
                column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : '',
                column.align === 'center' ? 'text-center' : '',
                column.align === 'right' ? 'text-right' : ''
              ]"
              :style="column.width ? { width: column.width } : undefined"
              @click="column.sortable && handleSort(column.key)"
            >
              <div
                class="flex items-center gap-1"
                :class="{
                  'justify-center': column.align === 'center',
                  'justify-end': column.align === 'right'
                }"
              >
                <span>{{ column.label }}</span>
                <span v-if="column.sortable && sortKey === column.key" class="text-primary">
                  <svg
                    v-if="sortDirection === 'asc'"
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </div>
            </th>
            <!-- Actions column -->
            <th
              v-if="$slots.actions"
              class="w-24 px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <!-- Loading state -->
          <tr v-if="loading">
            <td :colspan="totalColumns" class="px-4 py-12 text-center">
              <div class="flex flex-col items-center gap-2">
                <svg class="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span class="text-gray-500 dark:text-gray-400">Loading...</span>
              </div>
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-else-if="data.length === 0">
            <td :colspan="totalColumns" class="px-4 py-12 text-center">
              <slot name="empty">
                <div class="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                  <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <span>No data available</span>
                </div>
              </slot>
            </td>
          </tr>

          <!-- Data rows -->
          <tr
            v-for="(row, index) in data"
            v-else
            :key="row.id || index"
            :class="[
              'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
              row.deletedAt ? 'opacity-50' : ''
            ]"
            @click="$emit('row-click', row)"
          >
            <!-- Checkbox -->
            <td v-if="selectable" class="px-4 py-3">
              <input
                type="checkbox"
                class="form-checkbox rounded"
                :checked="selectedIds.includes(row.id)"
                @click.stop
                @change="toggleRow(row.id)"
              />
            </td>
            <!-- Data cells -->
            <td
              v-for="column in columns"
              :key="column.key"
              :class="[
                'px-4 py-3 text-sm text-gray-900 dark:text-gray-100',
                column.align === 'center' ? 'text-center' : '',
                column.align === 'right' ? 'text-right' : ''
              ]"
            >
              <slot
                :name="`cell-${column.key}`"
                :row="row"
                :value="getNestedValue(row, column.key)"
              >
                {{ getNestedValue(row, column.key) }}
              </slot>
            </td>
            <!-- Actions -->
            <td v-if="$slots.actions" class="px-4 py-3 text-right">
              <slot name="actions" :row="row" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="meta && meta.total > 0"
      class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4"
    >
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Showing {{ startItem }} to {{ endItem }} of {{ meta.total }} results
      </p>
      <AdminUiAdminPagination
        :current-page="meta.page"
        :last-page="meta.lastPage"
        @page-change="(page) => $emit('page-change', page)"
      />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends { id: number; deletedAt?: string | null }">
  import type { PaginationMeta } from '~/types/admin'

  interface Column {
    key: string
    label: string
    sortable?: boolean
    width?: string
    align?: 'left' | 'center' | 'right'
  }

  interface Props {
    columns: Column[]
    data: T[]
    loading?: boolean
    meta?: PaginationMeta
    selectable?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    loading: false,
    selectable: false,
    meta: undefined
  })

  const emit = defineEmits<{
    sort: [column: string, direction: 'asc' | 'desc']
    'page-change': [page: number]
    'row-click': [row: T]
    'selection-change': [selected: T[]]
  }>()

  // Sort state
  const sortKey = ref<string | null>(null)
  const sortDirection = ref<'asc' | 'desc'>('asc')

  // Selection state
  const selectedIds = ref<number[]>([])

  const allSelected = computed(() => {
    return props.data.length > 0 && selectedIds.value.length === props.data.length
  })

  const someSelected = computed(() => {
    return selectedIds.value.length > 0
  })

  const totalColumns = computed(() => {
    let count = props.columns.length
    if (props.selectable) count++
    // Check if actions slot is used
    return count + 1 // +1 for actions column
  })

  const startItem = computed(() => {
    if (!props.meta) return 0
    return (props.meta.page - 1) * props.meta.perPage + 1
  })

  const endItem = computed(() => {
    if (!props.meta) return 0
    return Math.min(props.meta.page * props.meta.perPage, props.meta.total)
  })

  // Handle sort
  function handleSort(key: string) {
    if (sortKey.value === key) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDirection.value = 'asc'
    }
    emit('sort', key, sortDirection.value)
  }

  // Selection functions
  function toggleAll() {
    if (allSelected.value) {
      selectedIds.value = []
    } else {
      selectedIds.value = props.data.map((row) => row.id)
    }
    emitSelection()
  }

  function toggleRow(id: number) {
    const index = selectedIds.value.indexOf(id)
    if (index === -1) {
      selectedIds.value.push(id)
    } else {
      selectedIds.value.splice(index, 1)
    }
    emitSelection()
  }

  function emitSelection() {
    const selected = props.data.filter((row) => selectedIds.value.includes(row.id))
    emit('selection-change', selected)
  }

  // Get nested value from object (e.g., "translations.en.title")
  function getNestedValue(obj: T, path: string): unknown {
    return (
      path.split('.').reduce((acc: unknown, part: string) => {
        if (acc && typeof acc === 'object' && part in acc) {
          return (acc as Record<string, unknown>)[part]
        }
        return undefined
      }, obj as unknown) ?? ''
    )
  }

  // Reset selection when data changes
  watch(
    () => props.data,
    () => {
      selectedIds.value = []
    }
  )
</script>
