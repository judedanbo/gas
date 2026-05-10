import { and, desc, eq, sql } from 'drizzle-orm'
import { requirePermission, parsePagination } from '../../../utils/adminHelpers'
import { getDatabase, schema } from '../../../database'

const ALLOWED_KINDS = new Set([
  'rate_limit_api',
  'rate_limit_download',
  'rate_limit_form',
  'failed_login',
  'probing_path',
  'header_anomaly',
  'download_burst',
  'crawl_burst'
])

const ALLOWED_SEVERITIES = new Set(['info', 'warning', 'critical'])

const WINDOW_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90
}

/**
 * Paginated abuse_incidents list for the Abuse tab timeline.
 *
 * Query params:
 *   kind:     filter to one of the allowed kinds
 *   severity: 'info' | 'warning' | 'critical'
 *   window:   '24h' | '7d' | '30d' | '90d' (default '7d')
 *   ipHash:   filter to a specific signature
 *   page / perPage
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const db = getDatabase()
  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)

  const conds = []
  const windowKey = typeof query.window === 'string' ? query.window : '7d'
  const hours = WINDOW_HOURS[windowKey] ?? WINDOW_HOURS['7d']
  conds.push(sql`${schema.abuseIncidents.ts} >= (NOW() - INTERVAL ${sql.raw(String(hours))} HOUR)`)

  if (typeof query.kind === 'string' && ALLOWED_KINDS.has(query.kind)) {
    conds.push(eq(schema.abuseIncidents.kind, query.kind))
  }
  if (typeof query.severity === 'string' && ALLOWED_SEVERITIES.has(query.severity)) {
    conds.push(eq(schema.abuseIncidents.severity, query.severity))
  }
  if (typeof query.ipHash === 'string' && query.ipHash) {
    conds.push(eq(schema.abuseIncidents.ipHash, query.ipHash.slice(0, 64)))
  }

  const where = and(...conds)

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(schema.abuseIncidents)
    .where(where)

  const items = await db
    .select({
      id: schema.abuseIncidents.id,
      ts: schema.abuseIncidents.ts,
      kind: schema.abuseIncidents.kind,
      severity: schema.abuseIncidents.severity,
      ipHash: schema.abuseIncidents.ipHash,
      uaHash: schema.abuseIncidents.uaHash,
      routePattern: schema.abuseIncidents.routePattern,
      routePath: schema.abuseIncidents.routePath,
      details: schema.abuseIncidents.details
    })
    .from(schema.abuseIncidents)
    .where(where)
    .orderBy(desc(schema.abuseIncidents.ts))
    .limit(perPage)
    .offset(offset)

  return {
    items: items.map((i) => ({
      ...i,
      ts: i.ts instanceof Date ? i.ts.toISOString() : i.ts
    })),
    meta: {
      total: Number(total),
      page,
      perPage,
      lastPage: Math.max(1, Math.ceil(Number(total) / perPage)),
      windowHours: hours
    }
  }
})
