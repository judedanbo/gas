import type { GalleryImage } from '~/types'

type SupportedLocale = 'en' | 'ak'

interface DbGalleryImage {
  id: number
  url: string
  category: string | null
  albumId: number | null
  uploadedAt: Date | string
}

interface GalleryImageWithTranslations extends DbGalleryImage {
  translations: Record<string, { alt: string; caption: string | null }>
  albumTitle?: string
}

interface DbGalleryAlbum {
  id: number
  slug: string
  coverImageId: number | null
  publishedAt: Date | string
  isPublished: boolean
  createdBy: number | null
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

interface AlbumTranslationRow {
  title: string
  description: string | null
}

function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString()
}

export function transformGalleryImage(
  image: GalleryImageWithTranslations,
  locale: SupportedLocale = 'en'
): GalleryImage {
  const translation = image.translations[locale] ||
    image.translations.en || {
      alt: '',
      caption: null
    }

  return {
    id: String(image.id),
    url: image.url,
    alt: translation.alt,
    caption: translation.caption || undefined,
    category: image.albumTitle || image.category || undefined,
    uploadedAt: formatDate(image.uploadedAt)
  }
}

export function transformGalleryImages(
  images: GalleryImageWithTranslations[],
  locale: SupportedLocale = 'en'
): GalleryImage[] {
  return images.map((image) => transformGalleryImage(image, locale))
}

/**
 * Transform a gallery album (admin DTO) — embeds preview image URLs and
 * a per-album count so the album card can render without an extra fetch.
 */
export function transformGalleryAlbum(
  album: DbGalleryAlbum,
  translations: Record<string, AlbumTranslationRow>,
  previewImages: string[],
  imageCount: number
) {
  return {
    id: album.id,
    slug: album.slug,
    coverImageId: album.coverImageId,
    publishedAt: formatDateTime(album.publishedAt),
    isPublished: Boolean(album.isPublished),
    imageCount,
    previewImages,
    createdBy: album.createdBy,
    createdAt: formatDateTime(album.createdAt),
    updatedAt: formatDateTime(album.updatedAt),
    deletedAt: album.deletedAt ? formatDateTime(album.deletedAt) : null,
    translations
  }
}
