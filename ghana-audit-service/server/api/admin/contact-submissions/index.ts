import type { H3Event } from 'h3'
import type { SubmissionStatus } from '~/types/admin'
import { eq, and, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { contactSubmissionColumns } from '../../../utils/dtoColumns'

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

  // Filter by status
  if (query.status && typeof query.status === 'string') {
    conditions.push(eq(schema.contactSubmissions.status, query.status as SubmissionStatus))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contactSubmissions)
    .where(whereClause)

  const submissions = await db
    .select(contactSubmissionColumns)
    .from(schema.contactSubmissions)
    .where(whereClause)
    .orderBy(desc(schema.contactSubmissions.submittedAt))
    .limit(perPage)
    .offset(offset)

  return { data: submissions, meta: buildPaginationMeta(Number(count), page, perPage) }
}
