import type { CarouselItemType } from '~/types/admin'

/** Copy shared by /admin/carousel and its dialogs (English-only, like the rest of the admin). */
export const CAROUSEL_TYPE_LABELS: Record<CarouselItemType, string> = {
  news: 'News',
  event: 'Event',
  report: 'A-G Report',
  gallery: 'Photo gallery'
}

/** '2026-12-24' → '24 Dec 2026' */
export function formatCarouselDate(date: string | null): string {
  if (!date) return ''
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/** Today as YYYY-MM-DD (UTC — Ghana is on GMT all year). */
export function carouselToday(): string {
  return new Date().toISOString().slice(0, 10)
}
