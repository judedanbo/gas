import { eq, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import {
  galleryBulkImageSchema,
  validateBody,
  createValidationError
} from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)
  const input = validateBody(galleryBulkImageSchema, body)
  const db = getDatabase()

  // Verify destination album exists (unless null/Unassigned)
  if (input.albumId != null) {
    const [album] = await db
      .select({ id: schema.galleryAlbums.id })
      .from(schema.galleryAlbums)
      .where(eq(schema.galleryAlbums.id, input.albumId))
      .limit(1)
    if (!album) {
      throw createValidationError({ albumId: 'Album not found' })
    }
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  const createdIds: number[] = []

  try {
    await connection.beginTransaction()

    for (const img of input.images) {
      const [result] = await connection.execute(
        `INSERT INTO gallery_images (url, album_id, created_by) VALUES (?, ?, ?)`,
        [img.url, input.albumId ?? null, user.id]
      )
      const imageId = (result as { insertId: number }).insertId
      createdIds.push(imageId)

      for (const [locale, trans] of Object.entries(img.translations)) {
        if (trans && (trans.alt || trans.caption)) {
          await connection.execute(
            `INSERT INTO gallery_image_translations (image_id, locale, alt, caption) VALUES (?, ?, ?, ?)`,
            [imageId, locale, trans.alt || null, trans.caption || null]
          )
        }
      }
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:gallery', error)
  } finally {
    connection.release()
  }

  const images = await db
    .select()
    .from(schema.galleryImages)
    .where(inArray(schema.galleryImages.id, createdIds))

  const translations = await db
    .select()
    .from(schema.galleryImageTranslations)
    .where(inArray(schema.galleryImageTranslations.imageId, createdIds))

  const translationsByImage = translations.reduce<
    Record<number, Record<string, { alt: string | null; caption: string | null }>>
  >((acc, t) => {
    if (!acc[t.imageId]) acc[t.imageId] = {}
    acc[t.imageId][t.locale] = { alt: t.alt, caption: t.caption }
    return acc
  }, {})

  const data = images.map((i) => ({ ...i, translations: translationsByImage[i.id] || {} }))

  await logAuditAction(event, 'create', 'gallery_image_bulk', null, {
    after: sanitizeForAudit({
      albumId: input.albumId,
      count: createdIds.length,
      ids: createdIds
    })
  })

  return { data, count: createdIds.length }
})
