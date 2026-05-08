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

function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
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
