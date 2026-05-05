<template>
  <section class="section bg-white dark:bg-gray-800">
    <div class="container">
      <UiSectionHeader
        title="Latest Audit Reports"
        description="Access the most recent reports from the Auditor-General"
        with-action
        action-text="View All Reports"
        action-to="/reports"
      />

      <!-- Loading State -->
      <div v-if="pending" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="n in 4"
          :key="n"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse"
        >
          <div class="flex justify-between items-center mb-3">
            <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
          <div class="space-y-2 mb-4">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
          <div class="flex gap-4 mb-4">
            <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div class="flex gap-2">
            <div class="h-8 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-8 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p class="text-gray-600 dark:text-gray-400">
          Unable to load reports. Please try again later.
        </p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!reports || reports.length === 0"
        class="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg"
      >
        <Icon name="heroicons:document-text" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p class="text-gray-600 dark:text-gray-400">No reports available at this time.</p>
      </div>

      <!-- Reports Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <article
          v-for="report in reports"
          :key="report.id"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex flex-col transition-all hover:border-primary hover:shadow-lg"
        >
          <div class="flex justify-between items-center mb-3">
            <UiBadge :variant="getAuditCategoryVariant(report.category)" size="sm">
              {{ getAuditCategoryLabel(report.category) }}
            </UiBadge>
            <span class="text-sm font-semibold text-gray-400 dark:text-gray-500">{{
              report.year
            }}</span>
          </div>
          <h3 class="text-lg font-semibold leading-snug mb-3">
            <NuxtLink
              :to="`/reports/${report.id}`"
              class="text-gray-900 dark:text-white no-underline transition-colors hover:text-primary dark:hover:text-primary-light"
            >
              {{ report.title }}
            </NuxtLink>
          </h3>
          <p
            class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4 flex-grow line-clamp-3"
          >
            {{ report.summary }}
          </p>
          <div class="flex gap-4 mb-4">
            <UiIconText icon="heroicons:calendar" size="xs" color="muted" gap="sm">
              {{ formatDate(report.publishedAt) }}
            </UiIconText>
            <UiIconText icon="heroicons:document-text" size="xs" color="muted" gap="sm">
              {{ report.fileSize }}
            </UiIconText>
          </div>
          <div class="flex gap-2 mt-auto">
            <NuxtLink
              :to="`/reports/${report.id}`"
              class="btn-outline btn-xs flex-1 justify-center"
            >
              View Details
            </NuxtLink>
            <UiDownloadButton :href="report.fileUrl" variant="primary" size="xs" class="flex-1">
              Download
            </UiDownloadButton>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { AuditReport, PaginatedResponse } from '~/types'

  // Fetch latest 4 reports from API
  const { data, pending, error } = await useFetch<PaginatedResponse<AuditReport>>('/api/reports', {
    query: { perPage: 4 }
  })

  // Extract reports from paginated response
  const reports = computed(() => data.value?.data || [])

  // Use composable for consistent badge styling
  const { getAuditCategoryVariant, getAuditCategoryLabel } = useCategoryBadge()

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }
</script>
