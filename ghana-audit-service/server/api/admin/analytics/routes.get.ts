import { requirePermission, parsePagination } from '../../../utils/adminHelpers'
import { getPool } from '../../../database'

const SORT_COLUMNS: Record<string, string> = {
  visits: 'visits',
  uniqueIps: 'unique_ips',
  p95: 'p95',
  errorRate: 'error_rate',
  cacheHitRate: 'cache_hit_rate',
  bytes: 'bytes',
  benefit: 'benefit'
}

const WINDOW_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30
}

/**
 * Sortable, filterable per-route stats for the Analytics → Routes tab.
 * Reads only from route_stats_hourly so dashboard latency is independent
 * of raw event volume.
 *
 * Query params:
 *   window:  '24h' | '7d' | '30d' (default '7d')
 *   sort:    'visits' | 'uniqueIps' | 'p95' | 'errorRate' | 'cacheHitRate'
 *            | 'bytes' | 'benefit' (default 'visits')
 *   dir:     'asc' | 'desc' (default 'desc')
 *   q:       optional substring match on route_pattern
 *   page:    1-based page number
 *   perPage: default 50, max 100
 *
 * The "benefit" sort surfaces caching candidates: visits × p95Ms is a proxy
 * for "wall-clock the cache could save".
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const query = getQuery(event)

  const windowKey = typeof query.window === 'string' ? query.window : '7d'
  const hours = WINDOW_HOURS[windowKey] ?? WINDOW_HOURS['7d']
  const sortKey = typeof query.sort === 'string' ? query.sort : 'visits'
  const sortColumn = SORT_COLUMNS[sortKey] ?? 'visits'
  const sortDir = query.dir === 'asc' ? 'ASC' : 'DESC'
  const search = typeof query.q === 'string' ? query.q.slice(0, 200) : ''
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)

  const params: (string | number)[] = [hours]
  let whereSql = `hour >= (NOW() - INTERVAL ? HOUR)`
  if (search) {
    whereSql += ` AND route_pattern LIKE ?`
    params.push(`%${search}%`)
  }

  const baseSql = `
    SELECT
      route_pattern AS pattern,
      SUM(visits) AS visits,
      SUM(unique_ips) AS unique_ips,
      MAX(p95_ms) AS p95,
      MAX(p99_ms) AS p99,
      SUM(bytes_out) AS bytes,
      SUM(cache_hits) AS cache_hits,
      SUM(bot_visits) AS bot_visits,
      SUM(status_4xx + status_5xx) AS errors,
      SUM(visits) * MAX(p95_ms) AS benefit,
      CASE WHEN SUM(visits) > 0
        THEN SUM(status_4xx + status_5xx) / SUM(visits)
        ELSE 0
      END AS error_rate,
      CASE WHEN SUM(visits) > 0
        THEN SUM(cache_hits) / SUM(visits)
        ELSE 0
      END AS cache_hit_rate
    FROM route_stats_hourly
    WHERE ${whereSql}
    GROUP BY route_pattern
  `

  const countSql = `SELECT COUNT(*) AS total FROM (${baseSql}) AS inner_q`
  const dataSql = `${baseSql} ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`

  const pool = getPool()
  const [countRows] = (await pool.query(countSql, params)) as [Array<{ total: number }>, unknown]
  const total = Number(countRows[0]?.total ?? 0)

  const [rows] = (await pool.query(dataSql, [...params, perPage, offset])) as [
    Array<{
      pattern: string
      visits: number
      unique_ips: number
      p95: number
      p99: number
      bytes: number
      cache_hits: number
      bot_visits: number
      errors: number
      benefit: number
      error_rate: number
      cache_hit_rate: number
    }>,
    unknown
  ]

  return {
    items: rows.map((r) => ({
      pattern: r.pattern,
      visits: Number(r.visits),
      uniqueIps: Number(r.unique_ips),
      p95Ms: Number(r.p95),
      p99Ms: Number(r.p99),
      bytes: Number(r.bytes),
      cacheHitRate: Number(r.cache_hit_rate),
      errorRate: Number(r.error_rate),
      botShare: Number(r.visits) > 0 ? Number(r.bot_visits) / Number(r.visits) : 0,
      benefit: Number(r.benefit)
    })),
    meta: {
      total,
      page,
      perPage,
      lastPage: Math.max(1, Math.ceil(total / perPage)),
      windowHours: hours,
      sort: sortKey,
      dir: sortDir.toLowerCase()
    }
  }
})
