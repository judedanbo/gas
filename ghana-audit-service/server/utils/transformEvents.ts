import type { Event } from '~/types'
import { htmlToPlainText } from '~/utils/htmlToPlainText'

type SupportedLocale = 'en' | 'ak'

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

interface EventImageData {
  url: string
  alt: string
  caption?: string
}

interface EventWithTranslations extends DbEvent {
  translations: Record<string, { title: string; description: string; location: string | null }>
  images?: EventImageData[]
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
    description: htmlToPlainText(translation.description),
    startDate: formatDate(event.startDate),
    endDate: event.endDate ? formatDate(event.endDate) : undefined,
    location: translation.location || undefined,
    isVirtual: event.isVirtual || undefined,
    registrationUrl: event.registrationUrl || undefined,
    thumbnail: event.thumbnail || undefined
  }
}

export function transformEventDetail(
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
    description: htmlToPlainText(translation.description),
    content: translation.description,
    startDate: formatDate(event.startDate),
    endDate: event.endDate ? formatDate(event.endDate) : undefined,
    location: translation.location || undefined,
    isVirtual: event.isVirtual || undefined,
    registrationUrl: event.registrationUrl || undefined,
    thumbnail: event.thumbnail || undefined,
    images: event.images?.length ? event.images : undefined
  }
}

export function transformEvents(
  events: EventWithTranslations[],
  locale: SupportedLocale = 'en'
): Event[] {
  return events.map((event) => transformEvent(event, locale))
}
