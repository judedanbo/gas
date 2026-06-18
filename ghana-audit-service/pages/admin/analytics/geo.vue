<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Visitor Geolocation</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Where visits come from, by country and network (ASN). Resolved at capture time from
          MaxMind GeoIP.
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
          ← Overview
        </NuxtLink>
      </div>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {{ error }}
    </div>

    <!-- Totals -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Visits</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {{ formatNumber(data?.totals.visits) }}
        </div>
      </div>
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Unique IPs
        </div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {{ formatNumber(data?.totals.uniqueIps) }}
        </div>
      </div>
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Geo-resolved
        </div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {{ geoResolvedPct }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          of visits had a country (else MMDB not mounted)
        </div>
      </div>
    </div>

    <!-- Top countries chart -->
    <div
      class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">
        Top countries by visits
      </h2>
      <div class="h-72">
        <AdminAnalyticsEChart :option="chartOption" :loading="loading" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Countries table -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Countries</h2>
        </div>
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th class="px-3 py-2 font-medium">Country</th>
              <th class="px-3 py-2 text-right font-medium">Visits</th>
              <th class="px-3 py-2 text-right font-medium">Unique IPs</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
            <tr v-for="c in data?.countries ?? []" :key="c.country ?? 'unknown'">
              <td class="px-3 py-2 text-gray-900 dark:text-white">
                <span class="font-mono text-xs text-gray-500 dark:text-gray-400"
                  >{{ c.country || '??' }} </span
                >{{ countryLabel(c.country) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(c.visits) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatNumber(c.uniqueIps) }}
              </td>
            </tr>
            <tr v-if="!loading && !data?.countries?.length">
              <td colspan="3" class="px-3 py-6 text-center text-gray-400">No data in window</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ASNs table -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Networks (ASN)</h2>
        </div>
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th class="px-3 py-2 font-medium">ASN</th>
              <th class="px-3 py-2 text-right font-medium">Visits</th>
              <th class="px-3 py-2 text-right font-medium">Unique IPs</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
            <tr v-for="a in data?.asns ?? []" :key="a.asn ?? 'unknown'">
              <td class="px-3 py-2 font-mono text-xs text-gray-900 dark:text-white">
                AS{{ a.asn ?? '—' }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(a.visits) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatNumber(a.uniqueIps) }}
              </td>
            </tr>
            <tr v-if="!loading && !data?.asns?.length">
              <td colspan="3" class="px-3 py-6 text-center text-gray-400">No ASN data in window</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { EChartsOption } from 'echarts'
  import type { AnalyticsWindow, GeoResponse } from '~/composables/useAnalytics'

  definePageMeta({ layout: 'admin' })

  const { fetchGeo } = useAnalytics()
  const data = ref<GeoResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const windowKey = ref<AnalyticsWindow>('7d')

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      data.value = await fetchGeo(windowKey.value)
    } catch (err) {
      error.value = (err as { message?: string })?.message ?? 'Failed to load geolocation'
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

  const regionNames =
    typeof Intl !== 'undefined' && 'DisplayNames' in Intl
      ? new Intl.DisplayNames(['en'], { type: 'region' })
      : null
  function countryLabel(cc: string | null): string {
    if (!cc) return 'Unknown'
    try {
      return regionNames?.of(cc) ?? cc
    } catch {
      return cc
    }
  }

  const geoResolvedPct = computed(() => {
    const t = data.value?.totals
    if (!t || !t.visits) return '—'
    return `${Math.round((t.geoResolved / t.visits) * 100)}%`
  })

  const chartOption = computed<EChartsOption>(() => {
    const top = (data.value?.countries ?? []).slice(0, 15)
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 16, top: 16, bottom: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: top.map((c) => countryLabel(c.country)),
        axisLabel: { rotate: 45, fontSize: 10 }
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: top.map((c) => c.visits),
          itemStyle: { color: '#006B3F' },
          name: 'Visits'
        }
      ]
    }
  })
</script>
