import type { AuditReport, AuditCategory } from '~/types'
import type { SupportedLocale } from './locale'

interface DbAuditReport {
  id: number
  slug: string
  category: AuditCategory
  publishedAt: Date | string | null
  year: number
  fileUrl: string
  fileSize: string // Already stored as formatted string (e.g., "4.2 MB")
  thumbnail: string | null
  isPublished: boolean
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

interface ReportWithTranslations extends DbAuditReport {
  translations: Record<string, { title: string; summary: string | null }>
}

/**
 * Format file size to human-readable string
 * Handles both numeric strings (bytes) and pre-formatted strings
 */
function formatFileSize(size: string | null): string {
  if (!size) return 'N/A'

  // Check if it's already formatted (contains non-numeric characters except decimal point)
  if (/[a-zA-Z]/.test(size)) {
    return size
  }

  // Parse as bytes and format
  const bytes = parseFloat(size)
  if (isNaN(bytes) || bytes === 0) return 'N/A'

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
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
 * Transform a database report to public API format
 */
export function transformReport(
  report: ReportWithTranslations,
  locale: SupportedLocale = 'en'
): AuditReport {
  // Get translation for requested locale, fallback to English
  const translation = report.translations[locale] ||
    report.translations.en || {
      title: 'Untitled Report',
      summary: null
    }

  return {
    id: String(report.id),
    title: translation.title,
    slug: report.slug,
    category: report.category,
    publishedAt: formatDate(report.publishedAt),
    year: report.year,
    // Route downloads through the rate-limited endpoint so direct uploads/
    // bandwidth is metered. Direct /uploads/reports/*.pdf access is blocked
    // by server/middleware/rateLimit.ts.
    fileUrl: `/api/downloads/reports/${report.id}`,
    fileSize: formatFileSize(report.fileSize),
    summary: translation.summary || undefined,
    thumbnail: report.thumbnail || undefined
  }
}

/**
 * Transform an array of database reports to public API format
 */
export function transformReports(
  reports: ReportWithTranslations[],
  locale: SupportedLocale = 'en'
): AuditReport[] {
  return reports.map((report) => transformReport(report, locale))
}
