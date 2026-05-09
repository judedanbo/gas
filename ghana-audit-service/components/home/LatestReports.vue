<template>
  <section class="section bg-white dark:bg-gray-800">
    <div class="container">
      <UiSectionHeader
        :title="$t('home.latestReports')"
        :description="$t('home.latestReportsDescription')"
      >
        <template #action>
          <NuxtLink to="/reports" class="btn-primary btn-sm">
            {{ $t('home.viewAllReports') }}
          </NuxtLink>
        </template>
      </UiSectionHeader>

      <!-- Loading State -->
      <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="n in 4"
          :key="n"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden animate-pulse"
        >
          <div class="aspect-[4/3] bg-gray-200 dark:bg-gray-700" />
          <div class="p-4 space-y-3">
            <div class="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div class="flex gap-3">
              <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              <div class="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div class="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p class="text-gray-600 dark:text-gray-400">
          {{ $t('home.unableToLoadReports') }}
        </p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!reports || reports.length === 0"
        class="text-center py-16 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <Icon name="heroicons:document-text" class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" aria-hidden="true" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Reports coming soon</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
          Audit reports are published periodically. Browse our archive for previously published reports.
        </p>
        <NuxtLink to="/reports" class="btn-primary btn-sm">Browse Report Archive</NuxtLink>
      </div>

      <!-- Reports Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportsReportCard v-for="report in reports" :key="report.id" :report="report" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { AuditReport, PaginatedResponse } from '~/types'

  const { data, pending, error } = await useFetch<PaginatedResponse<AuditReport>>('/api/reports', {
    query: { perPage: 4 }
  })

  const reports = computed(() => data.value?.data || [])
</script>
