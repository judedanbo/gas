/**
 * Typed wrapper around /api/admin/analytics/*. Used by the analytics
 * admin pages. Auth headers are added automatically via useAdminApi.
 */

export interface AnalyticsOverview {
  last24h: {
    visits: number
    uniqueIps: number
    bytes: number
    downloads: number
    botShare: number
    cacheHitRate: number
    errorRate: number
    avgP95Ms: number
  }
  topRoutes: Array<{
    pattern: string
    visits: number
    uniqueIps: number
    bytes: number
    p95Ms: number
    cacheHitRate: number
  }>
  topDownloads: Array<{
    kind: string
    targetId: number
    slug: string | null
    count: number
    bytes: number
  }>
  hourly: Array<{
    hour: string
    humanVisits: number
    botVisits: number
  }>
}

export interface AnalyticsRoutesResponse {
  items: Array<{
    pattern: string
    visits: number
    uniqueIps: number
    p95Ms: number
    p99Ms: number
    bytes: number
    cacheHitRate: number
    errorRate: number
    botShare: number
    benefit: number
  }>
  meta: {
    total: number
    page: number
    perPage: number
    lastPage: number
    windowHours: number
    sort: string
    dir: string
  }
}

export interface AnalyticsRouteDetail {
  pattern: string
  windowHours: number
  totals: {
    visits: number
    uniqueIps: number
    bytes: number
    cacheHits: number
    botVisits: number
    maxP95Ms: number
    maxP99Ms: number
    status: { '2xx': number; '3xx': number; '4xx': number; '5xx': number }
  }
  hourly: Array<{
    hour: string
    visits: number
    botVisits: number
    humanVisits: number
    p95Ms: number
    cacheHits: number
  }>
  topIps: Array<{
    ipHash: string
    uaFamily: string
    country: string | null
    asn: number | null
    visits: number
    bytes: number
    lastSeen: string
  }>
}

export type AnalyticsWindow = '24h' | '7d' | '30d'
export type IncidentWindow = '24h' | '7d' | '30d' | '90d'

export type Classification = 'clean' | 'crawler' | 'suspicious' | 'abusive' | 'safe-allowlist'

export interface BotSignature {
  id: number
  ipHash: string
  uaHash: string
  uaFamily: string
  uaSample: string | null
  firstSeen: string
  lastSeen: string
  totalRequests: number
  distinctRoutes24h: number
  rateLimitHits24h: number
  failedLogins24h: number
  score: number
  classification: Classification
  notes: string | null
  decidedBy: number | null
  decidedAt: string | null
  country: string | null
  asn: number | null
}

export interface BotSignaturesResponse {
  items: BotSignature[]
  meta: { total: number; page: number; perPage: number; lastPage: number }
}

export interface AbuseIncident {
  id: number
  ts: string
  kind: string
  severity: 'info' | 'warning' | 'critical'
  ipHash: string | null
  uaHash: string | null
  routePattern: string | null
  routePath: string | null
  details: Record<string, unknown> | null
}

export interface IncidentsResponse {
  items: AbuseIncident[]
  meta: {
    total: number
    page: number
    perPage: number
    lastPage: number
    windowHours: number
  }
}

export interface RoutesQuery {
  window?: AnalyticsWindow
  sort?: 'visits' | 'uniqueIps' | 'p95' | 'errorRate' | 'cacheHitRate' | 'bytes' | 'benefit'
  dir?: 'asc' | 'desc'
  q?: string
  page?: number
  perPage?: number
}

export interface BotsQuery {
  classification?: Classification | ''
  minScore?: number
  q?: string
  page?: number
  perPage?: number
}

export interface IncidentsQuery {
  kind?: string
  severity?: 'info' | 'warning' | 'critical'
  window?: IncidentWindow
  ipHash?: string
  page?: number
  perPage?: number
}

export type CapacityWindow = '30d' | '90d' | '365d'

export type InsightsWindow = '24h' | '7d' | '30d'

export interface InsightsResponse {
  windowHours: number
  topQueries: Array<{
    queryHash: string
    sampleText: string
    count: number
    avgResults: number
    lastSeen: string
  }>
  zeroResultQueries: Array<{
    queryHash: string
    sampleText: string
    count: number
    lastSeen: string
  }>
  hotNotFound: Array<{
    routePath: string
    count: number
    uniqueIps: number
    lastSeen: string
  }>
}

export interface FormSubmissionsResponse {
  windowHours: number
  items: Array<{
    pattern: string
    total: number
    accepted: number
    rejected: number
    uniqueIps: number
    accepted_from: {
      abusive: number
      suspicious: number
      crawler: number
      clean: number
    }
    hasSuspectAccepts: boolean
  }>
}

