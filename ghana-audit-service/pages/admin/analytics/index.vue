<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ $t('analytics.overview.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('analytics.overview.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink
          to="/admin/analytics/routes"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {{ $t('analytics.overview.viewRoutes') }}
        </NuxtLink>
        <NuxtLink
          to="/admin/analytics/report"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {{ $t('analytics.report.openReport') }}
        </NuxtLink>
        <button
          type="button"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          :disabled="downloadingPdf"
          @click="onDownloadPdf"
        >
          {{
            downloadingPdf ? $t('analytics.report.generating') : $t('analytics.report.downloadPdf')
          }}
        </button>
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          :disabled="loading"
          @click="refresh"
        >
          {{ $t('analytics.overview.refresh') }}
        </button>
      </div>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {{ error }}
    </div>

    <!-- Top-line stats -->
    <div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
      <AdminAnalyticsStatCard
        :label="$t('analytics.overview.cards.visits')"
        :value="formatNumber(data?.last24h.visits)"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.overview.cards.uniqueIps')"
        :value="formatNumber(data?.last24h.uniqueIps)"
        :hint="$t('analytics.overview.approximate')"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.overview.cards.downloads')"
        :value="formatNumber(data?.last24h.downloads)"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.overview.cards.bandwidth')"
        :value="formatBytes(data?.last24h.bytes)"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.overview.cards.botShare')"
        :value="formatPercent(data?.last24h.botShare)"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.overview.cards.errorRate')"
        :value="formatPercent(data?.last24h.errorRate)"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.overview.cards.cacheHit')"
        :value="formatPercent(data?.last24h.cacheHitRate)"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.overview.cards.p95Latency')"
        :value="data?.last24h.avgP95Ms ? `${data.last24h.avgP95Ms} ms` : '—'"
        :hint="$t('analytics.overview.weighted')"
      />
    </div>

    <!-- Hourly chart -->
    <div
      class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ $t('analytics.overview.hourly.title') }}
        </h2>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {{ $t('analytics.overview.hourly.window') }}
        </span>
      </div>
      <div class="h-72">
        <AdminAnalyticsEChart :option="hourlyOption" :loading="loading" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Top routes -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.overview.topRoutes.title') }}
          </h2>
        </div>
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.overview.topRoutes.pattern') }}
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.overview.topRoutes.visits') }}
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.overview.topRoutes.p95') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!data?.topRoutes.length">
              <td class="px-4 py-3 text-center text-gray-500 dark:text-gray-400" colspan="3">
                {{ loading ? $t('analytics.loading') : $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="r in data?.topRoutes" :key="r.pattern">
              <td class="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-200">
                <NuxtLink
                  :to="`/admin/analytics/routes?pattern=${encodeURIComponent(r.pattern)}`"
                  class="hover:underline"
                >
                  {{ r.pattern }}
                </NuxtLink>
              </td>
              <td class="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(r.visits) }}
              </td>
              <td class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ r.p95Ms }} ms
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Top downloads -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.overview.topDownloads.title') }}
          </h2>
        </div>
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.overview.topDownloads.target') }}
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.overview.topDownloads.count') }}
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.overview.topDownloads.bytes') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!data?.topDownloads.length">
              <td class="px-4 py-3 text-center text-gray-500 dark:text-gray-400" colspan="3">
                {{ loading ? $t('analytics.loading') : $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="d in data?.topDownloads" :key="`${d.kind}-${d.targetId}`">
              <td class="px-4 py-2 text-gray-700 dark:text-gray-200">
                <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">
                  {{ d.kind }}
                </span>
                <span class="ml-2 font-mono text-xs">{{ d.slug || `#${d.targetId}` }}</span>
              </td>
              <td class="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(d.count) }}
              </td>
              <td class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatBytes(d.bytes) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Form submissions cross-reference -->
    <div class="mt-6">
      <h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">
        {{ $t('analytics.overview.forms.title') }}
      </h2>
      <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {{ $t('analytics.overview.forms.subtitle') }}
      </p>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          v-for="f in formData?.items"
          :key="f.pattern"
          :class="[
            'rounded-lg border p-4 shadow-sm',
            f.hasSuspectAccepts
              ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/30'
              : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
          ]"
        >
          <div class="mb-3 flex items-center justify-between">
            <div class="font-mono text-xs text-gray-700 dark:text-gray-200">
              {{ f.pattern }}
            </div>
            <span
              v-if="f.hasSuspectAccepts"
              class="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              :title="$t('analytics.overview.forms.suspectHint')"
            >
              ⚠ {{ $t('analytics.overview.forms.suspect') }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div class="text-gray-500 dark:text-gray-400">
                {{ $t('analytics.overview.forms.accepted') }}
              </div>
              <div class="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {{ formatNumber(f.accepted) }}
              </div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400">
                {{ $t('analytics.overview.forms.rejected') }}
              </div>
              <div class="text-lg font-semibold text-red-700 dark:text-red-300">
                {{ formatNumber(f.rejected) }}
              </div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400">
                {{ $t('analytics.overview.forms.uniqueIps') }}
              </div>
              <div class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ formatNumber(f.uniqueIps) }}
              </div>
            </div>
          </div>
          <div v-if="f.accepted > 0" class="mt-3 grid grid-cols-4 gap-1 text-center text-[11px]">
            <div class="rounded bg-gray-100 px-1 py-1 dark:bg-gray-700">
              <div class="text-gray-500 dark:text-gray-400">clean</div>
              <div class="font-semibold text-gray-900 dark:text-white">
                {{ f.accepted_from.clean }}
              </div>
            </div>
            <div class="rounded bg-blue-100 px-1 py-1 dark:bg-blue-950/40">
              <div class="text-gray-500 dark:text-gray-400">crawler</div>
              <div class="font-semibold text-blue-700 dark:text-blue-300">
                {{ f.accepted_from.crawler }}
              </div>
            </div>
            <div class="rounded bg-amber-100 px-1 py-1 dark:bg-amber-950/40">
              <div class="text-gray-500 dark:text-gray-400">suspicious</div>
              <div class="font-semibold text-amber-700 dark:text-amber-300">
                {{ f.accepted_from.suspicious }}
              </div>
            </div>
            <div class="rounded bg-red-100 px-1 py-1 dark:bg-red-950/40">
              <div class="text-gray-500 dark:text-gray-400">abusive</div>
              <div class="font-semibold text-red-700 dark:text-red-300">
                {{ f.accepted_from.abusive }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { EChartsOption } from 'echarts'
  import type { AnalyticsOverview, FormSubmissionsResponse } from '~/composables/useAnalytics'

  definePageMeta({ layout: 'admin' })

  const { fetchOverview, fetchFormSubmissions, downloadReportPdf } = useAnalytics()
  const toast = useToast()
  const data = ref<AnalyticsOverview | null>(null)
  const formData = ref<FormSubmissionsResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const downloadingPdf = ref(false)

  async function onDownloadPdf() {
    if (downloadingPdf.value) return
    downloadingPdf.value = true
    try {
      await downloadReportPdf('7d')
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      toast.error(err.data?.message || err.message || 'PDF download failed')
    } finally {
      downloadingPdf.value = false
    }
  }

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      // Fire both in parallel — independent endpoints, same auth + cache
      // policy. If form-submissions fails we keep the rest of the page.
      const [overview, forms] = await Promise.allSettled([
        fetchOverview(),
        fetchFormSubmissions('24h')
      ])
      if (overview.status === 'fulfilled') data.value = overview.value
      else
        error.value =
          (overview.reason as { message?: string })?.message ?? 'Failed to load analytics overview'
      if (forms.status === 'fulfilled') formData.value = forms.value
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void refresh()
  })

  // Refresh every 30 s.
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    timer = setInterval(() => {
      if (!loading.value) void refresh()
    }, 30_000)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  function formatNumber(n: number | undefined): string {
    if (n == null) return '—'
    return new Intl.NumberFormat().format(n)
  }
  function formatPercent(n: number | undefined): string {
    if (n == null) return '—'
    return `${(n * 100).toFixed(1)}%`
  }
  function formatBytes(n: number | undefined): string {
    if (n == null || n === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let v = n
    let i = 0
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024
      i++
    }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
  }

  const hourlyOption = computed<EChartsOption>(() => {
    const rows = data.value?.hourly ?? []
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Human', 'Bot'], top: 0 },
      grid: { left: 40, right: 16, top: 32, bottom: 24 },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.hour),
        axisLabel: {
          formatter: (v: string) => {
            const d = new Date(v)
            return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`
          }
        }
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'Human',
          type: 'line',
          stack: 'visits',
          areaStyle: {},
          smooth: true,
          showSymbol: false,
          data: rows.map((r) => r.humanVisits)
        },
        {
          name: 'Bot',
          type: 'line',
          stack: 'visits',
          areaStyle: {},
          smooth: true,
          showSymbol: false,
          data: rows.map((r) => r.botVisits)
        }
      ]
    }
  })
</script>
