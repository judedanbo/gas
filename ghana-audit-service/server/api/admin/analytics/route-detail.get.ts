import { sql } from 'drizzle-orm'
import { requirePermission } from '../../../utils/adminHelpers'
import { getDatabase, schema } from '../../../database'

const WINDOW_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30
}

/**
 * Drill-down for a single route_pattern. Returns:
 *   - hourly time series of visits + bot share (rollup)
 *   - status code aggregates over the window (rollup)
 *   - top 10 ip hashes hitting this pattern (raw events; bounded by the
 *     window to keep the scan small)
 *
 * Pattern is provided as ?pattern= because it contains slashes and bracket
 * placeholders that don't round-trip cleanly through path params.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const query = getQuery(event)

  const pattern = typeof query.pattern === 'string' ? query.pattern : ''
  if (!pattern) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required query param: pattern'
    })
  }
  const windowKey = typeof query.window === 'string' ? query.window : '7d'
  const hours = WINDOW_HOURS[windowKey] ?? WINDOW_HOURS['7d']

  const db = getDatabase()

  const hourly = await db
    .select({
      hour: schema.routeStatsHourly.hour,
      visits: schema.routeStatsHourly.visits,
      botVisits: schema.routeStatsHourly.botVisits,
      p95Ms: schema.routeStatsHourly.p95Ms,
      cacheHits: schema.routeStatsHourly.cacheHits
    })
    .from(schema.routeStatsHourly)
    .where(
      sql`route_pattern = ${pattern} AND hour >= (NOW() - INTERVAL ${sql.raw(String(hours))} HOUR)`
    )
    .orderBy(schema.routeStatsHourly.hour)

  const [statusTotals] = await db
    .select({
      visits: sql<number>`COALESCE(SUM(visits), 0)`,
      uniqueIps: sql<number>`COALESCE(SUM(unique_ips), 0)`,
      bytes: sql<number>`COALESCE(SUM(bytes_out), 0)`,
      cacheHits: sql<number>`COALESCE(SUM(cache_hits), 0)`,
      botVisits: sql<number>`COALESCE(SUM(bot_visits), 0)`,
      s2: sql<number>`COALESCE(SUM(status_2xx), 0)`,
      s3: sql<number>`COALESCE(SUM(status_3xx), 0)`,
      s4: sql<number>`COALESCE(SUM(status_4xx), 0)`,
      s5: sql<number>`COALESCE(SUM(status_5xx), 0)`,
      maxP95: sql<number>`COALESCE(MAX(p95_ms), 0)`,
      maxP99: sql<number>`COALESCE(MAX(p99_ms), 0)`
    })
    .from(schema.routeStatsHourly)
    .where(
      sql`route_pattern = ${pattern} AND hour >= (NOW() - INTERVAL ${sql.raw(String(hours))} HOUR)`
    )

  // Top IPs are sourced from request_events directly because route_stats_hourly
  // doesn't preserve per-IP grouping. Window is bounded so the scan uses the
  // (route_pattern, ts) index.
  const topIps = await db
    .select({
      ipHash: schema.requestEvents.ipHash,
      uaFamily: schema.requestEvents.uaFamily,
      country: sql<string | null>`MAX(country)`,
      asn: sql<number | null>`MAX(asn)`,
      count: sql<number>`COUNT(*)`,
      bytes: sql<number>`COALESCE(SUM(bytes_out), 0)`,
      lastSeen: sql<Date>`MAX(ts)`
    })
    .from(schema.requestEvents)
    .where(
      sql`route_pattern = ${pattern} AND ts >= (NOW() - INTERVAL ${sql.raw(String(hours))} HOUR)`
    )
    .groupBy(schema.requestEvents.ipHash, schema.requestEvents.uaFamily)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10)

  return {
    pattern,
    windowHours: hours,
    totals: {
      visits: Number(statusTotals?.visits ?? 0),
      uniqueIps: Number(statusTotals?.uniqueIps ?? 0),
      bytes: Number(statusTotals?.bytes ?? 0),
      cacheHits: Number(statusTotals?.cacheHits ?? 0),
      botVisits: Number(statusTotals?.botVisits ?? 0),
      maxP95Ms: Number(statusTotals?.maxP95 ?? 0),
      maxP99Ms: Number(statusTotals?.maxP99 ?? 0),
      status: {
        '2xx': Number(statusTotals?.s2 ?? 0),
        '3xx': Number(statusTotals?.s3 ?? 0),
        '4xx': Number(statusTotals?.s4 ?? 0),
        '5xx': Number(statusTotals?.s5 ?? 0)
      }
    },
    hourly: hourly.map((h) => ({
      hour: h.hour instanceof Date ? h.hour.toISOString() : String(h.hour),
      visits: Number(h.visits),
      botVisits: Number(h.botVisits),
      humanVisits: Math.max(0, Number(h.visits) - Number(h.botVisits)),
      p95Ms: Number(h.p95Ms),
      cacheHits: Number(h.cacheHits)
    })),
    topIps: topIps.map((r) => ({
      ipHash: r.ipHash,
      uaFamily: r.uaFamily,
      country: r.country ?? null,
      asn: r.asn != null ? Number(r.asn) : null,
      visits: Number(r.count),
      bytes: Number(r.bytes),
      lastSeen: r.lastSeen instanceof Date ? r.lastSeen.toISOString() : String(r.lastSeen)
    }))
  }
})
