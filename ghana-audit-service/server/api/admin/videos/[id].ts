import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { videoSchema, validateBody } from '../../../utils/validation'
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

  const conditions = [eq(schema.videos.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.videos.deletedAt))

  const [video] = await db
    .select()
    .from(schema.videos)
    .where(and(...conditions))
    .limit(1)

  if (!video)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Video not found' })

  const translations = await db
    .select()
    .from(schema.videoTranslations)
    .where(eq(schema.videoTranslations.videoId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { title: t.title, description: t.description }
      return acc
    },
    {} as Record<string, { title: string; description: string | null }>
  )

  return { ...video, translations: translationsMap }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.videos)
    .where(and(eq(schema.videos.id, id), isNull(schema.videos.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Video not found' })

  const existingTranslations = await db
    .select()
    .from(schema.videoTranslations)
    .where(eq(schema.videoTranslations.videoId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, title: t.title, description: t.description }
      return acc
    },
    {} as Record<string, { id: number; title: string; description: string | null }>
  )

  const input = validateBody(videoSchema, body)
  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE videos SET url = ?, thumbnail = ?, duration = ?, published_at = ?, is_published = ? WHERE id = ?`,
      [
        input.url,
        input.thumbnail || null,
        input.duration || null,
        new Date(input.publishedAt),
        input.isPublished,
        id
      ]
    )

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE video_translations SET title = ?, description = ? WHERE id = ?`,
            [trans.title, trans.description || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO video_translations (video_id, locale, title, description) VALUES (?, ?, ?, ?)`,
            [id, locale, trans.title, trans.description || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db.select().from(schema.videos).where(eq(schema.videos.id, id)).limit(1)

    const translations = await db
      .select()
      .from(schema.videoTranslations)
      .where(eq(schema.videoTranslations.videoId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, description: t.description }
        return acc
      },
      {} as Record<string, { title: string; description: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'video',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return { ...updated, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:videos', error)
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.videos)
    .where(and(eq(schema.videos.id, id), isNull(schema.videos.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Video not found' })

  await db.update(schema.videos).set({ deletedAt: new Date() }).where(eq(schema.videos.id, id))

  await logAuditAction(event, 'delete', 'video', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Video deleted successfully' }
}
