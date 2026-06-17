import type { H3Event } from 'h3'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { eventSchema, validateBody, createValidationError } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleList(event)
  if (method === 'POST') return handleCreate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()

  const conditions = []

  if (query.includeDeleted !== 'true') {
    conditions.push(isNull(schema.events.deletedAt))
  }

  if (query.isPublished === 'true') {
    conditions.push(eq(schema.events.isPublished, true))
  } else if (query.isPublished === 'false') {
    conditions.push(eq(schema.events.isPublished, false))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.events)
    .where(whereClause)

  const events = await db
    .select()
    .from(schema.events)
    .where(whereClause)
    .orderBy(desc(schema.events.startDate))
    .limit(perPage)
    .offset(offset)

  const eventIds = events.map((e) => e.id)
  const translations =
    eventIds.length > 0
      ? await db
          .select()
          .from(schema.eventTranslations)
          .where(sql`${schema.eventTranslations.eventId} IN (${sql.join(eventIds, sql`, `)})`)
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
    {} as Record<
      number,
      Record<string, { title: string; description: string | null; location: string | null }>
    >
  )

  const data = events.map((evt) => ({
    ...evt,
    translations: translationsByEvent[evt.id] || {}
  }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)

  const input = validateBody(eventSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'An event with this slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO events (slug, start_date, end_date, is_virtual, registration_url, thumbnail, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        new Date(input.startDate),
        input.endDate ? new Date(input.endDate) : null,
        input.isVirtual,
        input.registrationUrl || null,
        input.thumbnail || null,
        input.isPublished,
        user.id
      ]
    )

    const eventId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO event_translations (event_id, locale, title, description, location)
           VALUES (?, ?, ?, ?, ?)`,
          [eventId, locale, trans.title, trans.description || null, trans.location || null]
        )
      }
    }

    await connection.commit()

    const [evt] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.eventTranslations)
      .where(eq(schema.eventTranslations.eventId, eventId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, description: t.description, location: t.location }
        return acc
      },
      {} as Record<string, { title: string; description: string | null; location: string | null }>
    )

    await logAuditAction(event, 'create', 'event', eventId, {
      after: sanitizeForAudit({ ...evt, translations: translationsMap })
    })

    return { ...evt, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:events', error)
  } finally {
    connection.release()
  }
}
