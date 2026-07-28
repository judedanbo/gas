import type { H3Event } from 'h3'
import { asc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission } from '../../../utils/adminHelpers'

/**
 * Site statistics are an edit-only fixed set (seeded, no create/delete), so
 * this endpoint only lists. Returns all rows sorted by section + display order;
 * the set is small (~11 rows) so no pagination is needed.
 */
export default defineEventHandler(async (event) => {
  if (event.method === 'GET') return handleList(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const db = getDatabase()

  const stats = await db
    .select()
    .from(schema.siteStats)
    .orderBy(asc(schema.siteStats.section), asc(schema.siteStats.displayOrder))

  // Fixed set — return all in one page (shape matches the paginated contract
  // useAdminCrud.fetchAll expects).
  return {
    data: stats,
    meta: { total: stats.length, page: 1, perPage: stats.length || 1, lastPage: 1 }
  }
}
