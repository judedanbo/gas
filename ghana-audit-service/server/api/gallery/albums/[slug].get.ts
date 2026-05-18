import { and, isNull, eq, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { transformGalleryImages } from '../../../utils/transformGallery'
import { getLocaleFromRequest } from '../../../utils/locale'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  const [album] = await db
    .select()
    .from(schema.galleryAlbums)
    .where(
      and(
        eq(schema.galleryAlbums.slug, slug),
        eq(schema.galleryAlbums.isPublished, true),
        isNull(schema.galleryAlbums.deletedAt)
      )
    )
    .limit(1)

  if (!album) throw createError({ statusCode: 404, statusMessage: 'Album not found' })

  const albumTranslations = await db
    .select()
    .from(schema.galleryAlbumTranslations)
    .where(eq(schema.galleryAlbumTranslations.albumId, album.id))

  const translationMap = albumTranslations.reduce<
    Record<string, { title: string; description: string | null }>
  >((acc, t) => {
    acc[t.locale] = { title: t.title, description: t.description }
    return acc
  }, {})

  const t = translationMap[locale] || translationMap.en || { title: '', description: null }

  const images = await db
    .select()
    .from(schema.galleryImages)
    .where(
      and(
        eq(schema.galleryImages.albumId, album.id),
        isNull(schema.galleryImages.deletedAt)
      )
    )
    .orderBy(desc(schema.galleryImages.uploadedAt))

  const imageIds = images.map((img) => img.id)
  const imageTranslations =
    imageIds.length > 0
      ? await db
          .select()
          .from(schema.galleryImageTranslations)
          .where(sql`${schema.galleryImageTranslations.imageId} IN (${sql.join(imageIds, sql`, `)})`)
      : []

  const translationsByImage = imageTranslations.reduce<
    Record<number, Record<string, { alt: string; caption: string | null }>>
  >((acc, row) => {
    if (!acc[row.imageId]) acc[row.imageId] = {}
    acc[row.imageId][row.locale] = { alt: row.alt, caption: row.caption }
    return acc
  }, {})

  const imagesWithData = images.map((img) => ({
    ...img,
    translations: translationsByImage[img.id] || {},
    albumTitle: t.title
  }))

  return {
    album: {
      slug: album.slug,
      title: t.title,
      description: t.description || undefined,
      imageCount: images.length,
      publishedAt: album.publishedAt
    },
    images: transformGalleryImages(imagesWithData, locale)
  }
})
