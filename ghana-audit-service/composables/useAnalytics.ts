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
    visits: number
    bytes: number
    lastSeen: string
  }>
}

export type AnalyticsWindow = '24h' | '7d' | '30d'

export interface RoutesQuery {
  window?: AnalyticsWindow
  sort?: 'visits' | 'uniqueIps' | 'p95' | 'errorRate' | 'cacheHitRate' | 'bytes' | 'benefit'
  dir?: 'asc' | 'desc'
  q?: string
  page?: number
  perPage?: number
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

  return { fetchOverview, fetchRoutes, fetchRouteDetail }
}
