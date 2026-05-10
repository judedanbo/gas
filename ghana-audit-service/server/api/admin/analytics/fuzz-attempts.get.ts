import { requirePermission } from '../../../utils/adminHelpers'
import { getPool } from '../../../database'

const WINDOW_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30
}

/**
 * Fuzz-attempt leaderboard for the Abuse tab.
 *
 * Aggregates abuse_incidents WHERE kind = 'fuzz_attempt' grouped by
 * (ip_hash, ua_hash) over a time window, joined to bot_signatures for
 * country / ua_family / current classification context. The top kind
 * for each row is computed from the JSON details so admins can tell at
 * a glance whether they're looking at SQLi vs XSS vs path-traversal
 * fuzzers.
 *
 * Query params:
 *   window: '24h' | '7d' | '30d' (default '7d')
 */

const QUERY = `
  SELECT
    ai.ip_hash,
    ai.ua_hash,
    bs.ua_family,
    bs.country,
    bs.classification,
    COUNT(*) AS count,
    MAX(ai.severity) AS top_severity,
    MAX(ai.ts) AS last_seen,
    -- top_kind: most-common match family across this signature's incidents.
    -- Derived by extracting details->>'$.matches[0].kind' (the first match
    -- per incident is the highest-severity one — see fuzzPatterns.ts).
    SUBSTRING_INDEX(
      GROUP_CONCAT(
        JSON_UNQUOTE(JSON_EXTRACT(ai.details, '$.matches[0].kind'))
        ORDER BY ai.ts DESC
        SEPARATOR ','
      ),
      ',',
      1
    ) AS top_kind
  FROM abuse_incidents ai
  LEFT JOIN bot_signatures bs
    ON bs.ip_hash = ai.ip_hash AND bs.ua_hash = ai.ua_hash
  WHERE ai.kind = 'fuzz_attempt'
    AND ai.ts >= (NOW() - INTERVAL ? HOUR)
  GROUP BY ai.ip_hash, ai.ua_hash, bs.ua_family, bs.country, bs.classification
  ORDER BY count DESC, last_seen DESC
  LIMIT 20
`

interface QueryRow {
  ip_hash: string
  ua_hash: string
  ua_family: string | null
  country: string | null
  classification: string | null
  count: number
  top_severity: string
  top_kind: string | null
  last_seen: Date | string
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const query = getQuery(event)
  const windowKey = typeof query.window === 'string' ? query.window : '7d'
  const hours = WINDOW_HOURS[windowKey] ?? WINDOW_HOURS['7d']

  const pool = getPool()
  const [rows] = (await pool.query(QUERY, [hours])) as [QueryRow[], unknown]

  return {
    windowHours: hours,
    items: rows.map((r) => ({
      ipHash: r.ip_hash,
      uaHash: r.ua_hash,
      uaFamily: r.ua_family ?? 'unknown',
      country: r.country ?? null,
      classification: r.classification ?? null,
      count: Number(r.count),
      topSeverity: String(r.top_severity || 'info'),
      topKind: r.top_kind ?? null,
      lastSeen: r.last_seen instanceof Date ? r.last_seen.toISOString() : String(r.last_seen)
    }))
  }
})
