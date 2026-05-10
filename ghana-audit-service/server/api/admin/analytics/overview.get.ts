import { sql } from 'drizzle-orm'
import { requirePermission } from '../../../utils/adminHelpers'
import { getDatabase, schema } from '../../../database'

/**
 * Aggregated stats for the Analytics → Overview tab. All numbers come from
 * route_stats_hourly + download_events (rollups), never from request_events
 * directly, so the response is fast regardless of raw event volume.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const db = getDatabase()

  const [totals] = await db
    .select({
      visits: sql<number>`COALESCE(SUM(visits), 0)`,
      bytes: sql<number>`COALESCE(SUM(bytes_out), 0)`,
      botVisits: sql<number>`COALESCE(SUM(bot_visits), 0)`,
      cacheHits: sql<number>`COALESCE(SUM(cache_hits), 0)`,
      uniqueIps: sql<number>`COALESCE(SUM(unique_ips), 0)`,
      errors: sql<number>`COALESCE(SUM(status_4xx + status_5xx), 0)`,
      // Visit-weighted average p95 across routes — gives a single ops number
      // without paying for an exact percentile over the raw events.
      avgP95: sql<number>`
        COALESCE(
          SUM(p95_ms * visits) / NULLIF(SUM(visits), 0),
          0
        )
      `
    })
    .from(schema.routeStatsHourly)
    .where(sql`hour >= (NOW() - INTERVAL 24 HOUR)`)

  const [downloads24h] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.downloadEvents)
    .where(sql`ts >= (NOW() - INTERVAL 24 HOUR)`)

  const topRoutes = await db
    .select({
      pattern: schema.routeStatsHourly.routePattern,
      visits: sql<number>`SUM(visits)`,
      uniqueIps: sql<number>`SUM(unique_ips)`,
      bytes: sql<number>`SUM(bytes_out)`,
      p95: sql<number>`MAX(p95_ms)`,
      cacheHits: sql<number>`SUM(cache_hits)`
    })
    .from(schema.routeStatsHourly)
    .where(sql`hour >= (NOW() - INTERVAL 24 HOUR)`)
    .groupBy(schema.routeStatsHourly.routePattern)
    .orderBy(sql`SUM(visits) DESC`)
    .limit(10)

  const topDownloads = await db
    .select({
      kind: schema.downloadEvents.kind,
      targetId: schema.downloadEvents.targetId,
      slug: sql<string | null>`MAX(slug)`,
      count: sql<number>`COUNT(*)`,
      bytes: sql<number>`COALESCE(SUM(bytes_out), 0)`
    })
    .from(schema.downloadEvents)
    .where(sql`ts >= (NOW() - INTERVAL 24 HOUR)`)
    .groupBy(schema.downloadEvents.kind, schema.downloadEvents.targetId)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10)

  // Hourly stacked-area data for the last 7 days: human vs bot.
  const hourlyRows = await db
    .select({
      hour: schema.routeStatsHourly.hour,
      visits: sql<number>`SUM(visits)`,
      botVisits: sql<number>`SUM(bot_visits)`
    })
    .from(schema.routeStatsHourly)
    .where(sql`hour >= (NOW() - INTERVAL 7 DAY)`)
    .groupBy(schema.routeStatsHourly.hour)
    .orderBy(schema.routeStatsHourly.hour)

  const visits = Number(totals?.visits ?? 0)
  const botVisits = Number(totals?.botVisits ?? 0)
  const cacheHits = Number(totals?.cacheHits ?? 0)
  const errors = Number(totals?.errors ?? 0)

  return {
    last24h: {
      visits,
      uniqueIps: Number(totals?.uniqueIps ?? 0),
      bytes: Number(totals?.bytes ?? 0),
      downloads: Number(downloads24h?.count ?? 0),
      botShare: visits > 0 ? botVisits / visits : 0,
      cacheHitRate: visits > 0 ? cacheHits / visits : 0,
      errorRate: visits > 0 ? errors / visits : 0,
      avgP95Ms: Math.round(Number(totals?.avgP95 ?? 0))
    },
    topRoutes: topRoutes.map((r) => ({
      pattern: r.pattern,
      visits: Number(r.visits),
      uniqueIps: Number(r.uniqueIps),
      bytes: Number(r.bytes),
      p95Ms: Number(r.p95),
      cacheHitRate: Number(r.visits) > 0 ? Number(r.cacheHits) / Number(r.visits) : 0
    })),
    topDownloads: topDownloads.map((d) => ({
      kind: d.kind,
      targetId: d.targetId,
      slug: d.slug,
      count: Number(d.count),
      bytes: Number(d.bytes)
    })),
    hourly: hourlyRows.map((h) => ({
      hour: h.hour instanceof Date ? h.hour.toISOString() : String(h.hour),
      humanVisits: Math.max(0, Number(h.visits) - Number(h.botVisits)),
      botVisits: Number(h.botVisits)
    }))
  }
})
