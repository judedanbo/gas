import { and, desc, eq, gte, like, or, sql } from 'drizzle-orm'
import { requirePermission, parsePagination } from '../../../utils/adminHelpers'
import { getDatabase, schema } from '../../../database'

const ALLOWED_CLASS = new Set(['clean', 'crawler', 'suspicious', 'abusive', 'safe-allowlist'])

/**
 * Bot-signature leaderboard for the Abuse tab.
 *
 * Query params:
 *   classification: filter to one of clean | crawler | suspicious | abusive
 *                   | safe-allowlist (default: suspicious + abusive)
 *   minScore:       0..100 (default 0)
 *   q:              substring match on ip_hash or ua_hash (forensic lookup)
 *   page / perPage: standard pagination (default 50, max 100)
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const db = getDatabase()
  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)

  const conds = []
  const classification =
    typeof query.classification === 'string' && ALLOWED_CLASS.has(query.classification)
      ? query.classification
      : null
  if (classification) {
    conds.push(eq(schema.botSignatures.classification, classification))
  } else {
    conds.push(
      or(
        eq(schema.botSignatures.classification, 'suspicious'),
        eq(schema.botSignatures.classification, 'abusive'),
        eq(schema.botSignatures.classification, 'safe-allowlist')
      )!
    )
  }
  const minScore = Math.max(0, Math.min(100, Number(query.minScore) || 0))
  if (minScore > 0) conds.push(gte(schema.botSignatures.score, minScore))

  if (typeof query.q === 'string' && query.q) {
    const term = `%${query.q.slice(0, 64)}%`
    conds.push(
      or(like(schema.botSignatures.ipHash, term), like(schema.botSignatures.uaHash, term))!
    )
  }

  const where = conds.length ? and(...conds) : undefined

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(schema.botSignatures)
    .where(where)

  const items = await db
    .select({
      id: schema.botSignatures.id,
      ipHash: schema.botSignatures.ipHash,
      uaHash: schema.botSignatures.uaHash,
      uaFamily: schema.botSignatures.uaFamily,
      uaSample: schema.botSignatures.uaSample,
      firstSeen: schema.botSignatures.firstSeen,
      lastSeen: schema.botSignatures.lastSeen,
      totalRequests: schema.botSignatures.totalRequests,
      distinctRoutes24h: schema.botSignatures.distinctRoutes24h,
      rateLimitHits24h: schema.botSignatures.rateLimitHits24h,
      failedLogins24h: schema.botSignatures.failedLogins24h,
      score: schema.botSignatures.score,
      classification: schema.botSignatures.classification,
      notes: schema.botSignatures.notes,
      decidedBy: schema.botSignatures.decidedBy,
      decidedAt: schema.botSignatures.decidedAt,
      country: schema.botSignatures.country,
      asn: schema.botSignatures.asn
    })
    .from(schema.botSignatures)
    .where(where)
    .orderBy(desc(schema.botSignatures.score), desc(schema.botSignatures.lastSeen))
    .limit(perPage)
    .offset(offset)

  return {
    items: items.map((s) => ({
      ...s,
      firstSeen: s.firstSeen instanceof Date ? s.firstSeen.toISOString() : s.firstSeen,
      lastSeen: s.lastSeen instanceof Date ? s.lastSeen.toISOString() : s.lastSeen,
      decidedAt: s.decidedAt instanceof Date ? s.decidedAt.toISOString() : s.decidedAt
    })),
    meta: {
      total: Number(total),
      page,
      perPage,
      lastPage: Math.max(1, Math.ceil(Number(total) / perPage))
    }
  }
})
