import type { Tender, PaginatedResponse } from '~/types'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { buildPaginationMeta } from '../utils/adminHelpers'
import { transformTenders, getLocaleFromRequest } from '../utils/transformTender'

export default defineEventHandler(async (event): Promise<PaginatedResponse<Tender>> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  // Parse pagination
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(50, Math.max(1, Number(query.perPage) || 10))
  const offset = (page - 1) * perPage

  // Build where conditions - only non-deleted tenders
  const conditions = [isNull(schema.tenders.deletedAt)]

  // Filter by status
  if (query.status && typeof query.status === 'string') {
    const validStatuses = ['open', 'closed', 'awarded', 'cancelled'] as const
    if (validStatuses.includes(query.status as (typeof validStatuses)[number])) {
      conditions.push(eq(schema.tenders.status, query.status as (typeof validStatuses)[number]))
    }
  }

  // Filter by category
  if (query.category && typeof query.category === 'string') {
    conditions.push(eq(schema.tenders.category, query.category))
  }

  const whereClause = and(...conditions)

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.tenders)
    .where(whereClause)

  // Fetch tenders
  const tenders = await db
    .select()
    .from(schema.tenders)
    .where(whereClause)
    .orderBy(desc(schema.tenders.publishedAt))
    .limit(perPage)
    .offset(offset)

  // Fetch translations for each tender
  const tenderIds = tenders.map((t) => t.id)
  const translations =
    tenderIds.length > 0
      ? await db
          .select()
          .from(schema.tenderTranslations)
          .where(sql`${schema.tenderTranslations.tenderId} IN (${sql.join(tenderIds, sql`, `)})`)
      : []

  // Group translations by tender
  const translationsByTender = translations.reduce(
    (acc, t) => {
      if (!acc[t.tenderId]) {
        acc[t.tenderId] = {}
      }
      acc[t.tenderId][t.locale] = {
        title: t.title,
        description: t.description
      }
      return acc
    },
    {} as Record<number, Record<string, { title: string; description: string }>>
  )

  // Combine tenders with translations
  const tendersWithTranslations = tenders.map((tender) => ({
    ...tender,
    translations: translationsByTender[tender.id] || {}
  }))

  // Transform to public format
  const data = transformTenders(tendersWithTranslations, locale)

  return {
    data,
    meta: buildPaginationMeta(Number(count), page, perPage)
  }
})
