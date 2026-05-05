import type { Publication, PublicationType, PaginatedResponse } from '~/types'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { buildPaginationMeta } from '../../utils/adminHelpers'
import { transformPublications } from '../../utils/transformPublication'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event): Promise<PaginatedResponse<Publication>> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  // Parse pagination (use defaults suitable for public API)
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(50, Math.max(1, Number(query.perPage) || 10))
  const offset = (page - 1) * perPage

  // Build where conditions - only published, non-deleted publications
  const conditions = [
    eq(schema.publications.isPublished, true),
    isNull(schema.publications.deletedAt)
  ]

  // Filter by type
  if (query.type && typeof query.type === 'string') {
    const validTypes: PublicationType[] = [
      'press-statement',
      'bulletin',
      'guideline',
      'manual',
      'strategy',
      'law'
    ]
    if (validTypes.includes(query.type as PublicationType)) {
      conditions.push(eq(schema.publications.type, query.type as PublicationType))
    }
  }

  const whereClause = and(...conditions)

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.publications)
    .where(whereClause)

  // Fetch publications
  const publications = await db
    .select()
    .from(schema.publications)
    .where(whereClause)
    .orderBy(desc(schema.publications.publishedAt))
    .limit(perPage)
    .offset(offset)

  // Fetch translations for each publication
  const publicationIds = publications.map((p) => p.id)
  const translations =
    publicationIds.length > 0
      ? await db
          .select()
          .from(schema.publicationTranslations)
          .where(
            sql`${schema.publicationTranslations.publicationId} IN (${sql.join(publicationIds, sql`, `)})`
          )
      : []

  // Group translations by publication
  const translationsByPublication = translations.reduce(
    (acc, t) => {
      if (!acc[t.publicationId]) {
        acc[t.publicationId] = {}
      }
      acc[t.publicationId][t.locale] = {
        title: t.title,
        excerpt: t.excerpt,
        content: t.content
      }
      return acc
    },
    {} as Record<
      number,
      Record<string, { title: string; excerpt: string | null; content: string | null }>
    >
  )

  // Combine publications with translations
  const publicationsWithTranslations = publications.map((publication) => ({
    ...publication,
    translations: translationsByPublication[publication.id] || {}
  }))

  // Apply search filter (after combining with translations for title/excerpt search)
  let filteredPublications = publicationsWithTranslations
  if (query.search && typeof query.search === 'string') {
    const searchTerm = query.search.toLowerCase()
    filteredPublications = publicationsWithTranslations.filter((p) => {
      const translation = p.translations[locale] || p.translations.en || {}
      const title = (translation.title || '').toLowerCase()
      const excerpt = (translation.excerpt || '').toLowerCase()
      return title.includes(searchTerm) || excerpt.includes(searchTerm)
    })
  }

  // Transform to public format
  const data = transformPublications(filteredPublications, locale)

  // Adjust count for search filter
  const total = query.search ? filteredPublications.length : Number(count)

  return {
    data,
    meta: buildPaginationMeta(total, page, perPage)
  }
})
