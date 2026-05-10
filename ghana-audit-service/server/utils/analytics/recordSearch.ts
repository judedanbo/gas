import type { H3Event } from 'h3'
import { createHash } from 'node:crypto'
import { getDatabase } from '../../database'
import { searchQueries } from '../../database/schema/analytics'

/**
 * Best-effort fire-and-forget insert into search_queries. Called from
 * /api/search after the response has been computed so it can carry the
 * actual result count. Never throws — analytics must never break a
 * legitimate search.
 *
 * Privacy notes:
 *   - The query text is stored truncated (256 chars). Searches sometimes
 *     contain PII (names, addresses); the retention task expires raw
 *     rows on the same schedule as request_events.
 *   - A separate hash of the lowercased + trimmed query enables stable
 *     grouping in the dashboard (e.g. "audit report 2023" and
 *     "  Audit Report 2023 " count as the same query).
 *   - Locale is captured so we can split EN vs AK content gaps.
 */

export interface RecordSearchInput {
  query: string
  resultCount: number
  locale?: string | null
}

function normaliseQueryForHash(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function recordSearch(event: H3Event, input: RecordSearchInput): void {
  const text = String(input.query || '').slice(0, 256)
  if (!text) return

  const hash = createHash('sha256').update(normaliseQueryForHash(text)).digest('hex')
  // Defensive: tests can construct events without `context`.
  const stash = event.context?.analytics
  const ipHash = stash?.ipHash ?? null
  const uaFamily = stash?.uaFamily ?? 'unknown'
  const locale = input.locale ? input.locale.slice(0, 8) : null

  void (async () => {
    try {
      const db = getDatabase()
      await db.insert(searchQueries).values({
        queryText: text,
        queryHash: hash,
        locale,
        resultCount: Math.max(0, input.resultCount | 0),
        ipHash,
        uaFamily
      })
    } catch (err) {
      console.warn('[analytics/search] insert failed:', (err as Error).message)
    }
  })()
}
