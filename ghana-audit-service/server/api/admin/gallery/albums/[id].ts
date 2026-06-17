import type { H3Event } from 'h3'
import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'
import { requirePermission, isAdmin } from '../../../../utils/adminHelpers'
import {
  logAuditAction,
  createChangesObject,
  sanitizeForAudit
} from '../../../../utils/auditLogger'
import {
  galleryAlbumSchema,
  validateBody,
  createValidationError
} from '../../../../utils/validation'
import { transformGalleryAlbum } from '../../../../utils/transformGallery'
import { safeError } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })

  // Reject all writes against the Unassigned sentinel (id = 0)
  if (id === 0 && method !== 'GET') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'The Unassigned bucket is not editable'
    })
  }

  if (method === 'GET') return handleGet(event, id)
  if (method === 'PUT') return handleUpdate(event, id)
  if (method === 'DELETE') return handleDelete(event, id)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

type AlbumTranslations = Record<string, { title: string; description: string | null }>

async function loadAlbumWithDetails(id: number) {
  const db = getDatabase()
  const [album] = await db
    .select()
    .from(schema.galleryAlbums)
    .where(eq(schema.galleryAlbums.id, id))
    .limit(1)

  if (!album) return null

  const translations = await db
    .select()
    .from(schema.galleryAlbumTranslations)
    .where(eq(schema.galleryAlbumTranslations.albumId, id))

  const translationsMap = translations.reduce<AlbumTranslations>((acc, t) => {
    acc[t.locale] = { title: t.title, description: t.description }
    return acc
  }, {})

  const previewRows = await db
    .select({ id: schema.galleryImages.id, url: schema.galleryImages.url })
    .from(schema.galleryImages)
    .where(and(eq(schema.galleryImages.albumId, id), isNull(schema.galleryImages.deletedAt)))
    .orderBy(desc(schema.galleryImages.uploadedAt))

  const previewUrls: string[] = []
  if (album.coverImageId) {
    const cover = previewRows.find((p) => p.id === album.coverImageId)
    if (cover) previewUrls.push(cover.url)
  }
  for (const p of previewRows) {
    if (previewUrls.length >= 4) break
    if (!previewUrls.includes(p.url)) previewUrls.push(p.url)
  }

  return {
    album,
    translationsMap,
    previewUrls,
    imageCount: previewRows.length
  }
}

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')
  const db = getDatabase()

  const conditions = [eq(schema.galleryAlbums.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.galleryAlbums.deletedAt))

  const [album] = await db
    .select()
    .from(schema.galleryAlbums)
    .where(and(...conditions))
    .limit(1)

  if (!album)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Album not found' })

  const details = await loadAlbumWithDetails(id)
  if (!details)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Album not found' })

  return transformGalleryAlbum(
    details.album,
    details.translationsMap,
    details.previewUrls,
    details.imageCount
  )
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.galleryAlbums)
    .where(and(eq(schema.galleryAlbums.id, id), isNull(schema.galleryAlbums.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Album not found' })

  const existingTranslations = await db
    .select()
    .from(schema.galleryAlbumTranslations)
    .where(eq(schema.galleryAlbumTranslations.albumId, id))

  const existingTransMap = existingTranslations.reduce<
    Record<string, { id: number; title: string; description: string | null }>
  >((acc, t) => {
    acc[t.locale] = { id: t.id, title: t.title, description: t.description }
    return acc
  }, {})

  const input = validateBody(galleryAlbumSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.galleryAlbums.id })
      .from(schema.galleryAlbums)
      .where(eq(schema.galleryAlbums.slug, input.slug))
      .limit(1)

    if (duplicate) {
      throw createValidationError({ slug: 'An album with this slug already exists' })
    }
  }

  // Guard: cover image must belong to this album and not be soft-deleted
  if (input.coverImageId != null) {
    const [cover] = await db
      .select({ id: schema.galleryImages.id, albumId: schema.galleryImages.albumId })
      .from(schema.galleryImages)
      .where(
        and(eq(schema.galleryImages.id, input.coverImageId), isNull(schema.galleryImages.deletedAt))
      )
      .limit(1)
    if (!cover || cover.albumId !== id) {
      throw createValidationError({
        coverImageId: 'Cover image must belong to this album'
      })
    }
  }

  const pool = (await import('../../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE gallery_albums
         SET slug = ?, cover_image_id = ?, published_at = ?, is_published = ?
         WHERE id = ?`,
      [input.slug, input.coverImageId ?? null, new Date(input.publishedAt), input.isPublished, id]
    )

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE gallery_album_translations SET title = ?, description = ? WHERE id = ?`,
            [trans.title, trans.description || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO gallery_album_translations (album_id, locale, title, description) VALUES (?, ?, ?, ?)`,
            [id, locale, trans.title, trans.description || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db
      .select()
      .from(schema.galleryAlbums)
      .where(eq(schema.galleryAlbums.id, id))
      .limit(1)

    const updatedTranslations = await db
      .select()
      .from(schema.galleryAlbumTranslations)
      .where(eq(schema.galleryAlbumTranslations.albumId, id))

    const translationsMap = updatedTranslations.reduce<AlbumTranslations>((acc, t) => {
      acc[t.locale] = { title: t.title, description: t.description }
      return acc
    }, {})

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'gallery_album',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    const [{ count: imageCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.galleryImages)
      .where(and(eq(schema.galleryImages.albumId, id), isNull(schema.galleryImages.deletedAt)))

    const previewRows = await db
      .select({ id: schema.galleryImages.id, url: schema.galleryImages.url })
      .from(schema.galleryImages)
      .where(and(eq(schema.galleryImages.albumId, id), isNull(schema.galleryImages.deletedAt)))
      .orderBy(desc(schema.galleryImages.uploadedAt))
      .limit(8)

    const previewUrls: string[] = []
    if (updated.coverImageId) {
      const cover = previewRows.find((p) => p.id === updated.coverImageId)
      if (cover) previewUrls.push(cover.url)
    }
    for (const p of previewRows) {
      if (previewUrls.length >= 4) break
      if (!previewUrls.includes(p.url)) previewUrls.push(p.url)
    }

    return transformGalleryAlbum(updated, translationsMap, previewUrls, Number(imageCount))
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:gallery-albums', error)
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.galleryAlbums)
    .where(and(eq(schema.galleryAlbums.id, id), isNull(schema.galleryAlbums.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Album not found' })

  await db
    .update(schema.galleryAlbums)
    .set({ deletedAt: new Date() })
    .where(eq(schema.galleryAlbums.id, id))

  await logAuditAction(event, 'delete', 'gallery_album', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Album deleted successfully' }
}
