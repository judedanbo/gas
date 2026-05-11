import { sql } from 'drizzle-orm'
import { requirePermission } from '../../../utils/adminHelpers'
import { getDatabase, getPool, schema } from '../../../database'
import { getRedis } from '../../../utils/redis'

const WINDOW_DAYS: Record<string, number> = {
  '30d': 30,
  '90d': 90,
  '365d': 365
}

interface RedisInfo {
  usedMemoryBytes: number | null
  peakMemoryBytes: number | null
  evictedKeys: number | null
  keyCount: number | null
}

async function readRedisInfo(): Promise<RedisInfo> {
  const redis = getRedis()
  if (!redis) {
    return { usedMemoryBytes: null, peakMemoryBytes: null, evictedKeys: null, keyCount: null }
  }
  try {
    const memory = await redis.info('memory')
    const stats = await redis.info('stats')
    const keyCount = await redis.dbsize()

    const num = (block: string, field: string): number | null => {
      const m = block.match(new RegExp(`^${field}:(\\d+)`, 'm'))
      return m ? Number(m[1]) : null
    }
    return {
      usedMemoryBytes: num(memory, 'used_memory'),
      peakMemoryBytes: num(memory, 'used_memory_peak'),
      evictedKeys: num(stats, 'evicted_keys'),
      keyCount
    }
  } catch {
    return { usedMemoryBytes: null, peakMemoryBytes: null, evictedKeys: null, keyCount: null }
  }
}

/**
 * Capacity-planning data for the Analytics → Capacity tab. Reads only from
 * route_stats_hourly + a single COUNT/MIN on request_events + Redis INFO,
 * so the response stays cheap regardless of raw event volume.
 *
 * Query params:
 *   window: '30d' | '90d' | '365d' (default '30d')
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const db = getDatabase()
  const query = getQuery(event)
  const windowKey = typeof query.window === 'string' ? query.window : '30d'
  const days = WINDOW_DAYS[windowKey] ?? 30

  // ── Hourly timeseries (visits + bytes + cache hits) ──────────────────
  const hourly = await db
    .select({
      hour: schema.routeStatsHourly.hour,
      visits: sql<number>`SUM(visits)`,
      bytes: sql<number>`SUM(bytes_out)`,
      cacheHits: sql<number>`SUM(cache_hits)`
    })
    .from(schema.routeStatsHourly)
    .where(sql`hour >= (NOW() - INTERVAL ${sql.raw(String(days))} DAY)`)
    .groupBy(schema.routeStatsHourly.hour)
    .orderBy(schema.routeStatsHourly.hour)

  // ── Slowest 10 routes by visit-weighted p95 ──────────────────────────
  const slowest = await db
    .select({
      pattern: schema.routeStatsHourly.routePattern,
      visits: sql<number>`SUM(visits)`,
      avgP95: sql<number>`
        COALESCE(SUM(p95_ms * visits) / NULLIF(SUM(visits), 0), 0)
      `
    })
    .from(schema.routeStatsHourly)
    .where(sql`hour >= (NOW() - INTERVAL ${sql.raw(String(days))} DAY)`)
    .groupBy(schema.routeStatsHourly.routePattern)
    .having(sql`SUM(visits) > 0`)
    .orderBy(sql`avgP95 DESC`)
    .limit(10)

  // ── Heaviest 10 routes by total bytes out ────────────────────────────
  const heaviest = await db
    .select({
      pattern: schema.routeStatsHourly.routePattern,
      bytes: sql<number>`SUM(bytes_out)`,
      visits: sql<number>`SUM(visits)`
    })
    .from(schema.routeStatsHourly)
    .where(sql`hour >= (NOW() - INTERVAL ${sql.raw(String(days))} DAY)`)
    .groupBy(schema.routeStatsHourly.routePattern)
    .orderBy(sql`SUM(bytes_out) DESC`)
    .limit(10)

  // ── Day-of-week × hour-of-day heatmap (avg visits per cell) ──────────
  // DAYOFWEEK in MySQL: Sunday=1..Saturday=7. Subtract 1 so Sunday=0,
  // Saturday=6 — closer to JS Date.getDay().
  const heatmapRows = (await getPool()
    .query(
      `
      SELECT
        DAYOFWEEK(hour) - 1 AS dow,
        HOUR(hour)        AS hr,
        AVG(visits)       AS avg_visits
      FROM route_stats_hourly
      WHERE hour >= (NOW() - INTERVAL ? DAY)
      GROUP BY dow, hr
      ORDER BY dow, hr
    `,
      [days]
    )
    .then(([rows]) => rows)) as Array<{ dow: number; hr: number; avg_visits: number }>

  // ── Storage growth (proxy via daily visit totals from rollup) ────────
  const dailyRows = await db
    .select({
      day: sql<string>`DATE(hour)`,
      visits: sql<number>`SUM(visits)`,
      bytes: sql<number>`SUM(bytes_out)`
    })
    .from(schema.routeStatsHourly)
    .where(sql`hour >= (NOW() - INTERVAL ${sql.raw(String(days))} DAY)`)
    .groupBy(sql`DATE(hour)`)
    .orderBy(sql`DATE(hour)`)

  // ── Raw-events table size (single COUNT + MIN; fast on indexed col) ──
  const [storage] = await db
    .select({
      rawRows: sql<number>`(SELECT COUNT(*) FROM request_events)`,
      oldestRaw: sql<Date | null>`(SELECT MIN(ts) FROM request_events)`,
      downloadRows: sql<number>`(SELECT COUNT(*) FROM download_events)`
    })
    .from(sql`(SELECT 1) AS dual`)

  // ── Redis stats ──────────────────────────────────────────────────────
  const redisInfo = await readRedisInfo()

  return {
    windowDays: days,
    hourly: hourly.map((h) => ({
      hour: h.hour instanceof Date ? h.hour.toISOString() : String(h.hour),
      visits: Number(h.visits),
      bytes: Number(h.bytes),
      cacheHits: Number(h.cacheHits)
    })),
    daily: dailyRows.map((d) => ({
      day: String(d.day),
      visits: Number(d.visits),
      bytes: Number(d.bytes)
    })),
    slowestRoutes: slowest.map((r) => ({
      pattern: r.pattern,
      visits: Number(r.visits),
      avgP95Ms: Math.round(Number(r.avgP95))
    })),
    heaviestRoutes: heaviest.map((r) => ({
      pattern: r.pattern,
      bytes: Number(r.bytes),
      visits: Number(r.visits),
      avgBytesPerVisit: Number(r.visits) > 0 ? Math.round(Number(r.bytes) / Number(r.visits)) : 0
    })),
    heatmap: heatmapRows.map((c) => ({
      dow: Number(c.dow),
      hr: Number(c.hr),
      avgVisits: Math.round(Number(c.avg_visits))
    })),
    storage: {
      requestEventsRows: Number(storage?.rawRows ?? 0),
      downloadEventsRows: Number(storage?.downloadRows ?? 0),
      oldestRequestEvent:
        storage?.oldestRaw instanceof Date ? storage.oldestRaw.toISOString() : null
    },
    redis: redisInfo
  }
})
