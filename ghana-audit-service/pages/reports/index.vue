<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb :crumbs="[{ label: 'A-G Reports', path: '/reports' }]" />

    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Auditor-General's Reports</h1>
        <p class="page-subtitle">
          Access comprehensive audit reports on public accounts, ministries, departments, and
          agencies across Ghana.
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <!-- Filters -->
        <ReportsReportFilter
          v-model:model-search="filters.search"
          v-model:model-category="filters.category"
          v-model:model-year="filters.year"
          @filter="fetchFilteredReports"
        />

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
          <p class="text-red-600 mb-4">{{ error }}</p>
          <button class="btn-primary" @click="fetchFilteredReports">Try Again</button>
        </div>

        <!-- Reports Grid -->
        <template v-else>
          <!-- Results Count -->
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Showing {{ reports.length }} of {{ meta.total }} reports
          </p>

          <!-- Empty State -->
          <div
            v-if="reports.length === 0"
            class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:document-magnifying-glass"
              class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4 mx-auto"
              aria-hidden="true"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No reports match your criteria
            </h3>
            <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Try broadening your search by removing filters or using different keywords. Audit reports are published periodically throughout the year.
            </p>
            <div class="flex flex-wrap justify-center gap-3">
              <button class="btn-primary btn-sm" @click="clearAllFilters">
                Clear All Filters
              </button>
              <NuxtLink to="/contact" class="btn-outline btn-sm">
                Contact Us
              </NuxtLink>
            </div>
          </div>

          <!-- Reports Grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <ReportsReportCard v-for="report in reports" :key="report.id" :report="report" />
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
              <button
                v-if="page === '...'"
                class="px-3 py-2 text-gray-500 dark:text-gray-400"
                disabled
              >
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
    </section>

    <!-- Download All Section -->
    <section class="section bg-white dark:bg-gray-800">
      <div class="container text-center">
        <UiSectionHeader
          title="Need Bulk Access?"
          description="For bulk downloads or institutional access to our complete report archive, please contact our office."
          size="sm"
        />
        <NuxtLink to="/contact" class="btn-primary"> Contact Us </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { AuditCategory } from '~/types'

  // SEO
  useSeoMeta({
    title: "Auditor-General's Reports | Ghana Audit Service",
    description:
      'Access comprehensive audit reports on public accounts, ministries, departments, and agencies across Ghana.'
  })

  const { reports, loading, error, meta, fetchReports } = useReports()

  // Filters
  const filters = reactive({
    search: '',
    category: '' as AuditCategory | '',
    year: '' as number | ''
  })

  // Fetch reports on mount
  onMounted(() => {
    fetchFilteredReports()
  })

  async function fetchFilteredReports() {
    await fetchReports({
      search: filters.search || undefined,
      category: filters.category || undefined,
      year: filters.year || undefined,
      page: meta.value.page,
      perPage: 12
    })
  }

  function clearAllFilters() {
    filters.search = ''
    filters.category = ''
    filters.year = ''
    meta.value.page = 1
    fetchFilteredReports()
  }

  function goToPage(page: number) {
    meta.value.page = page
    fetchFilteredReports()
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
