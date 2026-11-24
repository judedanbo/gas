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

    <!--
      Featured report and list share one wrapper: the bulk-download bar at its
      end is sticky, and a sticky element only travels within its parent.
    -->
    <div class="bg-gray-50 dark:bg-gray-900">
      <!-- Featured Report -->
      <section
        v-if="showFeatured && featuredReport"
        class="section pb-0 bg-gray-50 dark:bg-gray-900"
        :aria-label="$t('reports.featured.title')"
      >
        <div class="container">
          <ReportsFeaturedReport
            :report="featuredReport"
            selectable
            :selected="isSelected(featuredReport.id)"
            :selection-disabled="selectionFull && !isSelected(featuredReport.id)"
            :selection-disabled-reason="limitReason"
            @toggle-select="toggleSelection"
          />
        </div>
      </section>

      <!-- Main Content -->
      <section
        id="reports-list"
        ref="listSection"
        tabindex="-1"
        class="section bg-gray-50 dark:bg-gray-900 scroll-mt-24 focus:outline-none"
        :aria-label="$t('reports.title')"
      >
        <div class="container">
          <!-- Filters -->
          <ReportsReportFilter
            v-model:model-search="filters.search"
            v-model:model-category="filters.category"
            v-model:model-year="filters.year"
            @filter="onFilterChange"
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
            <!-- Results count + bulk selection -->
            <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Showing {{ reports.length }} of {{ meta.total }} reports
              </p>
              <div
                v-if="pageReports.length > 0"
                class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
              >
                <p id="bulk-select-hint" class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('reports.bulk.hint') }}
                </p>
                <button
                  type="button"
                  class="btn-outline btn-sm shrink-0 self-start sm:self-auto"
                  aria-describedby="bulk-select-hint"
                  @click="togglePageSelection"
                >
                  {{
                    allOnPageSelected
                      ? $t('reports.bulk.deselectPage')
                      : $t('reports.bulk.selectPage')
                  }}
                </button>
              </div>
            </div>

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
                Try broadening your search by removing filters or using different keywords. Audit
                reports are published periodically throughout the year.
              </p>
              <div class="flex flex-wrap justify-center gap-3">
                <button class="btn-primary btn-sm" @click="clearAllFilters">
                  Clear All Filters
                </button>
                <NuxtLink to="/contact" class="btn-outline btn-sm"> Contact Us </NuxtLink>
              </div>
            </div>

            <!-- Reports Grid -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <ReportsReportCard
                v-for="report in displayedReports"
                :key="report.id"
                :report="report"
                selectable
                :selected="isSelected(report.id)"
                :selection-disabled="selectionFull && !isSelected(report.id)"
                :selection-disabled-reason="limitReason"
                @toggle-select="toggleSelection"
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

      <!-- Bulk download: selection summary + Download ZIP -->
      <ReportsBulkDownloadBar
        :count="selectedCount"
        :max-files="maxFiles"
        :estimated-bytes="estimatedBytes"
        :has-unknown-sizes="hasUnknownSizes"
        :checking="checkingDownload"
        :error="downloadError"
        :started="startedDownload"
        @download="downloadSelection"
        @download-again="downloadAgain"
        @clear="clearSelection"
        @dismiss="dismissDownload"
      />
    </div>

    <!-- Bulk access -->
    <section class="section bg-white dark:bg-gray-800">
      <div class="container text-center">
        <UiSectionHeader
          :title="$t('reports.bulk.promoTitle')"
          :description="$t('reports.bulk.promoDescription', { max: maxFiles })"
          size="sm"
        />
        <div class="flex flex-wrap justify-center gap-3">
          <button type="button" class="btn-primary" @click="goToReportList">
            {{ $t('reports.bulk.promoAction') }}
          </button>
          <NuxtLink to="/contact" class="btn-outline">{{ $t('common.contact') }}</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { AuditCategory } from '~/types'

  // SEO
  useSeoMeta({
    title: "Auditor-General's Reports",
    description:
      'Access comprehensive audit reports on public accounts, ministries, departments, and agencies across Ghana.'
  })

  const route = useRoute()
  const router = useRouter()
  const { reports, loading, error, meta, fetchReports } = useReports()
  const { reports: featuredList, fetchReports: fetchFeatured } = useReports()

  const featuredReport = computed(() => featuredList.value[0] ?? null)
  const showFeatured = computed(() => featuredReport.value !== null && meta.value.page === 1)
  const displayedReports = computed(() =>
    featuredReport.value
      ? reports.value.filter((r) => r.id !== featuredReport.value!.id)
      : reports.value
  )

  // Bulk download: tick reports, download them together as one ZIP.
  const { t } = useI18n()
  const {
    count: selectedCount,
    isFull: selectionFull,
    estimatedBytes,
    hasUnknownSizes,
    maxFiles,
    checking: checkingDownload,
    error: downloadError,
    started: startedDownload,
    isSelected,
    toggle: toggleSelection,
    selectAll,
    deselectAll,
    clear: clearSelection,
    dismiss: dismissDownload,
    download: downloadSelection,
    downloadAgain
  } = useReportBulkDownload()
  const listSection = ref<HTMLElement | null>(null)

  const limitReason = computed(() => t('reports.bulk.limitReached', { max: maxFiles }))

  // Every report the visitor can see on this page, the featured one included.
  const pageReports = computed(() =>
    showFeatured.value && featuredReport.value
      ? [featuredReport.value, ...displayedReports.value]
      : displayedReports.value
  )
  const allOnPageSelected = computed(
    () => pageReports.value.length > 0 && pageReports.value.every((r) => isSelected(r.id))
  )

  function togglePageSelection() {
    if (allOnPageSelected.value) deselectAll(pageReports.value)
    else selectAll(pageReports.value)
  }

  function goToReportList() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    listSection.value?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
    listSection.value?.focus({ preventScroll: true })
  }

  // Filters
  const filters = reactive({
    search: '',
    category: '' as AuditCategory | '',
    year: '' as number | ''
  })

  let syncingUrl = false

  function applyQueryParams() {
    const q = route.query
    filters.category = (typeof q.category === 'string' ? q.category : '') as AuditCategory | ''
    filters.search = typeof q.search === 'string' ? q.search : ''
    filters.year = q.year ? Number(q.year) : ''
    meta.value.page = q.page ? Number(q.page) : 1
  }

  // Fetch reports on mount, reading any query params
  onMounted(() => {
    applyQueryParams()
    fetchFilteredReports()
  })

  // Re-apply filters when navigating between menu items (client-side)
  watch(
    () => route.query,
    () => {
      if (syncingUrl) return
      applyQueryParams()
      fetchFilteredReports()
    }
  )

  function onFilterChange() {
    meta.value.page = 1
    fetchFilteredReports()
  }

  async function fetchFilteredReports() {
    syncQueryToUrl()
    const listPromise = fetchReports({
      search: filters.search || undefined,
      category: filters.category || undefined,
      year: filters.year || undefined,
      page: meta.value.page,
      perPage: 12
    })

    if (meta.value.page === 1) {
      await Promise.all([
        listPromise,
        fetchFeatured({ category: 'performance', perPage: 1, page: 1 })
      ])
    } else {
      featuredList.value = []
      await listPromise
    }
  }

  function syncQueryToUrl() {
    const query: Record<string, string> = {}
    if (filters.category) query.category = filters.category
    if (filters.search) query.search = filters.search
    if (filters.year) query.year = String(filters.year)
    if (meta.value.page > 1) query.page = String(meta.value.page)
    syncingUrl = true
    router.replace({ query }).finally(() => {
      nextTick(() => {
        syncingUrl = false
      })
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
