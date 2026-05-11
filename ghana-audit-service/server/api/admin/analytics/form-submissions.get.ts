import { requirePermission } from '../../../utils/adminHelpers'
import { getPool } from '../../../database'

const WINDOW_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30
}

/**
 * Form-abuse cross-reference. Joins request_events for the public form
 * endpoints (/api/newsletter, /api/contact) against bot_signatures by
 * (ip_hash, ua_hash). Surfaces:
 *
 *   - total submissions
 *   - accepted (status 2xx)  vs  rejected (status 4xx) — the form's own
 *     CSRF / validation rejections vs successful posts
 *   - of accepted submissions, how many came from a (ip,ua) that the
 *     detector currently flags as suspicious or abusive — false negatives
 *     in the form's spam controls that admins can review
 *
 * Reads request_events bounded by route_pattern + window so the scan
 * uses the (route_pattern, ts) index.
 *
 * Query params:
 *   window: '24h' | '7d' | '30d' (default '7d')
 */

const FORM_PATTERNS = ['/api/newsletter', '/api/contact'] as const

const QUERY = `
  SELECT
    re.route_pattern AS pattern,
    COUNT(*) AS total,
    SUM(CASE WHEN re.status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS accepted,
    SUM(CASE WHEN re.status BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS rejected,
    COUNT(DISTINCT re.ip_hash) AS unique_ips,
    SUM(CASE
      WHEN re.status BETWEEN 200 AND 299 AND bs.classification = 'abusive'
      THEN 1 ELSE 0 END
    ) AS accepted_from_abusive,
    SUM(CASE
      WHEN re.status BETWEEN 200 AND 299 AND bs.classification = 'suspicious'
      THEN 1 ELSE 0 END
    ) AS accepted_from_suspicious,
    SUM(CASE
      WHEN re.status BETWEEN 200 AND 299 AND bs.classification = 'crawler'
      THEN 1 ELSE 0 END
    ) AS accepted_from_crawler
  FROM request_events re
  LEFT JOIN bot_signatures bs
    ON bs.ip_hash = re.ip_hash AND bs.ua_hash = re.ua_hash
  WHERE re.route_pattern IN (?, ?)
    AND re.method = 'POST'
    AND re.ts >= (NOW() - INTERVAL ? HOUR)
  GROUP BY re.route_pattern
`

interface QueryRow {
  pattern: string
  total: number
  accepted: number
  rejected: number
  unique_ips: number
  accepted_from_abusive: number
  accepted_from_suspicious: number
  accepted_from_crawler: number
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const query = getQuery(event)
  const windowKey = typeof query.window === 'string' ? query.window : '7d'
  const hours = WINDOW_HOURS[windowKey] ?? WINDOW_HOURS['7d']

  const pool = getPool()
  const [rows] = (await pool.query(QUERY, [FORM_PATTERNS[0], FORM_PATTERNS[1], hours])) as [
    QueryRow[],
    unknown
  ]

  // Guarantee both forms appear in the response even when one had zero
  // submissions in the window — the Overview card should always render
  // both rows. Build a map keyed by pattern, fill missing entries.
  const byPattern = new Map<string, QueryRow>()
  for (const r of rows) byPattern.set(r.pattern, r)

  const items = FORM_PATTERNS.map((pattern) => {
    const r = byPattern.get(pattern)
    const accepted = Number(r?.accepted ?? 0)
    const acceptedFromAbusive = Number(r?.accepted_from_abusive ?? 0)
    const acceptedFromSuspicious = Number(r?.accepted_from_suspicious ?? 0)
    const acceptedFromCrawler = Number(r?.accepted_from_crawler ?? 0)
    return {
      pattern,
      total: Number(r?.total ?? 0),
      accepted,
      rejected: Number(r?.rejected ?? 0),
      uniqueIps: Number(r?.unique_ips ?? 0),
      accepted_from: {
        abusive: acceptedFromAbusive,
        suspicious: acceptedFromSuspicious,
        crawler: acceptedFromCrawler,
        clean: Math.max(
          0,
          accepted - acceptedFromAbusive - acceptedFromSuspicious - acceptedFromCrawler
        )
      },
      // Convenience: any non-zero accepted-from-suspect signals warrant
      // a visual flag in the dashboard.
      hasSuspectAccepts: acceptedFromAbusive + acceptedFromSuspicious > 0
    }
  })

  return { windowHours: hours, items }
})
