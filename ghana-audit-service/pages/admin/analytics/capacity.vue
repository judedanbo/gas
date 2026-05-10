<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ $t('analytics.capacity.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('analytics.capacity.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="windowKey"
          class="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          @change="refresh"
        >
          <option value="30d">30 days</option>
          <option value="90d">90 days</option>
          <option value="365d">1 year</option>
        </select>
        <NuxtLink
          to="/admin/analytics"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          ← {{ $t('analytics.capacity.backToOverview') }}
        </NuxtLink>
      </div>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {{ error }}
    </div>

    <!-- Throughput + bandwidth chart -->
    <div
      class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">
        {{ $t('analytics.capacity.throughput.title') }}
      </h2>
      <div class="h-72">
        <AdminAnalyticsEChart :option="throughputOption" :loading="loading" />
      </div>
    </div>

    <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Cache hit ratio trend -->
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">
          {{ $t('analytics.capacity.cacheRatio.title') }}
        </h2>
        <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {{ $t('analytics.capacity.cacheRatio.hint') }}
        </p>
        <div class="h-56">
          <AdminAnalyticsEChart :option="cacheRatioOption" :loading="loading" />
        </div>
      </div>

      <!-- Day-of-week × hour-of-day heatmap -->
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">
          {{ $t('analytics.capacity.heatmap.title') }}
        </h2>
        <div class="h-56">
          <AdminAnalyticsEChart :option="heatmapOption" :loading="loading" />
        </div>
      </div>
    </div>

    <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Slowest routes -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.capacity.slowest.title') }}
          </h2>
        </div>
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.capacity.slowest.pattern') }}
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.capacity.slowest.p95') }}
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.capacity.slowest.visits') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!data?.slowestRoutes.length">
              <td class="px-4 py-3 text-center text-gray-500 dark:text-gray-400" colspan="3">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="r in data?.slowestRoutes" :key="r.pattern">
              <td class="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-200">
                {{ r.pattern }}
              </td>
              <td class="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ r.avgP95Ms }} ms
              </td>
              <td class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatNumber(r.visits) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Heaviest routes -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.capacity.heaviest.title') }}
          </h2>
        </div>
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.capacity.heaviest.pattern') }}
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.capacity.heaviest.bytes') }}
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.capacity.heaviest.avgPerVisit') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!data?.heaviestRoutes.length">
              <td class="px-4 py-3 text-center text-gray-500 dark:text-gray-400" colspan="3">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="r in data?.heaviestRoutes" :key="r.pattern">
              <td class="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-200">
                {{ r.pattern }}
              </td>
              <td class="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatBytes(r.bytes) }}
              </td>
              <td class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatBytes(r.avgBytesPerVisit) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Storage + Redis -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <AdminAnalyticsStatCard
        :label="$t('analytics.capacity.storage.rawRows')"
        :value="formatNumber(data?.storage.requestEventsRows)"
        :hint="storageOldestHint"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.capacity.storage.downloadRows')"
        :value="formatNumber(data?.storage.downloadEventsRows)"
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.capacity.redis.used')"
        :value="formatBytes(data?.redis.usedMemoryBytes ?? undefined)"
        :hint="
          data?.redis.peakMemoryBytes != null
            ? $t('analytics.capacity.redis.peak', {
                peak: formatBytes(data.redis.peakMemoryBytes)
              })
            : ''
        "
      />
      <AdminAnalyticsStatCard
        :label="$t('analytics.capacity.redis.keys')"
        :value="formatNumber(data?.redis.keyCount ?? undefined)"
        :hint="
          data?.redis.evictedKeys != null
            ? $t('analytics.capacity.redis.evicted', { evicted: data.redis.evictedKeys })
            : ''
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { EChartsOption } from 'echarts'
  import type { CapacityResponse, CapacityWindow } from '~/composables/useAnalytics'

  definePageMeta({ layout: 'admin' })

  const { fetchCapacity } = useAnalytics()
  const data = ref<CapacityResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const windowKey = ref<CapacityWindow>('30d')

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      data.value = await fetchCapacity(windowKey.value)
    } catch (err) {
      error.value = (err as { message?: string })?.message ?? 'Failed to load capacity stats'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void refresh()
  })

  function formatNumber(n: number | null | undefined): string {
    if (n == null) return '—'
    return new Intl.NumberFormat().format(n)
  }
  function formatBytes(n: number | null | undefined): string {
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

  const storageOldestHint = computed(() => {
    const oldest = data.value?.storage.oldestRequestEvent
    if (!oldest) return ''
    const days = Math.floor((Date.now() - new Date(oldest).getTime()) / 86_400_000)
    return `${days}d retained`
  })

  const throughputOption = computed<EChartsOption>(() => {
    const rows = data.value?.hourly ?? []
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Visits', 'Bytes'], top: 0 },
      grid: { left: 56, right: 56, top: 32, bottom: 24 },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.hour),
        axisLabel: {
          formatter: (v: string) => {
            const d = new Date(v)
            return `${d.getMonth() + 1}/${d.getDate()}`
          }
        }
      },
      yAxis: [
        { type: 'value', name: 'visits' },
        { type: 'value', name: 'bytes', position: 'right', splitLine: { show: false } }
      ],
      series: [
        {
          name: 'Visits',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: rows.map((r) => r.visits)
        },
        {
          name: 'Bytes',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: rows.map((r) => r.bytes)
        }
      ]
    }
  })

  const cacheRatioOption = computed<EChartsOption>(() => {
    const rows = data.value?.hourly ?? []
    const ratios = rows.map((r) => (r.visits > 0 ? r.cacheHits / r.visits : 0))
    return {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—')
      },
      grid: { left: 48, right: 16, top: 16, bottom: 24 },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.hour),
        axisLabel: { show: false }
      },
      yAxis: {
        type: 'value',
        max: 1,
        axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` }
      },
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: false,
          areaStyle: {},
          data: ratios
        }
      ]
    }
  })

  const heatmapOption = computed<EChartsOption>(() => {
    const cells = data.value?.heatmap ?? []
    const data2d = cells.map((c) => [c.hr, c.dow, c.avgVisits])
    const max = cells.reduce((m, c) => Math.max(m, c.avgVisits), 0)
    const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return {
      tooltip: {
        formatter: (params) => {
          // ECharts heatmap series passes `value` as [x, y, z]; the
          // top-level types are unioned so we narrow defensively here.
          const p = params as { value?: unknown }
          const v = Array.isArray(p.value) ? (p.value as [number, number, number]) : [0, 0, 0]
          return `${dows[v[1]]} ${String(v[0]).padStart(2, '0')}:00 — avg ${v[2]} visits`
        }
      },
      grid: { left: 48, right: 16, top: 16, bottom: 32 },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
        splitArea: { show: true }
      },
      yAxis: {
        type: 'category',
        data: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        splitArea: { show: true }
      },
      visualMap: {
        min: 0,
        max: Math.max(1, max),
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        show: false
      },
      series: [
        {
          type: 'heatmap',
          data: data2d,
          label: { show: false },
          emphasis: { itemStyle: { shadowBlur: 6 } }
        }
      ]
    }
  })
</script>
