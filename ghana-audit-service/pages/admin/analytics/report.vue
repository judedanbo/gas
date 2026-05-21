<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <!-- Interactive controls (hidden in print/PDF) -->
    <div data-no-print class="mb-6 flex items-center justify-between gap-4">
      <div>
        <NuxtLink to="/admin/analytics" class="text-sm font-medium text-primary hover:underline">
          ← {{ $t('analytics.report.backToDashboard') }}
        </NuxtLink>
      </div>
      <div class="flex items-center gap-3">
        <label class="text-sm font-medium text-gray-700">
          {{ $t('analytics.report.window.label') }}
          <select
            v-model="windowChoice"
            class="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm"
            @change="onWindowChange"
          >
            <option value="24h">{{ $t('analytics.report.window.options.24h') }}</option>
            <option value="7d">{{ $t('analytics.report.window.options.7d') }}</option>
            <option value="30d">{{ $t('analytics.report.window.options.30d') }}</option>
          </select>
        </label>
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          @click="printPage"
        >
          {{ $t('analytics.report.print') }}
        </button>
        <button
          type="button"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          :disabled="downloading"
          @click="onDownloadPdf"
        >
          {{ downloading ? $t('analytics.report.generating') : $t('analytics.report.downloadPdf') }}
        </button>
      </div>
    </div>

    <!-- Auth bootstrap notice (Puppeteer flow only) -->
    <div
      v-if="exchangeError"
      class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      {{ exchangeError }}
    </div>

    <!-- Watermark / cover header -->
    <AdminAnalyticsReportWatermark
      :window-label="windowLabel"
      :generated-at="generatedAt"
      :email="userEmail"
    />

    <!-- Loading state -->
    <div v-if="loading && !ready" class="py-12 text-center text-sm text-gray-500">
      {{ $t('analytics.loading') }}
    </div>

    <div v-show="!loading || ready">
      <!-- 1. Overview ----------------------------------------------------- -->
      <AdminAnalyticsReportSection
        :title="$t('analytics.report.sections.overview.title')"
        :subtitle="$t('analytics.report.sections.overview.subtitle')"
      >
        <div class="mb-4 grid grid-cols-4 gap-3">
          <AdminAnalyticsStatCard
            :label="$t('analytics.overview.cards.visits')"
            :value="formatNumber(overview?.last24h.visits)"
          />
          <AdminAnalyticsStatCard
            :label="$t('analytics.overview.cards.uniqueIps')"
            :value="formatNumber(overview?.last24h.uniqueIps)"
          />
          <AdminAnalyticsStatCard
            :label="$t('analytics.overview.cards.downloads')"
            :value="formatNumber(overview?.last24h.downloads)"
          />
          <AdminAnalyticsStatCard
            :label="$t('analytics.overview.cards.bandwidth')"
            :value="formatBytes(overview?.last24h.bytes)"
          />
          <AdminAnalyticsStatCard
            :label="$t('analytics.overview.cards.botShare')"
            :value="formatPercent(overview?.last24h.botShare)"
          />
          <AdminAnalyticsStatCard
            :label="$t('analytics.overview.cards.errorRate')"
            :value="formatPercent(overview?.last24h.errorRate)"
          />
          <AdminAnalyticsStatCard
            :label="$t('analytics.overview.cards.cacheHit')"
            :value="formatPercent(overview?.last24h.cacheHitRate)"
          />
          <AdminAnalyticsStatCard
            :label="$t('analytics.overview.cards.p95Latency')"
            :value="overview?.last24h.avgP95Ms ? `${overview.last24h.avgP95Ms} ms` : '—'"
          />
        </div>
        <div class="report-chart-card mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 class="mb-2 text-sm font-semibold text-gray-900">
            {{ $t('analytics.overview.hourly.title') }}
          </h3>
          <div class="report-chart report-chart-tall h-64">
            <AdminAnalyticsEChart :option="hourlyOption" @ready="onChartReady('overview-hourly')" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <h3 class="mb-2 text-sm font-semibold text-gray-900">
              {{ $t('analytics.overview.topRoutes.title') }}
            </h3>
            <table class="min-w-full text-xs">
              <thead>
                <tr class="border-b">
                  <th class="px-2 py-1 text-left font-medium text-gray-600">
                    {{ $t('analytics.overview.topRoutes.pattern') }}
                  </th>
                  <th class="px-2 py-1 text-right font-medium text-gray-600">
                    {{ $t('analytics.overview.topRoutes.visits') }}
                  </th>
                  <th class="px-2 py-1 text-right font-medium text-gray-600">
                    {{ $t('analytics.overview.topRoutes.p95') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in overview?.topRoutes" :key="r.pattern" class="border-b">
                  <td class="px-2 py-1 font-mono text-[10px] text-gray-700">{{ r.pattern }}</td>
                  <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(r.visits) }}</td>
                  <td class="px-2 py-1 text-right tabular-nums">{{ r.p95Ms }} ms</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <h3 class="mb-2 text-sm font-semibold text-gray-900">
              {{ $t('analytics.overview.topDownloads.title') }}
            </h3>
            <table class="min-w-full text-xs">
              <thead>
                <tr class="border-b">
                  <th class="px-2 py-1 text-left font-medium text-gray-600">
                    {{ $t('analytics.overview.topDownloads.target') }}
                  </th>
                  <th class="px-2 py-1 text-right font-medium text-gray-600">
                    {{ $t('analytics.overview.topDownloads.count') }}
                  </th>
                  <th class="px-2 py-1 text-right font-medium text-gray-600">
                    {{ $t('analytics.overview.topDownloads.bytes') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="d in overview?.topDownloads"
                  :key="`${d.kind}-${d.targetId}`"
                  class="border-b"
                >
                  <td class="px-2 py-1 text-gray-700">
                    <span class="rounded bg-gray-100 px-1 text-[10px]">{{ d.kind }}</span>
                    <span class="ml-2 font-mono text-[10px]">{{ d.slug || `#${d.targetId}` }}</span>
                  </td>
                  <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(d.count) }}</td>
                  <td class="px-2 py-1 text-right tabular-nums">{{ formatBytes(d.bytes) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </AdminAnalyticsReportSection>

      <!-- 2. Routes ------------------------------------------------------- -->
      <AdminAnalyticsReportSection
        :title="$t('analytics.report.sections.routes.title')"
        :subtitle="$t('analytics.report.sections.routes.subtitle', { window: windowLabel })"
      >
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b bg-gray-50">
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.routes.cols.pattern') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.routes.cols.visits') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.routes.cols.uniqueIps') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.routes.cols.p95') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.routes.cols.errorRate') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.routes.cols.cacheHitRate') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.routes.cols.bytes') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in routes?.items" :key="r.pattern" class="border-b">
              <td class="px-2 py-1 font-mono text-[10px] text-gray-700">{{ r.pattern }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(r.visits) }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(r.uniqueIps) }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ r.p95Ms }} ms</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatPercent(r.errorRate) }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatPercent(r.cacheHitRate) }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatBytes(r.bytes) }}</td>
            </tr>
          </tbody>
        </table>
      </AdminAnalyticsReportSection>

      <!-- 3. Abuse -------------------------------------------------------- -->
      <AdminAnalyticsReportSection
        :title="$t('analytics.report.sections.abuse.title')"
        :subtitle="$t('analytics.report.sections.abuse.subtitle', { window: windowLabel })"
      >
        <h3 class="mb-2 mt-4 text-sm font-semibold text-gray-900">
          {{ $t('analytics.abuse.leaderboard.title') }}
        </h3>
        <table class="mb-6 min-w-full text-xs">
          <thead>
            <tr class="border-b bg-gray-50">
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.abuse.leaderboard.cols.classification') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.abuse.leaderboard.cols.score') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.abuse.leaderboard.cols.requests') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.abuse.leaderboard.cols.routes') }}
              </th>
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.abuse.leaderboard.cols.lastSeen') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!bots?.items.length">
              <td colspan="5" class="px-2 py-3 text-center text-gray-500">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="b in bots?.items" :key="b.id" class="border-b">
              <td class="px-2 py-1 capitalize text-gray-700">{{ b.classification }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ b.score }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(b.totalRequests) }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ b.distinctRoutes24h }}</td>
              <td class="px-2 py-1 text-[10px] text-gray-600">{{ formatDate(b.lastSeen) }}</td>
            </tr>
          </tbody>
        </table>

        <h3 class="mb-2 text-sm font-semibold text-gray-900">
          {{ $t('analytics.abuse.incidents.title') }}
        </h3>
        <table class="mb-6 min-w-full text-xs">
          <thead>
            <tr class="border-b bg-gray-50">
              <th class="px-2 py-1 text-left font-medium text-gray-600">Severity</th>
              <th class="px-2 py-1 text-left font-medium text-gray-600">Kind</th>
              <th class="px-2 py-1 text-left font-medium text-gray-600">Route</th>
              <th class="px-2 py-1 text-left font-medium text-gray-600">When</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!incidents?.items.length">
              <td colspan="4" class="px-2 py-3 text-center text-gray-500">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="i in incidents?.items" :key="i.id" class="border-b">
              <td class="px-2 py-1 capitalize text-gray-700">{{ i.severity }}</td>
              <td class="px-2 py-1 text-gray-700">{{ i.kind }}</td>
              <td class="px-2 py-1 font-mono text-[10px] text-gray-700">
                {{ i.routePattern || '—' }}
              </td>
              <td class="px-2 py-1 text-[10px] text-gray-600">{{ formatDate(i.ts) }}</td>
            </tr>
          </tbody>
        </table>

        <h3 class="mb-2 text-sm font-semibold text-gray-900">
          {{ $t('analytics.abuse.fuzz.title') }}
        </h3>
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b bg-gray-50">
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.abuse.fuzz.cols.severity') }}
              </th>
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.abuse.fuzz.cols.kind') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.abuse.fuzz.cols.count') }}
              </th>
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.abuse.fuzz.cols.classification') }}
              </th>
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.abuse.fuzz.cols.lastSeen') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!fuzz?.items.length">
              <td colspan="5" class="px-2 py-3 text-center text-gray-500">
                {{ $t('analytics.abuse.fuzz.empty') }}
              </td>
            </tr>
            <tr v-for="(f, idx) in fuzz?.items" :key="`${f.ipHash}-${idx}`" class="border-b">
              <td class="px-2 py-1 capitalize text-gray-700">{{ f.topSeverity }}</td>
              <td class="px-2 py-1 text-gray-700">{{ f.topKind || '—' }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(f.count) }}</td>
              <td class="px-2 py-1 capitalize text-gray-700">{{ f.classification || '—' }}</td>
              <td class="px-2 py-1 text-[10px] text-gray-600">{{ formatDate(f.lastSeen) }}</td>
            </tr>
          </tbody>
        </table>
      </AdminAnalyticsReportSection>

      <!-- 4. Capacity ----------------------------------------------------- -->
      <AdminAnalyticsReportSection
        :title="$t('analytics.report.sections.capacity.title')"
        :subtitle="
          $t('analytics.report.sections.capacity.subtitle', { window: capacityWindowLabel })
        "
      >
        <div class="report-chart-card mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 class="mb-2 text-sm font-semibold text-gray-900">
            {{ $t('analytics.capacity.throughput.title') }}
          </h3>
          <div class="report-chart h-56">
            <AdminAnalyticsEChart
              :option="throughputOption"
              @ready="onChartReady('capacity-throughput')"
            />
          </div>
        </div>

        <div class="report-chart-card mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 class="mb-2 text-sm font-semibold text-gray-900">
            {{ $t('analytics.capacity.heatmap.title') }}
          </h3>
          <div class="report-chart h-56">
            <AdminAnalyticsEChart
              :option="heatmapOption"
              @ready="onChartReady('capacity-heatmap')"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <h3 class="mb-2 text-sm font-semibold text-gray-900">
              {{ $t('analytics.capacity.slowest.title') }}
            </h3>
            <table class="min-w-full text-xs">
              <thead>
                <tr class="border-b">
                  <th class="px-2 py-1 text-left font-medium text-gray-600">
                    {{ $t('analytics.capacity.slowest.pattern') }}
                  </th>
                  <th class="px-2 py-1 text-right font-medium text-gray-600">
                    {{ $t('analytics.capacity.slowest.p95') }}
                  </th>
                  <th class="px-2 py-1 text-right font-medium text-gray-600">
                    {{ $t('analytics.capacity.slowest.visits') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in capacity?.slowestRoutes" :key="r.pattern" class="border-b">
                  <td class="px-2 py-1 font-mono text-[10px] text-gray-700">{{ r.pattern }}</td>
                  <td class="px-2 py-1 text-right tabular-nums">{{ r.avgP95Ms }} ms</td>
                  <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(r.visits) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <h3 class="mb-2 text-sm font-semibold text-gray-900">
              {{ $t('analytics.capacity.heaviest.title') }}
            </h3>
            <table class="min-w-full text-xs">
              <thead>
                <tr class="border-b">
                  <th class="px-2 py-1 text-left font-medium text-gray-600">
                    {{ $t('analytics.capacity.heaviest.pattern') }}
                  </th>
                  <th class="px-2 py-1 text-right font-medium text-gray-600">
                    {{ $t('analytics.capacity.heaviest.bytes') }}
                  </th>
                  <th class="px-2 py-1 text-right font-medium text-gray-600">
                    {{ $t('analytics.capacity.heaviest.avgPerVisit') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in capacity?.heaviestRoutes" :key="r.pattern" class="border-b">
                  <td class="px-2 py-1 font-mono text-[10px] text-gray-700">{{ r.pattern }}</td>
                  <td class="px-2 py-1 text-right tabular-nums">{{ formatBytes(r.bytes) }}</td>
                  <td class="px-2 py-1 text-right tabular-nums">
                    {{ formatBytes(r.avgBytesPerVisit) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </AdminAnalyticsReportSection>

      <!-- 5. Insights ----------------------------------------------------- -->
      <AdminAnalyticsReportSection
        :title="$t('analytics.report.sections.insights.title')"
        :subtitle="$t('analytics.report.sections.insights.subtitle', { window: windowLabel })"
      >
        <h3 class="mb-2 text-sm font-semibold text-gray-900">
          {{ $t('analytics.insights.topSearches.title') }}
        </h3>
        <table class="mb-6 min-w-full text-xs">
          <thead>
            <tr class="border-b bg-gray-50">
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.insights.topSearches.cols.query') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.insights.topSearches.cols.count') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.insights.topSearches.cols.avgResults') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!insights?.topQueries.length">
              <td colspan="3" class="px-2 py-3 text-center text-gray-500">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="q in insights?.topQueries" :key="q.queryHash" class="border-b">
              <td class="px-2 py-1 text-gray-700">{{ q.sampleText }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(q.count) }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ q.avgResults.toFixed(1) }}</td>
            </tr>
          </tbody>
        </table>

        <h3 class="mb-2 text-sm font-semibold text-gray-900">
          {{ $t('analytics.insights.zeroResults.title') }}
        </h3>
        <table class="mb-6 min-w-full text-xs">
          <thead>
            <tr class="border-b bg-gray-50">
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.insights.zeroResults.cols.query') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.insights.zeroResults.cols.count') }}
              </th>
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.insights.zeroResults.cols.lastSeen') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!insights?.zeroResultQueries.length">
              <td colspan="3" class="px-2 py-3 text-center text-gray-500">
                {{ $t('analytics.insights.zeroResults.empty') }}
              </td>
            </tr>
            <tr v-for="q in insights?.zeroResultQueries" :key="q.queryHash" class="border-b">
              <td class="px-2 py-1 text-gray-700">{{ q.sampleText }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(q.count) }}</td>
              <td class="px-2 py-1 text-[10px] text-gray-600">{{ formatDate(q.lastSeen) }}</td>
            </tr>
          </tbody>
        </table>

        <h3 class="mb-2 text-sm font-semibold text-gray-900">
          {{ $t('analytics.insights.notFound.title') }}
        </h3>
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b bg-gray-50">
              <th class="px-2 py-1 text-left font-medium text-gray-600">
                {{ $t('analytics.insights.notFound.cols.path') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.insights.notFound.cols.hits') }}
              </th>
              <th class="px-2 py-1 text-right font-medium text-gray-600">
                {{ $t('analytics.insights.notFound.cols.uniqueIps') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!insights?.hotNotFound.length">
              <td colspan="3" class="px-2 py-3 text-center text-gray-500">
                {{ $t('analytics.noData') }}
              </td>
            </tr>
            <tr v-for="p in insights?.hotNotFound" :key="p.routePath" class="border-b">
              <td class="px-2 py-1 font-mono text-[10px] text-gray-700">{{ p.routePath }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(p.count) }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatNumber(p.uniqueIps) }}</td>
            </tr>
          </tbody>
        </table>
      </AdminAnalyticsReportSection>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { EChartsOption } from 'echarts'
  import type {
    AnalyticsOverview,
    AnalyticsRoutesResponse,
    AnalyticsWindow,
    BotSignaturesResponse,
    CapacityResponse,
    CapacityWindow,
    FuzzAttemptsResponse,
    IncidentsResponse,
    IncidentWindow,
    InsightsResponse,
    InsightsWindow
  } from '~/composables/useAnalytics'
  import type { LoginResponse } from '~/types/admin'

  definePageMeta({ layout: 'admin-print' })

  const route = useRoute()
  const router = useRouter()
  const { user, setAuth } = useAdminAuth()
  const {
    fetchOverview,
    fetchRoutes,
    fetchBots,
    fetchIncidents,
    fetchFuzzAttempts,
    fetchCapacity,
    fetchInsights,
    downloadReportPdf
  } = useAnalytics()
  const toast = useToast()

  // ----- state ---------------------------------------------------------------
  const overview = ref<AnalyticsOverview | null>(null)
  const routes = ref<AnalyticsRoutesResponse | null>(null)
  const bots = ref<BotSignaturesResponse | null>(null)
  const incidents = ref<IncidentsResponse | null>(null)
  const fuzz = ref<FuzzAttemptsResponse | null>(null)
  const capacity = ref<CapacityResponse | null>(null)
  const insights = ref<InsightsResponse | null>(null)
  const loading = ref(false)
  const ready = ref(false)
  const downloading = ref(false)
  const exchangeError = ref<string | null>(null)

  const initialWindow = (route.query.window as AnalyticsWindow) || '7d'
  const windowChoice = ref<AnalyticsWindow>(initialWindow)

  // ----- chart-ready accounting ---------------------------------------------
  // The Puppeteer side waits for window.__reportReady === true. We mark the
  // page ready once every data fetch has settled AND every required chart
  // has emitted its first finished event.
  const REQUIRED_CHARTS = ['overview-hourly', 'capacity-throughput', 'capacity-heatmap'] as const
  type ChartId = (typeof REQUIRED_CHARTS)[number]
  const chartsReady = ref<Record<ChartId, boolean>>({
    'overview-hourly': false,
    'capacity-throughput': false,
    'capacity-heatmap': false
  })

  function onChartReady(id: ChartId) {
    chartsReady.value[id] = true
    if (allChartsReady() && !loading.value) markReady()
  }

  function allChartsReady(): boolean {
    return REQUIRED_CHARTS.every((id) => chartsReady.value[id])
  }

  function markReady() {
    ready.value = true
    if (import.meta.client) {
      ;(window as unknown as { __reportReady?: boolean }).__reportReady = true
    }
  }

  // ----- window mapping ------------------------------------------------------
  // Each endpoint has different valid windows; pick the closest mapping.
  const windowMap = computed(() => {
    const w = windowChoice.value
    const insightsWindow: InsightsWindow = w
    const incidentsWindow: IncidentWindow = w
    const capacityWindow: CapacityWindow = w === '24h' || w === '7d' ? '30d' : '30d'
    return {
      routes: w,
      insights: insightsWindow,
      incidents: incidentsWindow,
      fuzz: insightsWindow,
      capacity: capacityWindow
    }
  })

  const windowLabel = computed(() => {
    return {
      '24h': 'Last 24 hours',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days'
    }[windowChoice.value]
  })

  const capacityWindowLabel = computed(() => 'Last 30 days')

  // ----- charts --------------------------------------------------------------
  const hourlyOption = computed<EChartsOption>(() => {
    const rows = overview.value?.hourly ?? []
    return {
      animation: false,
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

  const throughputOption = computed<EChartsOption>(() => {
    const rows = capacity.value?.hourly ?? []
    return {
      animation: false,
      tooltip: { trigger: 'axis' },
      legend: { data: ['Visits', 'Bytes'], top: 0 },
      grid: { left: 50, right: 60, top: 32, bottom: 24 },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.hour)
      },
      yAxis: [
        { type: 'value', name: 'Visits' },
        { type: 'value', name: 'Bytes' }
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
          smooth: true,
          showSymbol: false,
          yAxisIndex: 1,
          data: rows.map((r) => r.bytes)
        }
      ]
    }
  })

  const heatmapOption = computed<EChartsOption>(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
    const data = (capacity.value?.heatmap ?? []).map((c) => [c.hr, c.dow, c.avgVisits])
    const maxVisits = data.reduce((m, [, , v]) => Math.max(m, v as number), 0)
    return {
      animation: false,
      tooltip: { position: 'top' },
      grid: { left: 50, right: 20, top: 16, bottom: 30 },
      xAxis: { type: 'category', data: hours, splitArea: { show: true } },
      yAxis: { type: 'category', data: days, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: maxVisits || 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0
      },
      series: [
        {
          name: 'Visits',
          type: 'heatmap',
          data: data,
          label: { show: false }
        }
      ]
    }
  })

  // ----- helpers -------------------------------------------------------------
  function formatNumber(n: number | undefined | null): string {
    if (n == null) return '—'
    return new Intl.NumberFormat().format(n)
  }
  function formatPercent(n: number | undefined | null): string {
    if (n == null) return '—'
    return `${(n * 100).toFixed(1)}%`
  }
  function formatBytes(n: number | undefined | null): string {
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
  function formatDate(s: string | null | undefined): string {
    if (!s) return '—'
    const d = new Date(s)
    return d.toLocaleString()
  }

  const generatedAt = ref<string>(new Date().toLocaleString())

  const userEmail = computed(() => user.value?.email ?? null)

  // ----- data load -----------------------------------------------------------
  async function loadAll() {
    loading.value = true
    ready.value = false
    chartsReady.value = {
      'overview-hourly': false,
      'capacity-throughput': false,
      'capacity-heatmap': false
    }
    if (import.meta.client) {
      ;(window as unknown as { __reportReady?: boolean }).__reportReady = false
    }
    generatedAt.value = new Date().toLocaleString()

    try {
      const wm = windowMap.value
      const results = await Promise.allSettled([
        fetchOverview(),
        fetchRoutes({ window: wm.routes, perPage: 50, sort: 'visits', dir: 'desc' }),
        fetchBots({ perPage: 30 }),
        fetchIncidents({ window: wm.incidents, perPage: 30 }),
        fetchFuzzAttempts(wm.fuzz),
        fetchCapacity(wm.capacity),
        fetchInsights(wm.insights)
      ])
      overview.value = results[0].status === 'fulfilled' ? results[0].value : null
      routes.value = results[1].status === 'fulfilled' ? results[1].value : null
      bots.value = results[2].status === 'fulfilled' ? results[2].value : null
      incidents.value = results[3].status === 'fulfilled' ? results[3].value : null
      fuzz.value = results[4].status === 'fulfilled' ? results[4].value : null
      capacity.value = results[5].status === 'fulfilled' ? results[5].value : null
      insights.value = results[6].status === 'fulfilled' ? results[6].value : null
    } finally {
      loading.value = false
      // If every required chart is already mounted with empty data, the
      // finished event has fired; otherwise it'll fire as data arrives.
      if (allChartsReady()) markReady()
    }
  }

  // ----- PDF-token exchange (Puppeteer flow) --------------------------------
  async function exchangePdfTokenIfPresent(): Promise<boolean> {
    const pdfToken = route.query.pdfToken as string | undefined
    if (!pdfToken) return true

    try {
      const res = await $fetch<LoginResponse>('/api/admin/auth/exchange-pdf-token', {
        method: 'POST',
        body: { pdfToken }
      })
      setAuth(res.user, res.token, res.session ?? null)
      return true
    } catch (err) {
      const e = err as { data?: { message?: string }; message?: string }
      exchangeError.value = e.data?.message || e.message || 'PDF token exchange failed'
      return false
    }
  }

  // ----- handlers ------------------------------------------------------------
  function onWindowChange() {
    router.replace({ query: { ...route.query, window: windowChoice.value } })
    void loadAll()
  }

  function printPage() {
    if (import.meta.client) window.print()
  }

  async function onDownloadPdf() {
    if (downloading.value) return
    downloading.value = true
    try {
      await downloadReportPdf(windowChoice.value)
    } catch (err) {
      const e = err as { data?: { message?: string }; message?: string }
      toast.error(e.data?.message || e.message || 'PDF download failed')
    } finally {
      downloading.value = false
    }
  }

  // ----- lifecycle -----------------------------------------------------------
  onMounted(async () => {
    const ok = await exchangePdfTokenIfPresent()
    if (!ok) return
    await loadAll()
  })
</script>
