<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ $t('analytics.insights.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('analytics.insights.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="windowKey"
          class="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          @change="refresh"
        >
          <option value="24h">24h</option>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
        </select>
        <NuxtLink
          to="/admin/analytics"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          ← {{ $t('analytics.insights.backToOverview') }}
        </NuxtLink>
      </div>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Top searches -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.insights.topSearches.title') }}
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('analytics.insights.topSearches.hint') }}
          </p>
        </div>
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.topSearches.cols.query') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.topSearches.cols.count') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.topSearches.cols.avgResults') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!loading && !data?.topQueries.length">
              <td class="px-3 py-3 text-center text-gray-500 dark:text-gray-400" colspan="3">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="q in data?.topQueries" :key="q.queryHash">
              <td class="px-3 py-2 text-gray-700 dark:text-gray-200">
                <div class="break-words">{{ q.sampleText }}</div>
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(q.count) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ q.avgResults }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Zero-result searches -->
      <div
        class="rounded-lg border border-amber-200 bg-amber-50/30 shadow-sm dark:border-amber-900 dark:bg-amber-950/20"
      >
        <div class="border-b border-amber-200 px-4 py-3 dark:border-amber-900">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.insights.zeroResults.title') }}
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('analytics.insights.zeroResults.hint') }}
          </p>
        </div>
        <table class="min-w-full divide-y divide-amber-200 text-sm dark:divide-amber-900">
          <thead>
            <tr>
              <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.zeroResults.cols.query') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.zeroResults.cols.count') }}
              </th>
              <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.zeroResults.cols.lastSeen') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-amber-200 dark:divide-amber-900">
            <tr v-if="!loading && !data?.zeroResultQueries.length">
              <td class="px-3 py-3 text-center text-gray-500 dark:text-gray-400" colspan="3">
                {{ $t('analytics.insights.zeroResults.empty') }}
              </td>
            </tr>
            <tr v-for="q in data?.zeroResultQueries" :key="q.queryHash">
              <td class="px-3 py-2 text-gray-700 dark:text-gray-200">
                <div class="break-words">{{ q.sampleText }}</div>
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(q.count) }}
              </td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                {{ formatRelative(q.lastSeen) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 404 hot list -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.insights.notFound.title') }}
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('analytics.insights.notFound.hint') }}
          </p>
        </div>
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.notFound.cols.path') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.notFound.cols.hits') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.insights.notFound.cols.uniqueIps') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!loading && !data?.hotNotFound.length">
              <td class="px-3 py-3 text-center text-gray-500 dark:text-gray-400" colspan="3">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="r in data?.hotNotFound" :key="r.routePath">
              <td class="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-200">
                <div class="break-words">{{ r.routePath }}</div>
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(r.count) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatNumber(r.uniqueIps) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { InsightsResponse, InsightsWindow } from '~/composables/useAnalytics'

  definePageMeta({ layout: 'admin' })

  const { fetchInsights } = useAnalytics()
  const data = ref<InsightsResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const windowKey = ref<InsightsWindow>('7d')

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      data.value = await fetchInsights(windowKey.value)
    } catch (err) {
      error.value = (err as { message?: string })?.message ?? 'Failed to load insights'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void refresh()
  })

  function formatNumber(n: number | undefined): string {
    if (n == null) return '—'
    return new Intl.NumberFormat().format(n)
  }

  const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  function formatRelative(iso: string | null | undefined): string {
    if (!iso) return '—'
    const diffMs = new Date(iso).getTime() - Date.now()
    const diffMin = Math.round(diffMs / 60_000)
    if (Math.abs(diffMin) < 60) return RTF.format(diffMin, 'minute')
    const diffHr = Math.round(diffMin / 60)
    if (Math.abs(diffHr) < 48) return RTF.format(diffHr, 'hour')
    const diffDay = Math.round(diffHr / 24)
    return RTF.format(diffDay, 'day')
  }
</script>
