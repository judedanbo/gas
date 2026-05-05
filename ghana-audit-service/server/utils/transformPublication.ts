import type { Publication, PublicationType } from '~/types'

type SupportedLocale = 'en' | 'ak'

interface DbPublication {
  id: number
  slug: string
  type: PublicationType
  publishedAt: Date | string | null
  fileUrl: string | null
  thumbnail: string | null
  isPublished: boolean
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

interface PublicationWithTranslations extends DbPublication {
  translations: Record<string, { title: string; excerpt: string | null; content: string | null }>
}

/**
 * Format date to ISO string for API response
 */
function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

/**
 * Transform a database publication to public API format
 */
export function transformPublication(
  publication: PublicationWithTranslations,
  locale: SupportedLocale = 'en'
): Publication {
  // Get translation for requested locale, fallback to English
  const translation = publication.translations[locale] ||
    publication.translations.en || {
      title: 'Untitled Publication',
      excerpt: null,
      content: null
    }

  return {
    id: String(publication.id),
    title: translation.title,
    slug: publication.slug,
    type: publication.type,
    publishedAt: formatDate(publication.publishedAt),
    fileUrl: publication.fileUrl || undefined,
    content: translation.content || undefined,
    excerpt: translation.excerpt || undefined,
    thumbnail: publication.thumbnail || undefined
  }
}

/**
 * Transform an array of database publications to public API format
 */
export function transformPublications(
  publications: PublicationWithTranslations[],
  locale: SupportedLocale = 'en'
): Publication[] {
  return publications.map((publication) => transformPublication(publication, locale))
}
