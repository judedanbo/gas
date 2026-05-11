import { sql } from 'drizzle-orm'
import { requirePermission } from '../../../utils/adminHelpers'
import { getDatabase, schema } from '../../../database'

const WINDOW_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30
}

/**
 * Bundles three operator/content-team-facing leaderboards in one round
 * trip:
 *
 *   - topQueries:        most-frequent search terms (with avg result count)
 *   - zeroResultQueries: searches that returned zero hits — content gap signal
 *   - hotNotFound:       top 404 paths from request_events — link-rot signal
 *
 * Query params:
 *   window: '24h' | '7d' | '30d' (default '7d')
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const db = getDatabase()
  const query = getQuery(event)
  const windowKey = typeof query.window === 'string' ? query.window : '7d'
  const hours = WINDOW_HOURS[windowKey] ?? WINDOW_HOURS['7d']

  // Top queries — group by hash so e.g. "audit report" and "Audit Report"
  // count together. Pull a representative text via MAX (any sample is fine).
  const topQueries = await db
    .select({
      queryHash: schema.searchQueries.queryHash,
      sampleText: sql<string>`MAX(query_text)`,
      count: sql<number>`COUNT(*)`,
      avgResults: sql<number>`AVG(result_count)`,
      lastSeen: sql<Date>`MAX(ts)`
    })
    .from(schema.searchQueries)
    .where(sql`ts >= (NOW() - INTERVAL ${sql.raw(String(hours))} HOUR)`)
    .groupBy(schema.searchQueries.queryHash)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(20)

  // Zero-result queries — same grouping; a one-off zero-result is noise,
  // so HAVING SUM(result_count) = 0 keeps only queries that ALWAYS came
  // back empty in the window.
  const zeroResultQueries = await db
    .select({
      queryHash: schema.searchQueries.queryHash,
      sampleText: sql<string>`MAX(query_text)`,
      count: sql<number>`COUNT(*)`,
      lastSeen: sql<Date>`MAX(ts)`
    })
    .from(schema.searchQueries)
    .where(sql`ts >= (NOW() - INTERVAL ${sql.raw(String(hours))} HOUR)`)
    .groupBy(schema.searchQueries.queryHash)
    .having(sql`SUM(result_count) = 0`)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(20)

  // 404 hot list — top route_paths that returned 404 in the window. Uses
  // the (status, ts) index so the scan stays bounded.
  const hotNotFound = await db
    .select({
      routePath: schema.requestEvents.routePath,
      count: sql<number>`COUNT(*)`,
      uniqueIps: sql<number>`COUNT(DISTINCT ip_hash)`,
      lastSeen: sql<Date>`MAX(ts)`
    })
    .from(schema.requestEvents)
    .where(sql`status = 404 AND ts >= (NOW() - INTERVAL ${sql.raw(String(hours))} HOUR)`)
    .groupBy(schema.requestEvents.routePath)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(20)

  return {
    windowHours: hours,
    topQueries: topQueries.map((q) => ({
      queryHash: q.queryHash,
      sampleText: String(q.sampleText ?? ''),
      count: Number(q.count),
      avgResults: Math.round(Number(q.avgResults) * 10) / 10,
      lastSeen: q.lastSeen instanceof Date ? q.lastSeen.toISOString() : String(q.lastSeen)
    })),
    zeroResultQueries: zeroResultQueries.map((q) => ({
      queryHash: q.queryHash,
      sampleText: String(q.sampleText ?? ''),
      count: Number(q.count),
      lastSeen: q.lastSeen instanceof Date ? q.lastSeen.toISOString() : String(q.lastSeen)
    })),
    hotNotFound: hotNotFound.map((r) => ({
      routePath: r.routePath,
      count: Number(r.count),
      uniqueIps: Number(r.uniqueIps),
      lastSeen: r.lastSeen instanceof Date ? r.lastSeen.toISOString() : String(r.lastSeen)
    }))
  }
})
