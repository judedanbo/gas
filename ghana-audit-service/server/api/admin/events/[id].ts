import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { eventSchema, validateBody, createValidationError } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })

  if (method === 'GET') return handleGet(event, id)
  if (method === 'PUT') return handleUpdate(event, id)
  if (method === 'DELETE') return handleDelete(event, id)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')
  const db = getDatabase()

  const conditions = [eq(schema.events.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.events.deletedAt))

  const [evt] = await db
    .select()
    .from(schema.events)
    .where(and(...conditions))
    .limit(1)

  if (!evt)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Event not found' })

  const translations = await db
    .select()
    .from(schema.eventTranslations)
    .where(eq(schema.eventTranslations.eventId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { title: t.title, description: t.description, location: t.location }
      return acc
    },
    {} as Record<string, { title: string; description: string | null; location: string | null }>
  )

  return { ...evt, translations: translationsMap }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  getCurrentUser(event) // Verify user is authenticated
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.id, id), isNull(schema.events.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Event not found' })

  const existingTranslations = await db
    .select()
    .from(schema.eventTranslations)
    .where(eq(schema.eventTranslations.eventId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, title: t.title, description: t.description, location: t.location }
      return acc
    },
    {} as Record<
      string,
      { id: number; title: string; description: string | null; location: string | null }
    >
  )

  const input = validateBody(eventSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.slug, input.slug))
      .limit(1)

    if (duplicate) throw createValidationError({ slug: 'An event with this slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE events SET slug = ?, start_date = ?, end_date = ?, is_virtual = ?, registration_url = ?, thumbnail = ?, is_published = ? WHERE id = ?`,
      [
        input.slug,
        new Date(input.startDate),
        input.endDate ? new Date(input.endDate) : null,
        input.isVirtual,
        input.registrationUrl || null,
        input.thumbnail || null,
        input.isPublished,
        id
      ]
    )

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE event_translations SET title = ?, description = ?, location = ? WHERE id = ?`,
            [trans.title, trans.description || null, trans.location || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO event_translations (event_id, locale, title, description, location) VALUES (?, ?, ?, ?, ?)`,
            [id, locale, trans.title, trans.description || null, trans.location || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1)

    const translations = await db
      .select()
      .from(schema.eventTranslations)
      .where(eq(schema.eventTranslations.eventId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, description: t.description, location: t.location }
        return acc
      },
      {} as Record<string, { title: string; description: string | null; location: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'event',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return { ...updated, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:events', error)
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.id, id), isNull(schema.events.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Event not found' })

  await db.update(schema.events).set({ deletedAt: new Date() }).where(eq(schema.events.id, id))

  await logAuditAction(event, 'delete', 'event', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Event deleted successfully' }
}
