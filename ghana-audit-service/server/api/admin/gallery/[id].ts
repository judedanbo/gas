import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { galleryImageSchema, validateBody } from '../../../utils/validation'

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

  const conditions = [eq(schema.galleryImages.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.galleryImages.deletedAt))

  const [image] = await db
    .select()
    .from(schema.galleryImages)
    .where(and(...conditions))
    .limit(1)

  if (!image)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Image not found' })

  const translations = await db
    .select()
    .from(schema.galleryImageTranslations)
    .where(eq(schema.galleryImageTranslations.imageId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { alt: t.alt, caption: t.caption }
      return acc
    },
    {} as Record<string, { alt: string | null; caption: string | null }>
  )

  return { ...image, translations: translationsMap }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.galleryImages)
    .where(and(eq(schema.galleryImages.id, id), isNull(schema.galleryImages.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Image not found' })

  const existingTranslations = await db
    .select()
    .from(schema.galleryImageTranslations)
    .where(eq(schema.galleryImageTranslations.imageId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, alt: t.alt, caption: t.caption }
      return acc
    },
    {} as Record<string, { id: number; alt: string | null; caption: string | null }>
  )

  const input = validateBody(galleryImageSchema, body)
  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(`UPDATE gallery_images SET url = ?, category = ? WHERE id = ?`, [
      input.url,
      input.category || null,
      id
    ])

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE gallery_image_translations SET alt = ?, caption = ? WHERE id = ?`,
            [trans.alt || null, trans.caption || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO gallery_image_translations (image_id, locale, alt, caption) VALUES (?, ?, ?, ?)`,
            [id, locale, trans.alt || null, trans.caption || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db
      .select()
      .from(schema.galleryImages)
      .where(eq(schema.galleryImages.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.galleryImageTranslations)
      .where(eq(schema.galleryImageTranslations.imageId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { alt: t.alt, caption: t.caption }
        return acc
      },
      {} as Record<string, { alt: string | null; caption: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'gallery_image',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return { ...updated, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.galleryImages)
    .where(and(eq(schema.galleryImages.id, id), isNull(schema.galleryImages.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Image not found' })

  await db
    .update(schema.galleryImages)
    .set({ deletedAt: new Date() })
    .where(eq(schema.galleryImages.id, id))

  await logAuditAction(event, 'delete', 'gallery_image', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Image deleted successfully' }
}
