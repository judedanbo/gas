import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { transformEventDetail } from '../../utils/transformEvents'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Event slug is required'
    })
  }

  const isNumericId = /^\d+$/.test(slug)

  const idCondition = isNumericId
    ? eq(schema.events.id, Number(slug))
    : eq(schema.events.slug, slug)

  const whereClause = and(
    idCondition,
    eq(schema.events.isPublished, true),
    isNull(schema.events.deletedAt)
  )

  const [dbEvent] = await db.select().from(schema.events).where(whereClause).limit(1)

  if (!dbEvent) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Event not found'
    })
  }

  const translations = await db
    .select()
    .from(schema.eventTranslations)
    .where(eq(schema.eventTranslations.eventId, dbEvent.id))

  const eventImages = await db
    .select()
    .from(schema.eventImages)
    .where(eq(schema.eventImages.eventId, dbEvent.id))
    .orderBy(schema.eventImages.sortOrder)

  const translationsByLocale = translations.reduce(
    (acc, t) => {
      acc[t.locale] = {
        title: t.title,
        description: t.description,
        location: t.location
      }
      return acc
    },
    {} as Record<string, { title: string; description: string; location: string | null }>
  )

  const eventWithData = {
    ...dbEvent,
    translations: translationsByLocale,
    images: eventImages.map((img) => ({
      url: img.url,
      alt: img.alt,
      caption: img.caption || undefined
    }))
  }

  return transformEventDetail(eventWithData, locale)
})
