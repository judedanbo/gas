<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ $t('analytics.abuse.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('analytics.abuse.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink
          to="/admin/analytics/report"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {{ $t('analytics.report.fullReport') }}
        </NuxtLink>
        <NuxtLink
          to="/admin/analytics"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          ← {{ $t('analytics.abuse.backToOverview') }}
        </NuxtLink>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Suspect leaderboard -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div
          class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.abuse.leaderboard.title') }}
          </h2>
          <select
            v-model="botFilter"
            class="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            @change="loadBots"
          >
            <option value="">{{ $t('analytics.abuse.leaderboard.suspiciousAndAbusive') }}</option>
            <option value="suspicious">suspicious</option>
            <option value="abusive">abusive</option>
            <option value="safe-allowlist">safe-allowlist</option>
            <option value="crawler">crawler</option>
            <option value="clean">clean</option>
          </select>
        </div>
        <div
          v-if="botsError"
          class="border-b border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {{ botsError }}
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  {{ $t('analytics.abuse.leaderboard.cols.classification') }}
                </th>
                <th class="px-2 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  {{ $t('analytics.abuse.leaderboard.cols.score') }}
                </th>
                <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">IP</th>
                <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">CC</th>
                <th class="px-2 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  ASN
                </th>
                <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">UA</th>
                <th class="px-2 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  {{ $t('analytics.abuse.leaderboard.cols.requests') }}
                </th>
                <th class="px-2 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  {{ $t('analytics.abuse.leaderboard.cols.routes') }}
                </th>
                <th class="px-2 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  {{ $t('analytics.abuse.leaderboard.cols.rateLimit') }}
                </th>
                <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  {{ $t('analytics.abuse.leaderboard.cols.lastSeen') }}
                </th>
                <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  {{ $t('analytics.abuse.leaderboard.cols.actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="!botsLoading && !bots?.items.length">
                <td class="px-2 py-3 text-center text-gray-500 dark:text-gray-400" colspan="11">
                  {{ $t('analytics.noData') }}
                </td>
              </tr>
              <tr v-for="b in bots?.items" :key="b.id">
                <td class="px-2 py-2">
                  <span :class="['rounded px-1.5 py-0.5', classBadge(b.classification)]">
                    {{ b.classification }}
                  </span>
                </td>
                <td
                  class="px-2 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white"
                >
                  {{ b.score }}
                </td>
                <td class="px-2 py-2 font-mono text-[11px] text-gray-700 dark:text-gray-200">
                  {{ b.ipHash.slice(0, 10) }}…
                </td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-200">
                  {{ b.country || '—' }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200">
                  {{ b.asn ?? '—' }}
                </td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-200">
                  {{ b.uaFamily }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {{ formatNumber(b.totalRequests) }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {{ b.distinctRoutes24h }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {{ b.rateLimitHits24h }}
                </td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">
                  {{ formatRelative(b.lastSeen) }}
                </td>
                <td class="px-2 py-2">
                  <div class="flex gap-1">
                    <button
                      type="button"
                      class="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                      :disabled="actingId === b.id"
                      @click="markBot(b.id, 'safe-allowlist')"
                    >
                      {{ $t('analytics.abuse.leaderboard.markSafe') }}
                    </button>
                    <button
                      type="button"
                      class="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                      :disabled="actingId === b.id"
                      @click="markBot(b.id, 'abusive')"
                    >
                      {{ $t('analytics.abuse.leaderboard.forceAbusive') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Incident timeline -->
      <div
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.abuse.incidents.title') }}
          </h2>
          <div class="flex gap-2">
            <select
              v-model="incidentKindFilter"
              class="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
              @change="loadIncidents"
            >
              <option value="">{{ $t('analytics.abuse.incidents.allKinds') }}</option>
              <option value="rate_limit_api">rate_limit_api</option>
              <option value="rate_limit_download">rate_limit_download</option>
              <option value="rate_limit_form">rate_limit_form</option>
              <option value="probing_path">probing_path</option>
              <option value="crawl_burst">crawl_burst</option>
              <option value="failed_login">failed_login</option>
              <option value="fuzz_attempt">fuzz_attempt</option>
            </select>
            <select
              v-model="incidentSeverityFilter"
              class="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
              @change="loadIncidents"
            >
              <option value="">{{ $t('analytics.abuse.incidents.allSeverities') }}</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
            <select
              v-model="incidentWindow"
              class="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
              @change="loadIncidents"
            >
              <option value="24h">24h</option>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </div>
        </div>
        <div
          v-if="incError"
          class="border-b border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {{ incError }}
        </div>
        <ul
          class="max-h-[640px] divide-y divide-gray-200 overflow-y-auto text-xs dark:divide-gray-700"
        >
          <li
            v-if="!incLoading && !incidents?.items.length"
            class="px-4 py-3 text-center text-gray-500 dark:text-gray-400"
          >
            {{ $t('analytics.noData') }}
          </li>
          <li v-for="i in incidents?.items" :key="i.id" class="px-4 py-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span :class="['rounded px-1.5 py-0.5 text-[11px]', sevBadge(i.severity)]">
                    {{ i.severity }}
                  </span>
                  <span class="font-mono text-[11px] text-gray-700 dark:text-gray-200">
                    {{ i.kind }}
                  </span>
                  <span class="text-gray-500 dark:text-gray-400">
                    {{ formatRelative(i.ts) }}
                  </span>
                </div>
                <div class="mt-1 break-words text-gray-700 dark:text-gray-200">
                  <span v-if="i.routePath" class="font-mono text-[11px]">
                    {{ i.routePath }}
                  </span>
                </div>
                <div
                  v-if="i.ipHash"
                  class="mt-1 font-mono text-[11px] text-gray-500 dark:text-gray-400"
                >
                  ip:{{ i.ipHash.slice(0, 10) }}…
                </div>
              </div>
            </div>
            <details v-if="i.details" class="mt-1">
              <summary
                class="cursor-pointer text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {{ $t('analytics.abuse.incidents.details') }}
              </summary>
              <pre
                class="mt-1 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-900/50"
                >{{ JSON.stringify(i.details, null, 2) }}</pre
              >
            </details>
          </li>
        </ul>
      </div>
    </div>

    <!-- Fuzz-attempts leaderboard -->
    <div
      class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div
        class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700"
      >
        <div>
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ $t('analytics.abuse.fuzz.title') }}
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('analytics.abuse.fuzz.subtitle') }}
          </p>
        </div>
        <select
          v-model="fuzzWindow"
          class="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          @change="loadFuzz"
        >
          <option value="24h">24h</option>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
        </select>
      </div>
      <div
        v-if="fuzzError"
        class="border-b border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      >
        {{ fuzzError }}
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.abuse.fuzz.cols.severity') }}
              </th>
              <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.abuse.fuzz.cols.kind') }}
              </th>
              <th class="px-2 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.abuse.fuzz.cols.count') }}
              </th>
              <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">IP</th>
              <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">CC</th>
              <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">UA</th>
              <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.abuse.fuzz.cols.classification') }}
              </th>
              <th class="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ $t('analytics.abuse.fuzz.cols.lastSeen') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!fuzzLoading && !fuzz?.items.length">
              <td class="px-2 py-3 text-center text-gray-500 dark:text-gray-400" colspan="8">
                {{ $t('analytics.abuse.fuzz.empty') }}
              </td>
            </tr>
            <tr v-for="f in fuzz?.items" :key="`${f.ipHash}-${f.uaHash}`">
              <td class="px-2 py-2">
                <span :class="['rounded px-1.5 py-0.5 text-[11px]', sevBadge(f.topSeverity)]">
                  {{ f.topSeverity }}
                </span>
              </td>
              <td class="px-2 py-2 font-mono text-[11px] text-gray-700 dark:text-gray-200">
                {{ f.topKind || '—' }}
              </td>
              <td
                class="px-2 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white"
              >
                {{ f.count }}
              </td>
              <td class="px-2 py-2 font-mono text-[11px] text-gray-700 dark:text-gray-200">
                {{ f.ipHash.slice(0, 10) }}…
              </td>
              <td class="px-2 py-2 text-gray-700 dark:text-gray-200">
                {{ f.country || '—' }}
              </td>
              <td class="px-2 py-2 text-gray-700 dark:text-gray-200">
                {{ f.uaFamily }}
              </td>
              <td class="px-2 py-2">
                <span
                  v-if="f.classification"
                  :class="[
                    'rounded px-1.5 py-0.5 text-[11px]',
                    classBadge(f.classification as Classification)
                  ]"
                >
                  {{ f.classification }}
                </span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-2 py-2 text-gray-700 dark:text-gray-300">
                {{ formatRelative(f.lastSeen) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type {
    BotSignaturesResponse,
    IncidentsResponse,
    Classification,
    IncidentWindow,
    FuzzAttemptsResponse,
    InsightsWindow
  } from '~/composables/useAnalytics'

  definePageMeta({ layout: 'admin' })

  const { fetchBots, fetchIncidents, updateBotClassification, fetchFuzzAttempts } = useAnalytics()

  // ── bots leaderboard ───────────────────────────────────────────────────
  const bots = ref<BotSignaturesResponse | null>(null)
  const botsLoading = ref(false)
  const botsError = ref<string | null>(null)
  const botFilter = ref<string>('')
  const actingId = ref<number | null>(null)

  async function loadBots() {
    botsLoading.value = true
    botsError.value = null
    try {
      bots.value = await fetchBots({
        classification: (botFilter.value || undefined) as Classification | undefined,
        page: 1,
        perPage: 50
      })
    } catch (err) {
      botsError.value = (err as { message?: string })?.message ?? 'Failed to load bot signatures'
    } finally {
      botsLoading.value = false
    }
  }

  async function markBot(id: number, classification: Classification) {
    actingId.value = id
    try {
      await updateBotClassification(id, { classification })
      await loadBots()
    } catch (err) {
      botsError.value = (err as { message?: string })?.message ?? 'Action failed'
    } finally {
      actingId.value = null
    }
  }

  // ── incident timeline ──────────────────────────────────────────────────
  const incidents = ref<IncidentsResponse | null>(null)
  const incLoading = ref(false)
  const incError = ref<string | null>(null)
  const incidentKindFilter = ref<string>('')
  const incidentSeverityFilter = ref<string>('')
  const incidentWindow = ref<IncidentWindow>('7d')

  async function loadIncidents() {
    incLoading.value = true
    incError.value = null
    try {
      incidents.value = await fetchIncidents({
        kind: incidentKindFilter.value || undefined,
        severity: (incidentSeverityFilter.value as 'info' | 'warning' | 'critical') || undefined,
        window: incidentWindow.value,
        perPage: 100
      })
    } catch (err) {
      incError.value = (err as { message?: string })?.message ?? 'Failed to load incidents'
    } finally {
      incLoading.value = false
    }
  }

  // ── fuzz-attempts leaderboard ─────────────────────────────────────────
  const fuzz = ref<FuzzAttemptsResponse | null>(null)
  const fuzzLoading = ref(false)
  const fuzzError = ref<string | null>(null)
  const fuzzWindow = ref<InsightsWindow>('7d')

  async function loadFuzz() {
    fuzzLoading.value = true
    fuzzError.value = null
    try {
      fuzz.value = await fetchFuzzAttempts(fuzzWindow.value)
    } catch (err) {
      fuzzError.value = (err as { message?: string })?.message ?? 'Failed to load fuzz attempts'
    } finally {
      fuzzLoading.value = false
    }
  }

  onMounted(() => {
    void loadBots()
    void loadIncidents()
    void loadFuzz()
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

  function classBadge(c: Classification): string {
    switch (c) {
      case 'abusive':
        return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
      case 'suspicious':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
      case 'crawler':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
      case 'safe-allowlist':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  function sevBadge(s: 'info' | 'warning' | 'critical'): string {
    switch (s) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
      case 'warning':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }
</script>
