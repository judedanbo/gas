<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'A-G Reports', path: '/reports' },
        { label: report?.title || 'Report Details', path: `/reports/${route.params.id}` }
      ]"
    />

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container">
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="section">
      <div class="container text-center py-12">
        <Icon
          name="heroicons:document-text"
          class="w-16 h-16 text-primary mb-4 mx-auto"
          aria-hidden="true"
        />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Report Not Found</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          The report you're looking for doesn't exist or has been removed.
        </p>
        <NuxtLink to="/reports" class="btn-primary"> Back to Reports </NuxtLink>
      </div>
    </div>

    <!-- Report Content -->
    <template v-else-if="report">
      <!-- Report Header -->
      <section class="bg-gradient-to-br from-primary to-primary-dark text-white py-12">
        <div class="container">
          <div class="max-w-4xl">
            <UiBadge :variant="getAuditCategoryVariant(report.category)" size="md" class="mb-4">
              {{ getAuditCategoryLabel(report.category) }}
            </UiBadge>

            <h1 class="text-3xl md:text-4xl font-heading font-bold text-white mb-6">
              {{ report.title }}
            </h1>

            <div class="flex flex-wrap gap-6 text-white/90">
              <UiIconText icon="calendar" size="md" color="white" gap="sm">
                Published: {{ formatDate(report.publishedAt) }}
              </UiIconText>
              <UiIconText icon="folder" size="md" color="white" gap="sm">
                Year: {{ new Date(report.publishedAt).getFullYear() }}
              </UiIconText>
              <UiIconText icon="file" size="md" color="white" gap="sm">
                File Size: {{ report.fileSize }}
              </UiIconText>
            </div>
          </div>
        </div>
      </section>

      <!-- Report Details -->
      <section class="section">
        <div class="container">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- PDF Reader -->
            <div class="lg:col-span-2">
              <ClientOnly>
                <ReportsPdfReader :file-url="report.fileUrl" :title="report.title" />
                <template #fallback>
                  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 min-h-[70vh] flex items-center justify-center">
                    <UiLoadingSpinner />
                  </div>
                </template>
              </ClientOnly>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1">
              <div
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-24"
              >
                <!-- Report Cover Thumbnail -->
                <div class="aspect-[4/3] w-full bg-gray-100 dark:bg-gray-700">
                  <img
                    :src="report.thumbnail || '/img/reports/default-cover.png'"
                    :alt="report.title"
                    class="w-full h-full object-cover object-top"
                  />
                </div>

                <div class="p-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Download Report
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Access the full report in PDF format.
                </p>

                <a :href="report.fileUrl" class="btn-primary w-full justify-center mb-4" download>
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Download PDF ({{ report.fileSize }})
                </a>

                <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Report Details
                  </h4>
                  <dl class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <dt class="text-gray-500 dark:text-gray-400">Category:</dt>
                      <dd class="text-gray-900 dark:text-white font-medium">
                        {{ getAuditCategoryLabel(report.category) }}
                      </dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-gray-500 dark:text-gray-400">Year:</dt>
                      <dd class="text-gray-900 dark:text-white font-medium">{{ new Date(report.publishedAt).getFullYear() }}</dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-gray-500 dark:text-gray-400">Published:</dt>
                      <dd class="text-gray-900 dark:text-white font-medium">
                        {{ formatDate(report.publishedAt) }}
                      </dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-gray-500 dark:text-gray-400">File Size:</dt>
                      <dd class="text-gray-900 dark:text-white font-medium">
                        {{ report.fileSize }}
                      </dd>
                    </div>
                  </dl>
                </div>

                <NuxtLink to="/reports" class="btn-outline w-full justify-center mt-4">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Back to Reports
                </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Related Reports -->
      <section class="section bg-gray-50 dark:bg-gray-900">
        <div class="container">
          <UiSectionHeader
            title="Related Reports"
            :description="`More ${getAuditCategoryLabel(report.category).toLowerCase()}s from the Auditor-General`"
            size="sm"
          />

          <div
            v-if="relatedReports.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <ReportsReportCard
              v-for="related in relatedReports"
              :key="related.id"
              :report="related"
            />
          </div>

          <div v-else class="text-center py-8 text-gray-600 dark:text-gray-400">
            No related reports found.
          </div>

          <div class="text-center mt-8">
            <NuxtLink to="/reports" class="btn-outline"> View All Reports </NuxtLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AuditReport } from '~/types'

  const route = useRoute()
  const { getAuditCategoryVariant, getAuditCategoryLabel } = useCategoryBadge()
  const { getReportSchema, getBreadcrumbSchema } = useSchemaOrg()

  // Fetch report
  const {
    data: report,
    pending,
    error
  } = await useFetch<AuditReport>(`/api/reports/${route.params.id}`)

  // Fetch related reports (same category, different id)
  const relatedReports = ref<AuditReport[]>([])

  watchEffect(async () => {
    if (report.value) {
      try {
        const response = await $fetch<{ data: AuditReport[] }>('/api/reports', {
          query: {
            category: report.value.category,
            perPage: 3
          }
        })
        relatedReports.value = response.data.filter((r) => r.id !== report.value?.id).slice(0, 3)
      } catch {
        relatedReports.value = []
      }
    }
  })

  // SEO with structured data
  watchEffect(() => {
    if (report.value) {
      const schemas = [
        getReportSchema({
          title: report.value.title,
          summary: report.value.summary,
          publishedAt: report.value.publishedAt,
          category: getAuditCategoryLabel(report.value.category),
          fileUrl: report.value.fileUrl,
          id: report.value.id
        }),
        getBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'A-G Reports', url: '/reports' },
          { name: report.value.title, url: `/reports/${report.value.id}` }
        ])
      ]

      useHead({
        script: [
          {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(schemas)
          }
        ]
      })
    }
  })

  useSeoMeta({
    title: () =>
      report.value ? `${report.value.title} | Ghana Audit Service` : 'Report | Ghana Audit Service',
    description: () => report.value?.summary || 'Audit report from the Ghana Audit Service'
  })

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
</script>
