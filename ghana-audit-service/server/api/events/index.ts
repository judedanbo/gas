import type { Event } from '~/types'
import { eq, and, isNull, sql, desc, asc, gte, lt } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { transformEvents } from '../../utils/transformEvents'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event): Promise<Event[]> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()
  const now = new Date()

  const conditions = [
    eq(schema.events.isPublished, true),
    isNull(schema.events.deletedAt)
  ]

  if (query.filter === 'upcoming') {
    conditions.push(gte(schema.events.startDate, now))
  } else if (query.filter === 'past') {
    conditions.push(lt(schema.events.startDate, now))
  }

  const whereClause = and(...conditions)

  const orderDir = query.filter === 'past' ? desc(schema.events.startDate) : asc(schema.events.startDate)

  const dbEvents = await db
    .select()
    .from(schema.events)
    .where(whereClause)
    .orderBy(orderDir)

  const eventIds = dbEvents.map((e) => e.id)
  const translations =
    eventIds.length > 0
      ? await db
          .select()
          .from(schema.eventTranslations)
          .where(
            sql`${schema.eventTranslations.eventId} IN (${sql.join(eventIds, sql`, `)})`
          )
      : []

  const translationsByEvent = translations.reduce(
    (acc, t) => {
      if (!acc[t.eventId]) acc[t.eventId] = {}
      acc[t.eventId][t.locale] = {
        title: t.title,
        description: t.description,
        location: t.location
      }
      return acc
    },
    {} as Record<number, Record<string, { title: string; description: string; location: string | null }>>
  )

  const eventsWithData = dbEvents.map((e) => ({
    ...e,
    translations: translationsByEvent[e.id] || {}
  }))

  return transformEvents(eventsWithData, locale)
})
