import { and, isNull, eq, sql, desc, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { transformGalleryAlbumPublic } from '../../../utils/transformGallery'
import { getLocaleFromRequest } from '../../../utils/locale'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(20, Math.max(1, Number(query.perPage) || 3))
  const offset = (page - 1) * perPage

  const baseConditions = and(
    isNull(schema.galleryAlbums.deletedAt),
    eq(schema.galleryAlbums.isPublished, true)
  )

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.galleryAlbums)
    .where(baseConditions)

  const total = Number(count)

  const albums = await db
    .select()
    .from(schema.galleryAlbums)
    .where(baseConditions)
    .orderBy(desc(schema.galleryAlbums.publishedAt))
    .limit(perPage)
    .offset(offset)

  if (albums.length === 0) {
    return {
      data: [],
      meta: { total, page, perPage, lastPage: Math.ceil(total / perPage) || 1 }
    }
  }

  const albumIds = albums.map((a) => a.id)

  const translations = await db
    .select()
    .from(schema.galleryAlbumTranslations)
    .where(inArray(schema.galleryAlbumTranslations.albumId, albumIds))

  const translationsByAlbum = translations.reduce<
    Record<number, Record<string, { title: string; description: string | null }>>
  >((acc, t) => {
    if (!acc[t.albumId]) acc[t.albumId] = {}
    acc[t.albumId][t.locale] = { title: t.title, description: t.description }
    return acc
  }, {})

  const previewRows = await db
    .select({
      albumId: schema.galleryImages.albumId,
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

  const previewsByAlbum = previewRows.reduce<Record<number, string[]>>((acc, row) => {
    if (row.albumId == null) return acc
    if (!acc[row.albumId]) acc[row.albumId] = []
    if (acc[row.albumId].length < 7) acc[row.albumId].push(row.url)
    return acc
  }, {})

  const countRows = await db
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

  const countsByAlbum = countRows.reduce<Record<number, number>>((acc, row) => {
    if (row.albumId != null) acc[row.albumId] = Number(row.count)
    return acc
  }, {})

  const data = albums.map((album) =>
    transformGalleryAlbumPublic(
      {
        id: album.id,
        slug: album.slug,
        publishedAt: album.publishedAt,
        translations: translationsByAlbum[album.id] || {},
        imageCount: countsByAlbum[album.id] || 0,
        previewImages: previewsByAlbum[album.id] || []
      },
      locale
    )
  )

  return {
    data,
    meta: { total, page, perPage, lastPage: Math.ceil(total / perPage) || 1 }
  }
})
