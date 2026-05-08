<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Search Results</h1>
        <p v-if="searchQuery" class="page-subtitle">Showing results for "{{ searchQuery }}"</p>
      </div>
    </div>

    <!-- Breadcrumb -->
    <CommonBreadcrumb :crumbs="[{ label: 'Search Results', path: '/search' }]" />

    <!-- Main Content -->
    <section class="section bg-gray-50">
      <div class="container">
        <!-- Search Bar -->
        <div class="mb-8">
          <form
            class="flex gap-3 items-center flex-wrap md:flex-nowrap"
            @submit.prevent="handleSearch"
          >
            <div class="flex-1 relative flex items-center w-full">
              <Icon
                name="heroicons:magnifying-glass"
                class="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                v-model="searchInput"
                type="search"
                class="w-full py-3 px-4 pl-12 pr-10 text-base border-2 border-gray-300 rounded-lg bg-white transition-colors focus:outline-none focus:border-primary"
                placeholder="Search reports, publications, news..."
                aria-label="Search the website"
              />
              <button
                v-if="searchInput"
                type="button"
                class="absolute right-3 bg-transparent border-none p-2 cursor-pointer text-gray-400 text-lg leading-none hover:text-gray-600"
                aria-label="Clear search"
                @click="clearSearch"
              >
                ✕
              </button>
            </div>
            <button type="submit" class="btn-primary whitespace-nowrap">Search</button>
          </form>
        </div>

        <!-- Two Column Layout -->
        <div class="lg:grid lg:grid-cols-4 lg:gap-8">
          <!-- Filters Sidebar -->
          <aside class="lg:col-span-1 mb-6 lg:mb-0">
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 sticky top-24">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">Filters</h2>
                <button
                  v-if="hasActiveFilters"
                  class="text-sm text-primary dark:text-primary-light hover:text-primary-dark"
                  @click="clearFilters"
                >
                  Clear all
                </button>
              </div>

              <!-- Type Filter -->
              <div class="mb-6">
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Content Type</h3>
                <div class="space-y-2">
                  <label
                    v-for="type in typeFilters"
                    :key="type.value"
                    class="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      v-model="selectedTypes"
                      :value="type.value"
                      type="checkbox"
                      class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary dark:bg-gray-700"
                    />
                    <span class="text-sm text-gray-600 dark:text-gray-400">{{ type.label }}</span>
                  </label>
                </div>
              </div>

              <!-- Date Range Filter -->
              <div class="mb-6">
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Date Range</h3>
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                    <input
                      v-model="dateFrom"
                      type="date"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                    <input
                      v-model="dateTo"
                      type="date"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <!-- Apply Filters Button -->
              <button class="w-full btn-primary btn-sm" @click="applyFilters">Apply Filters</button>
            </div>
          </aside>

          <!-- Results Area -->
          <div class="lg:col-span-3">
            <!-- Loading State -->
            <div v-if="loading" class="flex justify-center py-12" role="status" aria-live="polite">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <span class="sr-only">{{ $t('common.loading') }}</span>
            </div>

            <!-- Error State -->
            <div
              v-else-if="error"
              class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              role="alert"
              aria-live="assertive"
            >
              <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
              <button class="btn-primary" @click="performSearch">
                {{ $t('errors.tryAgain') }}
              </button>
            </div>

            <!-- Results -->
            <template v-else>
              <!-- Results Count and Active Filters -->
              <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  <template v-if="searchQuery">
                    Found {{ meta.total }} result{{ meta.total !== 1 ? 's' : '' }} for "{{
                      searchQuery
                    }}"
                  </template>
                  <template v-else> Enter a search term to find content </template>
                </p>

                <!-- Active Filter Tags -->
                <div v-if="activeFilterTags.length > 0" class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in activeFilterTags"
                    :key="tag.key"
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                  >
                    {{ tag.label }}
                    <button
                      class="hover:text-primary-dark"
                      :aria-label="`Remove ${tag.label} filter`"
                      @click="removeFilter(tag.key)"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              </div>

              <!-- No Query State -->
              <div
                v-if="!searchQuery"
                class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <Icon
                  name="heroicons:magnifying-glass"
                  class="w-10 h-10 text-primary dark:text-primary-light mb-4 mx-auto"
                  aria-hidden="true"
                />
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Start your search</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-4">
                  Search for audit reports, publications, news articles, and more.
                </p>
                <div class="flex flex-wrap justify-center gap-2">
                  <button
                    v-for="suggestion in searchSuggestions"
                    :key="suggestion"
                    class="px-3 py-1 text-sm text-primary dark:text-primary-light bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-primary hover:text-white hover:border-primary transition-colors"
                    @click="searchFor(suggestion)"
                  >
                    {{ suggestion }}
                  </button>
                </div>
              </div>

              <!-- Empty Results State -->
              <div
                v-else-if="results.length === 0"
                class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <Icon
                  name="heroicons:inbox"
                  class="w-10 h-10 text-primary dark:text-primary-light mb-4 mx-auto"
                  aria-hidden="true"
                />
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No results found</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-4">
                  We couldn't find any content matching "{{ searchQuery }}".
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">Try different keywords or remove some filters.</p>
              </div>

              <!-- Results List -->
              <div v-else class="space-y-4">
                <SearchSearchResultCard
                  v-for="result in results"
                  :key="result.id"
                  :result="result"
                />
              </div>

              <!-- Pagination -->
              <div v-if="meta.lastPage > 1" class="mt-8 flex justify-center gap-2">
                <button
                  :disabled="meta.page === 1"
                  class="btn-outline btn-sm"
                  @click="goToPage(meta.page - 1)"
                >
                  Previous
                </button>

                <template v-for="page in paginationPages" :key="page">
                  <button v-if="page === '...'" class="px-3 py-2 text-gray-500" disabled>
                    ...
                  </button>
                  <button
                    v-else
                    :class="page === meta.page ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
                    @click="goToPage(page as number)"
                  >
                    {{ page }}
                  </button>
                </template>

                <button
                  :disabled="meta.page === meta.lastPage"
                  class="btn-outline btn-sm"
                  @click="goToPage(meta.page + 1)"
                >
                  Next
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Help Section -->
    <section class="section bg-white">
      <div class="container text-center">
        <UiSectionHeader
          title="Can't Find What You're Looking For?"
          description="Our team is here to help you find the information you need."
          size="sm"
        />
        <NuxtLink to="/contact" class="btn-primary"> Contact Us </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  // SEO
  useSeoMeta({
    title: 'Search Results | Ghana Audit Service',
    description:
      'Search for audit reports, publications, news, and other content from the Ghana Audit Service.'
  })

  const route = useRoute()
  const router = useRouter()

  const { results, loading, error, meta, typeFilters, search, clearResults } = useSearch()

  // Search state
  const searchInput = ref('')
  const searchQuery = ref('')
  const selectedTypes = ref<string[]>([])
  const dateFrom = ref('')
  const dateTo = ref('')

  // Search suggestions
  const searchSuggestions = [
    'Financial Reports',
    'Performance Audit',
    'Press Statement',
    'MDAs',
    'Payroll'
  ]

  // Initialize from URL query
  onMounted(() => {
    const q = route.query.q as string
    if (q) {
      searchInput.value = q
      searchQuery.value = q
      performSearch()
    }
  })

  // Watch for route changes
  watch(
    () => route.query.q,
    (newQuery) => {
      if (newQuery && newQuery !== searchQuery.value) {
        searchInput.value = newQuery as string
        searchQuery.value = newQuery as string
        performSearch()
      }
    }
  )

  // Perform search
  async function performSearch() {
    if (!searchQuery.value.trim()) {
      clearResults()
      return
    }

    await search({
      query: searchQuery.value,
      type: selectedTypes.value.length === 1 ? selectedTypes.value[0] : undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
      page: meta.value.page,
      perPage: 10
    })
  }

  // Handle search form submit
  function handleSearch() {
    if (searchInput.value.trim()) {
      searchQuery.value = searchInput.value.trim()
      meta.value.page = 1
      router.push({ query: { q: searchQuery.value } })
      performSearch()
    }
  }

  // Search for a suggestion
  function searchFor(term: string) {
    searchInput.value = term
    handleSearch()
  }

  // Clear search
  function clearSearch() {
    searchInput.value = ''
  }

  // Apply filters
  function applyFilters() {
    meta.value.page = 1
    performSearch()
  }

  // Clear all filters
  function clearFilters() {
    selectedTypes.value = []
    dateFrom.value = ''
    dateTo.value = ''
    applyFilters()
  }

  // Check if any filters are active
  const hasActiveFilters = computed(() => {
    return selectedTypes.value.length > 0 || dateFrom.value || dateTo.value
  })

  // Generate active filter tags
  const activeFilterTags = computed(() => {
    const tags: { key: string; label: string }[] = []

    selectedTypes.value.forEach((type) => {
      const filter = typeFilters.find((f) => f.value === type)
      if (filter) {
        tags.push({ key: `type-${type}`, label: filter.label })
      }
    })

    if (dateFrom.value) {
      tags.push({ key: 'dateFrom', label: `From: ${dateFrom.value}` })
    }

    if (dateTo.value) {
      tags.push({ key: 'dateTo', label: `To: ${dateTo.value}` })
    }

    return tags
  })

  // Remove a specific filter
  function removeFilter(key: string) {
    if (key.startsWith('type-')) {
      const type = key.replace('type-', '')
      selectedTypes.value = selectedTypes.value.filter((t) => t !== type)
    } else if (key === 'dateFrom') {
      dateFrom.value = ''
    } else if (key === 'dateTo') {
      dateTo.value = ''
    }
    applyFilters()
  }

  // Pagination
  function goToPage(page: number) {
    meta.value.page = page
    performSearch()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Generate pagination pages array
  const paginationPages = computed(() => {
    const pages: (number | string)[] = []
    const total = meta.value.lastPage
    const current = meta.value.page

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      if (current > 3) pages.push('...')

      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)

      for (let i = start; i <= end; i++) pages.push(i)

      if (current < total - 2) pages.push('...')
      pages.push(total)
    }

    return pages
  })
</script>
