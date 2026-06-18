<template>
  <nav class="flex items-center gap-1" aria-label="Pagination">
    <!-- Previous -->
    <button
      type="button"
      aria-label="Previous page"
      class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="currentPage === 1"
      @click="$emit('page-change', currentPage - 1)"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <!-- Page numbers -->
    <template v-for="page in visiblePages" :key="page">
      <span v-if="page === '...'" class="px-3 py-2 text-gray-500"> ... </span>
      <button
        v-else
        type="button"
        :aria-label="`Go to page ${page}`"
        :aria-current="page === currentPage ? 'page' : undefined"
        :class="[
          'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          page === currentPage
            ? 'bg-primary text-white'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        ]"
        @click="$emit('page-change', page as number)"
      >
        {{ page }}
      </button>
    </template>

    <!-- Next -->
    <button
      type="button"
      aria-label="Next page"
      class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="currentPage === lastPage"
      @click="$emit('page-change', currentPage + 1)"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </nav>
</template>

<script setup lang="ts">
  interface PaginationMeta {
    total: number
    page: number
    perPage: number
    lastPage: number
  }

  interface Props {
    currentPage?: number
    lastPage?: number
    meta?: PaginationMeta
    maxVisible?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    maxVisible: 5,
    currentPage: undefined,
    lastPage: undefined,
    meta: undefined
  })

  defineEmits<{
    'page-change': [page: number]
  }>()

  // Support both meta object and individual props
  const currentPage = computed(() => props.meta?.page ?? props.currentPage ?? 1)
  const lastPage = computed(() => props.meta?.lastPage ?? props.lastPage ?? 1)

  const visiblePages = computed(() => {
    const pages: (number | string)[] = []
    const cp = currentPage.value
    const lp = lastPage.value
    const maxVis = props.maxVisible

    if (lp <= maxVis) {
      // Show all pages
      for (let i = 1; i <= lp; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (cp > 3) {
        pages.push('...')
      }

      // Calculate range around current page
      const start = Math.max(2, cp - 1)
      const end = Math.min(lp - 1, cp + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (cp < lp - 2) {
        pages.push('...')
      }

      // Always show last page
      pages.push(lp)
    }

    return pages
  })
</script>
