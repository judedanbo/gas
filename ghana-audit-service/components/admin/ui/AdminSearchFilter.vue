<template>
  <div class="flex flex-col sm:flex-row gap-4 mb-6">
    <!-- Search Input -->
    <div class="flex-1 relative">
      <input
        :value="search"
        type="text"
        class="form-input w-full pl-10"
        :placeholder="searchPlaceholder"
        @input="handleSearch"
      />
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <button
        v-if="search"
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        @click="$emit('update:search', '')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-2">
      <slot name="filters" />

      <!-- Clear Filters -->
      <button
        v-if="hasActiveFilters"
        type="button"
        class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
        @click="$emit('clear-filters')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Clear filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  search?: string
  searchPlaceholder?: string
  hasActiveFilters?: boolean
}

withDefaults(defineProps<Props>(), {
  search: '',
  searchPlaceholder: 'Search...',
  hasActiveFilters: false
})

const emit = defineEmits<{
  'update:search': [value: string]
  'clear-filters': []
}>()

// Debounced search
let debounceTimer: NodeJS.Timeout | null = null

function handleSearch(event: Event) {
  const value = (event.target as HTMLInputElement).value

  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    emit('update:search', value)
  }, 300)
}
</script>