export type FuzzKind =
  | 'sqli'
  | 'xss'
  | 'path_traversal'
  | 'ssrf'
  | 'length_anomaly'
  | 'encoded_payload'

export interface FuzzAttemptsResponse {
  windowHours: number
  items: Array<{
    ipHash: string
    uaHash: string
    uaFamily: string
    country: string | null
    classification: string | null
    count: number
    topSeverity: 'info' | 'warning' | 'critical'
    topKind: FuzzKind | string | null
    lastSeen: string
  }>
}

export interface CapacityResponse {
  windowDays: number
  hourly: Array<{ hour: string; visits: number; bytes: number; cacheHits: number }>
  daily: Array<{ day: string; visits: number; bytes: number }>
  slowestRoutes: Array<{ pattern: string; visits: number; avgP95Ms: number }>
  heaviestRoutes: Array<{
    pattern: string
    bytes: number
    visits: number
    avgBytesPerVisit: number
  }>
  heatmap: Array<{ dow: number; hr: number; avgVisits: number }>
  storage: {
    requestEventsRows: number
    downloadEventsRows: number
    oldestRequestEvent: string | null
  }
  redis: {
    usedMemoryBytes: number | null
    peakMemoryBytes: number | null
    evictedKeys: number | null
    keyCount: number | null
  }
}

export function useAnalytics() {
  const api = useAdminApi()

  function fetchOverview(): Promise<AnalyticsOverview> {
    return api.get<AnalyticsOverview>('analytics/overview')
  }

  function fetchRoutes(params: RoutesQuery = {}): Promise<AnalyticsRoutesResponse> {
    // useAdminApi.get expects a flat string-indexed record; spread to satisfy it.
    return api.get<AnalyticsRoutesResponse>('analytics/routes', { ...params })
  }

  function fetchRouteDetail(
    pattern: string,
    window: AnalyticsWindow = '7d'
  ): Promise<AnalyticsRouteDetail> {
    return api.get<AnalyticsRouteDetail>('analytics/route-detail', { pattern, window })
  }

  function fetchBots(params: BotsQuery = {}): Promise<BotSignaturesResponse> {
    return api.get<BotSignaturesResponse>('analytics/bots', { ...params })
  }

  function updateBotClassification(
    id: number,
    body: { classification: Classification; notes?: string | null }
  ): Promise<{ ok: true }> {
    return api.patch<{ ok: true }>(`analytics/bots/${id}`, body)
  }

  function fetchIncidents(params: IncidentsQuery = {}): Promise<IncidentsResponse> {
    return api.get<IncidentsResponse>('analytics/incidents', { ...params })
  }

  function fetchCapacity(window: CapacityWindow = '30d'): Promise<CapacityResponse> {
    return api.get<CapacityResponse>('analytics/capacity', { window })
  }

  function fetchInsights(window: InsightsWindow = '7d'): Promise<InsightsResponse> {
    return api.get<InsightsResponse>('analytics/insights', { window })
  }

  function fetchFormSubmissions(window: InsightsWindow = '7d'): Promise<FormSubmissionsResponse> {
    return api.get<FormSubmissionsResponse>('analytics/form-submissions', { window })
  }

  function fetchFuzzAttempts(window: InsightsWindow = '7d'): Promise<FuzzAttemptsResponse> {
    return api.get<FuzzAttemptsResponse>('analytics/fuzz-attempts', { window })
  }

  /**
   * Download the unified analytics report as a PDF. Hits the
   * server-side Puppeteer endpoint, receives a blob, and triggers a
   * browser download — no new page navigation.
   */
  async function downloadReportPdf(window: AnalyticsWindow = '7d'): Promise<void> {
    const { token } = useAdminAuth()
    if (!token.value) {
      throw new Error('Not authenticated')
    }
    const blob = await $fetch<Blob>(`/api/admin/analytics/report.pdf?window=${window}`, {
      method: 'GET',
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token.value}` }
    })
    if (!import.meta.client) return
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..+$/, '')
        .replace('T', '-')
      a.download = `gas-analytics-${window}-${stamp}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      // Defer revoke so the click handler can finish; revoking immediately
      // can race in some browsers and abort the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  return {
    fetchOverview,
    fetchRoutes,
    fetchRouteDetail,
    fetchBots,
    updateBotClassification,
    fetchIncidents,
    fetchCapacity,
    fetchInsights,
    fetchFormSubmissions,
    fetchFuzzAttempts,
    downloadReportPdf
  }
}
