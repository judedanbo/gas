import type { H3Event } from 'h3'
import { eq, and, sql, desc, isNotNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, parsePagination, buildPaginationMeta } from '../../../utils/adminHelpers'
import { newsletterSubscriberColumns } from '../../../utils/dtoColumns'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleList(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()

  const conditions = []

  // Filter by confirmed status
  if (query.confirmed === 'true') {
    conditions.push(eq(schema.newsletterSubscribers.confirmed, true))
  } else if (query.confirmed === 'false') {
    conditions.push(eq(schema.newsletterSubscribers.confirmed, false))
  }

  // Filter by unsubscribed status
  if (query.unsubscribed === 'true') {
    conditions.push(isNotNull(schema.newsletterSubscribers.unsubscribedAt))
  } else if (query.unsubscribed === 'false') {
    conditions.push(sql`${schema.newsletterSubscribers.unsubscribedAt} IS NULL`)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.newsletterSubscribers)
    .where(whereClause)

  const subscribers = await db
    .select(newsletterSubscriberColumns)
    .from(schema.newsletterSubscribers)
    .where(whereClause)
    .orderBy(desc(schema.newsletterSubscribers.subscribedAt))
    .limit(perPage)
    .offset(offset)

  // Get summary stats
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      confirmed: sql<number>`sum(case when confirmed = true then 1 else 0 end)`,
      unsubscribed: sql<number>`sum(case when unsubscribed_at is not null then 1 else 0 end)`
    })
    .from(schema.newsletterSubscribers)

  return {
    data: subscribers,
    meta: buildPaginationMeta(Number(count), page, perPage),
    stats: {
      total: Number(stats.total) || 0,
      confirmed: Number(stats.confirmed) || 0,
      unsubscribed: Number(stats.unsubscribed) || 0,
      active: (Number(stats.confirmed) || 0) - (Number(stats.unsubscribed) || 0)
    }
  }
}
