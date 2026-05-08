import type { GalleryImage } from '~/types'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { transformGalleryImages } from '../utils/transformGallery'
import { getLocaleFromRequest } from '../utils/locale'

export default defineEventHandler(async (event): Promise<{ images: GalleryImage[]; categories: string[] }> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  const conditions = [isNull(schema.galleryImages.deletedAt)]

  if (query.category && typeof query.category === 'string') {
    conditions.push(eq(schema.galleryImages.category, query.category))
  }

  const images = await db
    .select()
    .from(schema.galleryImages)
    .where(and(...conditions))
    .orderBy(desc(schema.galleryImages.uploadedAt))

  const imageIds = images.map((img) => img.id)
  const translations =
    imageIds.length > 0
      ? await db
          .select()
          .from(schema.galleryImageTranslations)
          .where(
            sql`${schema.galleryImageTranslations.imageId} IN (${sql.join(imageIds, sql`, `)})`
          )
      : []

  const translationsByImage = translations.reduce(
    (acc, t) => {
      if (!acc[t.imageId]) acc[t.imageId] = {}
      acc[t.imageId][t.locale] = {
        alt: t.alt,
        caption: t.caption
      }
      return acc
    },
    {} as Record<number, Record<string, { alt: string; caption: string | null }>>
  )

  // Get album titles for images that belong to albums
  const albumIds = [...new Set(images.filter((img) => img.albumId).map((img) => img.albumId!))]
  const albumTranslations =
    albumIds.length > 0
      ? await db
          .select()
          .from(schema.galleryAlbumTranslations)
          .where(
            sql`${schema.galleryAlbumTranslations.albumId} IN (${sql.join(albumIds, sql`, `)})`
          )
      : []

  const albumTitleByAlbumId = albumTranslations.reduce(
    (acc, t) => {
      if (t.locale === locale || (!acc[t.albumId] && t.locale === 'en')) {
        acc[t.albumId] = t.title
      }
      return acc
    },
    {} as Record<number, string>
  )

  const imagesWithData = images.map((img) => ({
    ...img,
    translations: translationsByImage[img.id] || {},
    albumTitle: img.albumId ? albumTitleByAlbumId[img.albumId] : undefined
  }))

  const transformed = transformGalleryImages(imagesWithData, locale)

  // Filter by album title (category) if requested and the image has no direct category
  let filtered = transformed
  if (query.category && typeof query.category === 'string') {
    filtered = transformed.filter((img) => img.category === query.category)
  }

  const allCategories = [...new Set(transformed.map((img) => img.category).filter(Boolean))] as string[]

  return {
    images: filtered,
    categories: allCategories
  }
})
