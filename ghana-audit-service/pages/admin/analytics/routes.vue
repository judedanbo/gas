<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ $t('analytics.routes.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('analytics.routes.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink
          to="/admin/analytics"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          ← {{ $t('analytics.routes.backToOverview') }}
        </NuxtLink>
      </div>
    </div>

    <!-- Filters -->
    <div
      class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="flex items-center gap-2">
        <label class="text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ $t('analytics.routes.window') }}
        </label>
        <select
          v-model="windowKey"
          class="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="24h">24h</option>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ $t('analytics.routes.sort') }}
        </label>
        <select
          v-model="sortKey"
          class="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="visits">{{ $t('analytics.routes.cols.visits') }}</option>
          <option value="benefit">{{ $t('analytics.routes.cols.benefit') }}</option>
          <option value="p95">{{ $t('analytics.routes.cols.p95') }}</option>
          <option value="errorRate">{{ $t('analytics.routes.cols.errorRate') }}</option>
          <option value="cacheHitRate">{{ $t('analytics.routes.cols.cacheHitRate') }}</option>
          <option value="bytes">{{ $t('analytics.routes.cols.bytes') }}</option>
        </select>
      </div>
      <input
        v-model="searchQuery"
        type="search"
        class="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        :placeholder="$t('analytics.routes.searchPlaceholder')"
      />
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Routes table -->
      <div
        class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2"
      >
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.routes.cols.pattern') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.routes.cols.visits') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.routes.cols.p95') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.routes.cols.errorRate') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.routes.cols.cacheHitRate') }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.routes.cols.bytes') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!loading && !routes?.items.length">
              <td class="px-3 py-3 text-center text-gray-500 dark:text-gray-400" colspan="6">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr
              v-for="r in routes?.items"
              :key="r.pattern"
              :class="[
                'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50',
                selectedPattern === r.pattern ? 'bg-primary/10 dark:bg-primary/20' : ''
              ]"
              @click="selectPattern(r.pattern)"
            >
              <td class="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-200">
                {{ r.pattern }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(r.visits) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ r.p95Ms }} ms
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatPercent(r.errorRate) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatPercent(r.cacheHitRate) }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {{ formatBytes(r.bytes) }}
              </td>
            </tr>
          </tbody>
        </table>
        <!-- Pagination -->
        <div
          v-if="(routes?.meta.lastPage ?? 1) > 1"
          class="flex items-center justify-between border-t border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400"
        >
          <span>
            {{
              $t('analytics.routes.pagination', {
                page: routes?.meta.page,
                last: routes?.meta.lastPage,
                total: routes?.meta.total
              })
            }}
          </span>
          <div class="flex gap-1">
            <button
              type="button"
              class="rounded border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-600"
              :disabled="page <= 1"
              @click="page = Math.max(1, page - 1)"
            >
              ‹
            </button>
            <button
              type="button"
              class="rounded border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-600"
              :disabled="page >= (routes?.meta.lastPage ?? 1)"
              @click="page = page + 1"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <!-- Detail panel -->
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div v-if="!selectedPattern" class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('analytics.routes.detail.empty') }}
        </div>
        <div v-else>
          <div class="mb-3 break-words font-mono text-xs text-gray-700 dark:text-gray-200">
            {{ selectedPattern }}
          </div>
          <div v-if="detailError" class="mb-2 text-xs text-red-600 dark:text-red-300">
            {{ detailError }}
          </div>
          <div v-if="detail" class="space-y-3">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-900/50">
                <div class="text-gray-500 dark:text-gray-400">
                  {{ $t('analytics.routes.detail.visits') }}
                </div>
                <div class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ formatNumber(detail.totals.visits) }}
                </div>
              </div>
              <div class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-900/50">
                <div class="text-gray-500 dark:text-gray-400">
                  {{ $t('analytics.routes.detail.uniqueIps') }}
                </div>
                <div class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ formatNumber(detail.totals.uniqueIps) }}
                </div>
              </div>
              <div class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-900/50">
                <div class="text-gray-500 dark:text-gray-400">
                  {{ $t('analytics.routes.detail.p95') }}
                </div>
                <div class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ detail.totals.maxP95Ms }} ms
                </div>
              </div>
              <div class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-900/50">
                <div class="text-gray-500 dark:text-gray-400">
                  {{ $t('analytics.routes.detail.bytes') }}
                </div>
                <div class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ formatBytes(detail.totals.bytes) }}
                </div>
              </div>
            </div>

            <div class="h-44">
              <AdminAnalyticsEChart :option="detailHourlyOption" :loading="detailLoading" />
            </div>

            <div>
              <h3
                class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {{ $t('analytics.routes.detail.statusMix') }}
              </h3>
              <div class="grid grid-cols-4 gap-1 text-center text-xs">
                <div class="rounded bg-emerald-50 px-2 py-1 dark:bg-emerald-950/40">
                  <div class="text-gray-500 dark:text-gray-400">2xx</div>
                  <div class="font-semibold text-emerald-700 dark:text-emerald-300">
                    {{ formatNumber(detail.totals.status['2xx']) }}
                  </div>
                </div>
                <div class="rounded bg-blue-50 px-2 py-1 dark:bg-blue-950/40">
                  <div class="text-gray-500 dark:text-gray-400">3xx</div>
                  <div class="font-semibold text-blue-700 dark:text-blue-300">
                    {{ formatNumber(detail.totals.status['3xx']) }}
                  </div>
                </div>
                <div class="rounded bg-amber-50 px-2 py-1 dark:bg-amber-950/40">
                  <div class="text-gray-500 dark:text-gray-400">4xx</div>
                  <div class="font-semibold text-amber-700 dark:text-amber-300">
                    {{ formatNumber(detail.totals.status['4xx']) }}
                  </div>
                </div>
                <div class="rounded bg-red-50 px-2 py-1 dark:bg-red-950/40">
                  <div class="text-gray-500 dark:text-gray-400">5xx</div>
                  <div class="font-semibold text-red-700 dark:text-red-300">
                    {{ formatNumber(detail.totals.status['5xx']) }}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3
                class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {{ $t('analytics.routes.detail.topIps') }}
              </h3>
              <table class="min-w-full text-xs">
                <thead>
                  <tr class="text-gray-500 dark:text-gray-400">
                    <th class="py-1 text-left font-medium">IP</th>
                    <th class="py-1 text-left font-medium">UA</th>
                    <th class="py-1 text-right font-medium">
                      {{ $t('analytics.routes.detail.requests') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ip in detail.topIps" :key="ip.ipHash">
                    <td class="font-mono text-[11px] text-gray-700 dark:text-gray-200">
                      {{ ip.ipHash.slice(0, 8) }}…
                    </td>
                    <td class="text-gray-600 dark:text-gray-300">{{ ip.uaFamily }}</td>
                    <td class="text-right tabular-nums text-gray-900 dark:text-white">
                      {{ formatNumber(ip.visits) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { EChartsOption } from 'echarts'
  import type {
    AnalyticsRoutesResponse,
    AnalyticsRouteDetail,
    AnalyticsWindow,
    RoutesQuery
  } from '~/composables/useAnalytics'

  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const { fetchRoutes, fetchRouteDetail } = useAnalytics()

  const routes = ref<AnalyticsRoutesResponse | null>(null)
  const detail = ref<AnalyticsRouteDetail | null>(null)
  const loading = ref(false)
  const detailLoading = ref(false)
  const error = ref<string | null>(null)
  const detailError = ref<string | null>(null)

  const windowKey = ref<AnalyticsWindow>((route.query.window as AnalyticsWindow) || '7d')
  const sortKey = ref<NonNullable<RoutesQuery['sort']>>(
    (route.query.sort as RoutesQuery['sort']) || 'visits'
  )
  const searchQuery = ref<string>(typeof route.query.q === 'string' ? route.query.q : '')
  const page = ref<number>(Number(route.query.page) || 1)
  const selectedPattern = ref<string | null>(
    typeof route.query.pattern === 'string' ? route.query.pattern : null
  )

  // Debounced search to avoid hammering the API on every keystroke.
  let searchDebounce: ReturnType<typeof setTimeout> | null = null
  watch(searchQuery, () => {
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      page.value = 1
      void loadRoutes()
    }, 300)
  })

  watch([windowKey, sortKey, page], () => {
    void loadRoutes()
    if (selectedPattern.value) void loadDetail(selectedPattern.value)
  })

  async function loadRoutes() {
    loading.value = true
    error.value = null
    try {
      routes.value = await fetchRoutes({
        window: windowKey.value,
        sort: sortKey.value,
        dir: 'desc',
        q: searchQuery.value || undefined,
        page: page.value
      })
    } catch (err) {
      error.value = (err as { message?: string })?.message ?? 'Failed to load routes'
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(pattern: string) {
    detailLoading.value = true
    detailError.value = null
    try {
      detail.value = await fetchRouteDetail(pattern, windowKey.value)
    } catch (err) {
      detailError.value = (err as { message?: string })?.message ?? 'Failed to load route detail'
    } finally {
      detailLoading.value = false
    }
  }

  function selectPattern(pattern: string) {
    selectedPattern.value = pattern
    void router.replace({ query: { ...route.query, pattern } })
    void loadDetail(pattern)
  }

  onMounted(() => {
    void loadRoutes()
    if (selectedPattern.value) void loadDetail(selectedPattern.value)
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

  const detailHourlyOption = computed<EChartsOption>(() => {
    const rows = detail.value?.hourly ?? []
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 32, right: 8, top: 8, bottom: 24 },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.hour),
        axisLabel: { show: false }
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: false,
          areaStyle: {},
          data: rows.map((r) => r.visits)
        }
      ]
    }
  })
</script>
