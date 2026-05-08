import type { Event } from '~/types'

type SupportedLocale = 'en' | 'ak'

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

interface DbEvent {
  id: number
  slug: string
  startDate: Date | string
  endDate: Date | string | null
  isVirtual: boolean
  registrationUrl: string | null
  thumbnail: string | null
  isPublished: boolean
}

interface EventWithTranslations extends DbEvent {
  translations: Record<string, { title: string; description: string; location: string | null }>
}

function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

export function transformEvent(
  event: EventWithTranslations,
  locale: SupportedLocale = 'en'
): Event {
  const translation = event.translations[locale] ||
    event.translations.en || {
      title: 'Untitled Event',
      description: '',
      location: null
    }

  return {
    id: String(event.id),
    title: translation.title,
    slug: event.slug,
    description: stripHtml(translation.description),
    startDate: formatDate(event.startDate),
    endDate: event.endDate ? formatDate(event.endDate) : undefined,
    location: translation.location || undefined,
    isVirtual: event.isVirtual || undefined,
    registrationUrl: event.registrationUrl || undefined,
    thumbnail: event.thumbnail || undefined
  }
}

export function transformEvents(
  events: EventWithTranslations[],
  locale: SupportedLocale = 'en'
): Event[] {
  return events.map((event) => transformEvent(event, locale))
}
