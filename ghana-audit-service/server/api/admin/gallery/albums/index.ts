import type { H3Event } from 'h3'
import { eq, and, isNull, sql, desc, like, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../../utils/auditLogger'
import {
  galleryAlbumSchema,
  validateBody,
  createValidationError
} from '../../../../utils/validation'
import { transformGalleryAlbum } from '../../../../utils/transformGallery'
import { safeError } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleList(event)
  if (method === 'POST') return handleCreate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

type AlbumTranslations = Record<string, { title: string; description: string | null }>

const UNASSIGNED_LABELS: AlbumTranslations = {
  en: { title: 'Unassigned', description: null },
  ak: { title: 'Nea wɔnhyɛɛ no nkuw', description: null }
}

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const conditions = []
  if (query.includeDeleted !== 'true') conditions.push(isNull(schema.galleryAlbums.deletedAt))

  // Apply search via translations subquery
  let albumIdsFromSearch: number[] | null = null
  if (search) {
    const rows = await db
      .select({ albumId: schema.galleryAlbumTranslations.albumId })
      .from(schema.galleryAlbumTranslations)
      .where(like(schema.galleryAlbumTranslations.title, `%${search}%`))
    albumIdsFromSearch = Array.from(new Set(rows.map((r) => r.albumId)))
    if (albumIdsFromSearch.length === 0) {
      // No matches - short-circuit but still return empty meta
      return {
        data: [],
        meta: buildPaginationMeta(0, page, perPage)
      }
    }
    conditions.push(inArray(schema.galleryAlbums.id, albumIdsFromSearch))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.galleryAlbums)
    .where(whereClause)

  const albums = await db
    .select()
    .from(schema.galleryAlbums)
    .where(whereClause)
    .orderBy(desc(schema.galleryAlbums.publishedAt))
    .limit(perPage)
    .offset(offset)

  const albumIds = albums.map((a) => a.id)

  // Translations
  const translations =
    albumIds.length > 0
      ? await db
          .select()
          .from(schema.galleryAlbumTranslations)
          .where(inArray(schema.galleryAlbumTranslations.albumId, albumIds))
      : []

  const translationsByAlbum = translations.reduce<Record<number, AlbumTranslations>>((acc, t) => {
    if (!acc[t.albumId]) acc[t.albumId] = {}
    acc[t.albumId][t.locale] = { title: t.title, description: t.description }
    return acc
  }, {})

  // Preview images (latest non-deleted per album, fetched in one query, sliced in JS)
  const previewRows =
    albumIds.length > 0
      ? await db
          .select({
            albumId: schema.galleryImages.albumId,
            id: schema.galleryImages.id,
            url: schema.galleryImages.url
          })
          .from(schema.galleryImages)
          .where(
            and(
              inArray(schema.galleryImages.albumId, albumIds),
              isNull(schema.galleryImages.deletedAt)
            )
          )
          .orderBy(desc(schema.galleryImages.uploadedAt))
      : []

  const previewsByAlbum = previewRows.reduce<Record<number, { id: number; url: string }[]>>(
    (acc, row) => {
      if (row.albumId == null) return acc
      if (!acc[row.albumId]) acc[row.albumId] = []
      acc[row.albumId].push({ id: row.id, url: row.url })
      return acc
    },
    {}
  )

  // Per-album counts
  const countRows =
    albumIds.length > 0
      ? await db
          .select({
            albumId: schema.galleryImages.albumId,
            count: sql<number>`count(*)`
          })
          .from(schema.galleryImages)
          .where(
            and(
              inArray(schema.galleryImages.albumId, albumIds),
              isNull(schema.galleryImages.deletedAt)
            )
          )
          .groupBy(schema.galleryImages.albumId)
      : []

  const countsByAlbum = countRows.reduce<Record<number, number>>((acc, row) => {
    if (row.albumId != null) acc[row.albumId] = Number(row.count)
    return acc
  }, {})

  const data = albums.map((album) => {
    const albumTranslations = translationsByAlbum[album.id] || {}
    const previews = previewsByAlbum[album.id] || []
    const previewUrls: string[] = []
    if (album.coverImageId) {
      const cover = previews.find((p) => p.id === album.coverImageId)
      if (cover) previewUrls.push(cover.url)
    }
    for (const p of previews) {
      if (previewUrls.length >= 4) break
      if (!previewUrls.includes(p.url)) previewUrls.push(p.url)
    }
    return transformGalleryAlbum(
      album,
      albumTranslations,
      previewUrls,
      countsByAlbum[album.id] || 0
    )
  })

  // Prepend the synthetic "Unassigned" pseudo-album on the first page when no search
  if (page === 1 && !search) {
    const [unassignedCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.galleryImages)
      .where(and(isNull(schema.galleryImages.albumId), isNull(schema.galleryImages.deletedAt)))

    const unassignedCount = Number(unassignedCountRow?.count || 0)

    if (unassignedCount > 0) {
      const unassignedPreviews = await db
        .select({
          id: schema.galleryImages.id,
          url: schema.galleryImages.url
        })
        .from(schema.galleryImages)
        .where(and(isNull(schema.galleryImages.albumId), isNull(schema.galleryImages.deletedAt)))
        .orderBy(desc(schema.galleryImages.uploadedAt))
        .limit(4)

      data.unshift({
        id: 0,
        slug: '__unassigned__',
        coverImageId: null,
        publishedAt: '',
        isPublished: false,
        imageCount: unassignedCount,
        previewImages: unassignedPreviews.map((p) => p.url),
        createdBy: null,
        createdAt: '',
        updatedAt: '',
        deletedAt: null,
        translations: UNASSIGNED_LABELS
      })
    }
  }

  return {
    data,
    meta: buildPaginationMeta(Number(count), page, perPage)
  }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)
  const input = validateBody(galleryAlbumSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.galleryAlbums.id })
    .from(schema.galleryAlbums)
    .where(eq(schema.galleryAlbums.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'An album with this slug already exists' })
  }

  const pool = (await import('../../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO gallery_albums (slug, cover_image_id, published_at, is_published, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.coverImageId ?? null,
        new Date(input.publishedAt),
        input.isPublished,
        user.id
      ]
    )

    const albumId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO gallery_album_translations (album_id, locale, title, description)
           VALUES (?, ?, ?, ?)`,
          [albumId, locale, trans.title, trans.description || null]
        )
      }
    }

    await connection.commit()

    const [album] = await db
      .select()
      .from(schema.galleryAlbums)
      .where(eq(schema.galleryAlbums.id, albumId))
      .limit(1)

    const albumTranslations = await db
      .select()
      .from(schema.galleryAlbumTranslations)
      .where(eq(schema.galleryAlbumTranslations.albumId, albumId))

    const translationsMap = albumTranslations.reduce<AlbumTranslations>((acc, t) => {
      acc[t.locale] = { title: t.title, description: t.description }
      return acc
    }, {})

    await logAuditAction(event, 'create', 'gallery_album', albumId, {
      after: sanitizeForAudit({ ...album, translations: translationsMap })
    })

    return transformGalleryAlbum(album, translationsMap, [], 0)
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:gallery-albums', error)
  } finally {
    connection.release()
  }
}
