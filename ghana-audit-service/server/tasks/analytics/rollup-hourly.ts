import { getPool } from '../../database'

/**
 * Aggregate the previous full hour from request_events into
 * route_stats_hourly. Idempotent via INSERT … ON DUPLICATE KEY UPDATE on
 * (hour, route_pattern), so missed runs can be replayed safely with the
 * `targetHour` payload override.
 *
 * MySQL 8 lacks a true PERCENTILE_CONT aggregate, so we approximate p50 /
 * p95 / p99 with NTILE(100) — fast enough for hourly batches and accurate
 * enough for ops dashboards. See open question 13.2 in the design doc.
 */

interface TaskPayload {
  // ISO datetime; if set, rolls up the hour starting at this instant. Useful
  // for backfills / replays.
  targetHour?: string
}

const ROLLUP_SQL = `
  INSERT INTO route_stats_hourly (
    hour, route_pattern, visits, unique_ips, bot_visits, cache_hits,
    bytes_out, p50_ms, p95_ms, p99_ms,
    status_2xx, status_3xx, status_4xx, status_5xx
  )
  SELECT
    DATE_FORMAT(ts, '%Y-%m-%d %H:00:00') AS bucket_hour,
    route_pattern,
    COUNT(*) AS visits,
    COUNT(DISTINCT ip_hash) AS unique_ips,
    SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot_visits,
    SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) AS cache_hits,
    COALESCE(SUM(bytes_out), 0) AS bytes_out,
    COALESCE(MAX(CASE WHEN bucket = 50 THEN duration_ms END), 0) AS p50_ms,
    COALESCE(MAX(CASE WHEN bucket = 95 THEN duration_ms END), 0) AS p95_ms,
    COALESCE(MAX(CASE WHEN bucket = 99 THEN duration_ms END), 0) AS p99_ms,
    SUM(CASE WHEN status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS status_2xx,
    SUM(CASE WHEN status BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS status_3xx,
    SUM(CASE WHEN status BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS status_4xx,
    SUM(CASE WHEN status BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS status_5xx
  FROM (
    SELECT
      ts, route_pattern, status, duration_ms, bytes_out,
      cache_hit, ip_hash, is_bot,
      NTILE(100) OVER (PARTITION BY route_pattern ORDER BY duration_ms) AS bucket
    FROM request_events
    WHERE ts >= ? AND ts < ?
  ) e
  GROUP BY bucket_hour, route_pattern
  ON DUPLICATE KEY UPDATE
    visits = VALUES(visits),
    unique_ips = VALUES(unique_ips),
    bot_visits = VALUES(bot_visits),
    cache_hits = VALUES(cache_hits),
    bytes_out = VALUES(bytes_out),
    p50_ms = VALUES(p50_ms),
    p95_ms = VALUES(p95_ms),
    p99_ms = VALUES(p99_ms),
    status_2xx = VALUES(status_2xx),
    status_3xx = VALUES(status_3xx),
    status_4xx = VALUES(status_4xx),
    status_5xx = VALUES(status_5xx)
`

function truncateToHour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0)
}

export default defineTask({
  meta: {
    name: 'analytics:rollup-hourly',
    description: 'Aggregate request_events into route_stats_hourly for one hour'
  },
  async run({ payload }: { payload?: TaskPayload }) {
    const targetHour = payload?.targetHour
      ? truncateToHour(new Date(payload.targetHour))
      : truncateToHour(new Date(Date.now() - 60 * 60 * 1000))
    const nextHour = new Date(targetHour.getTime() + 60 * 60 * 1000)

    const pool = getPool()
    const [result] = (await pool.query(ROLLUP_SQL, [targetHour, nextHour])) as [
      { affectedRows: number },
      unknown
    ]

    return {
      result: {
        hour: targetHour.toISOString(),
        affectedRows: result.affectedRows
      }
    }
  }
})
