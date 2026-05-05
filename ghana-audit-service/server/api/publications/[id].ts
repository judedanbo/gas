import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { transformPublication } from '../../utils/transformPublication'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Publication ID or slug is required'
    })
  }

  // Determine if id is numeric (database ID) or string (slug)
  const isNumericId = /^\d+$/.test(id)

  // Build where conditions
  const idCondition = isNumericId
    ? eq(schema.publications.id, Number(id))
    : eq(schema.publications.slug, id)

  const whereClause = and(
    idCondition,
    eq(schema.publications.isPublished, true),
    isNull(schema.publications.deletedAt)
  )

  // Fetch publication
  const [publication] = await db.select().from(schema.publications).where(whereClause).limit(1)

  if (!publication) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Publication not found'
    })
  }

  // Fetch translations for the publication
  const translations = await db
    .select()
    .from(schema.publicationTranslations)
    .where(eq(schema.publicationTranslations.publicationId, publication.id))

  // Group translations by locale
  const translationsByLocale = translations.reduce(
    (acc, t) => {
      acc[t.locale] = {
        title: t.title,
        excerpt: t.excerpt,
        content: t.content
      }
      return acc
    },
    {} as Record<string, { title: string; excerpt: string | null; content: string | null }>
  )

  // Combine publication with translations
  const publicationWithTranslations = {
    ...publication,
    translations: translationsByLocale
  }

  // Transform to public format
  return transformPublication(publicationWithTranslations, locale)
})
