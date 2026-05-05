import type { Vacancy } from '~/types'

type SupportedLocale = 'en' | 'ak'
type VacancyType = 'full-time' | 'part-time' | 'contract'

interface DbVacancy {
  id: number
  slug: string
  departmentId: number | null
  location: string
  type: VacancyType
  deadline: Date | string
  publishedAt: Date | string
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

interface VacancyWithData extends DbVacancy {
  translations: Record<string, { title: string; description: string }>
  requirements: Array<{
    displayOrder: number
    translations: Record<string, { description: string }>
  }>
  departmentName?: string
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
 * Transform a database vacancy to public API format
 */
export function transformVacancy(
  vacancy: VacancyWithData,
  locale: SupportedLocale = 'en'
): Vacancy {
  // Get translation for requested locale, fallback to English
  const translation = vacancy.translations[locale] ||
    vacancy.translations.en || {
      title: 'Untitled Vacancy',
      description: ''
    }

  // Transform requirements with locale fallback
  const requirements = vacancy.requirements
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((req) => {
      const reqTranslation = req.translations[locale] || req.translations.en || { description: '' }
      return reqTranslation.description
    })
    .filter((desc) => desc.length > 0)

  return {
    id: String(vacancy.id),
    title: translation.title,
    slug: vacancy.slug,
    department: vacancy.departmentName || 'General',
    location: vacancy.location,
    type: vacancy.type,
    description: translation.description,
    requirements,
    deadline: formatDate(vacancy.deadline),
    publishedAt: formatDate(vacancy.publishedAt),
    isActive: vacancy.isActive
  }
}

/**
 * Transform an array of database vacancies to public API format
 */
export function transformVacancies(
  vacancies: VacancyWithData[],
  locale: SupportedLocale = 'en'
): Vacancy[] {
  return vacancies.map((vacancy) => transformVacancy(vacancy, locale))
}
