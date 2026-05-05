import type { Tender } from '~/types'

type SupportedLocale = 'en' | 'ak'
type TenderStatus = 'open' | 'closed' | 'awarded' | 'cancelled'

interface DbTender {
  id: number
  slug: string
  referenceNumber: string
  category: string
  submissionDeadline: Date | string
  openingDate: Date | string | null
  documentUrl: string | null
  publishedAt: Date | string
  status: TenderStatus
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

interface TenderWithTranslations extends DbTender {
  translations: Record<string, { title: string; description: string }>
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
 * Format datetime for API response
 */
function formatDateTime(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString()
}

/**
 * Transform a database tender to public API format
 */
export function transformTender(
  tender: TenderWithTranslations,
  locale: SupportedLocale = 'en'
): Tender {
  // Get translation for requested locale, fallback to English
  const translation = tender.translations[locale] ||
    tender.translations.en || {
      title: 'Untitled Tender',
      description: ''
    }

  // Map cancelled to closed for public API (public type doesn't have cancelled)
  const publicStatus = tender.status === 'cancelled' ? 'closed' : tender.status

  return {
    id: String(tender.id),
    title: translation.title,
    slug: tender.slug,
    referenceNumber: tender.referenceNumber,
    description: translation.description,
    category: tender.category,
    submissionDeadline: formatDateTime(tender.submissionDeadline),
    openingDate: tender.openingDate ? formatDateTime(tender.openingDate) : undefined,
    documentUrl: tender.documentUrl || undefined,
    publishedAt: formatDate(tender.publishedAt),
    status: publicStatus as 'open' | 'closed' | 'awarded'
  }
}

/**
 * Transform an array of database tenders to public API format
 */
export function transformTenders(
  tenders: TenderWithTranslations[],
  locale: SupportedLocale = 'en'
): Tender[] {
  return tenders.map((tender) => transformTender(tender, locale))
}
