<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Search Input -->
      <div class="md:col-span-2">
        <label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          {{ $t('reports.searchReports') }}
        </label>
        <div class="relative">
          <input
            id="search"
            v-model="searchQuery"
            type="text"
            :placeholder="$t('reports.searchPlaceholder')"
            class="form-input pl-10"
            @input="onSearchInput"
          >
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
      </div>

      <!-- Category Filter -->
      <div>
        <label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          {{ $t('common.category') }}
        </label>
        <select
          id="category"
          v-model="selectedCategory"
          class="form-input"
          @change="onFilterChange"
        >
          <option value="">{{ $t('common.allCategories') }}</option>
          <option v-for="cat in categories" :key="cat.value" :value="cat.value">
            {{ cat.label }}
          </option>
        </select>
      </div>

      <!-- Year Filter -->
      <div>
        <label for="year" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          {{ $t('common.year') }}
        </label>
        <select
          id="year"
          v-model="selectedYear"
          class="form-input"
          @change="onFilterChange"
        >
          <option value="">{{ $t('common.allYears') }}</option>
          <option v-for="year in years" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
    </div>

    <!-- Active Filters & Clear -->
    <div v-if="hasActiveFilters" class="mt-4 flex items-center gap-2 flex-wrap">
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('common.activeFilters') }}:</span>

      <span
        v-if="searchQuery"
        class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm dark:text-gray-200"
      >
        Search: "{{ searchQuery }}"
        <button type="button" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" @click="clearSearch">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>

      <span
        v-if="selectedCategory"
        class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm dark:text-gray-200"
      >
        {{ getCategoryLabel(selectedCategory) }}
        <button type="button" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" @click="clearCategory">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>

      <span
        v-if="selectedYear"
        class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm dark:text-gray-200"
      >
        Year: {{ selectedYear }}
        <button type="button" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" @click="clearYear">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>

      <button
        type="button"
        class="text-sm text-primary hover:text-primary-dark underline"
        @click="clearAllFilters"
      >
        {{ $t('common.clearAll') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuditCategory } from '~/types'

interface Props {
  modelSearch?: string
  modelCategory?: AuditCategory | ''
  modelYear?: number | ''
}

const props = withDefaults(defineProps<Props>(), {
  modelSearch: '',
  modelCategory: '',
  modelYear: ''
})

const emit = defineEmits<{
  'update:modelSearch': [value: string]
  'update:modelCategory': [value: AuditCategory | '']
  'update:modelYear': [value: number | '']
  'filter': []
}>()

const { categories } = useReports()

// Generate years from 2020 to current year
const currentYear = new Date().getFullYear()
const years = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i)

// Local state synced with props
const searchQuery = ref(props.modelSearch)
const selectedCategory = ref<AuditCategory | ''>(props.modelCategory)
const selectedYear = ref<number | ''>(props.modelYear)

// Watch for external prop changes
watch(() => props.modelSearch, (val) => { searchQuery.value = val })
watch(() => props.modelCategory, (val) => { selectedCategory.value = val })
watch(() => props.modelYear, (val) => { selectedYear.value = val })

const hasActiveFilters = computed(() => {
  return searchQuery.value || selectedCategory.value || selectedYear.value
})

// Debounce search input
let searchTimeout: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    emit('update:modelSearch', searchQuery.value)
    emit('filter')
  }, 300)
}

function onFilterChange() {
  emit('update:modelCategory', selectedCategory.value)
  emit('update:modelYear', selectedYear.value)
  emit('filter')
}

function getCategoryLabel(category: AuditCategory): string {
  return categories.find(c => c.value === category)?.label || category
}

function clearSearch() {
  searchQuery.value = ''
  emit('update:modelSearch', '')
  emit('filter')
}

function clearCategory() {
  selectedCategory.value = ''
  emit('update:modelCategory', '')
  emit('filter')
}

function clearYear() {
  selectedYear.value = ''
  emit('update:modelYear', '')
  emit('filter')
}

function clearAllFilters() {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedYear.value = ''
  emit('update:modelSearch', '')
  emit('update:modelCategory', '')
  emit('update:modelYear', '')
  emit('filter')
}
</script>
