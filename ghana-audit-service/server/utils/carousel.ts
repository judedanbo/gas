/**
 * Home page carousel rules — pure logic, no database access (see
 * carouselStore.ts for the queries and schema/carousel.ts for the model).
 *
 * The carousel is an automatic feed adjusted by per-item overrides:
 *  - automatic: the latest N news articles, the next N upcoming events and
 *    the latest N A-G reports (N per type comes from the settings);
 *  - 'pinned' items are shown on top of the automatic picks, so an item the
 *    admin keeps stays even after newer content would have replaced it;
 *  - 'hidden' items are left out of the automatic picks;
 *  - gallery albums are always pinned and carry their own photo selection.
 */

import type { HeroSlide } from '~/types'

export type CarouselItemType = 'news' | 'event' | 'report' | 'gallery'
export type CarouselItemMode = 'pinned' | 'hidden'

export interface CarouselSettings {
  newsCount: number
  eventsCount: number
  reportsCount: number
}

export interface CarouselItemConfig {
  type: CarouselItemType
  refId: number
  mode: CarouselItemMode
  /** Last day (UTC, YYYY-MM-DD) a pinned item is kept; null = until removed. */
  pinnedUntil: string | null
  /** Gallery only: how many of the album's photos become slides. */
  imageCount: number | null
  /** Gallery only: the photos chosen by the admin, in display order. */
  imageIds: number[]
}

export interface CarouselConfig {
  settings: CarouselSettings
  items: CarouselItemConfig[]
}

export const CAROUSEL_ITEM_TYPES: readonly CarouselItemType[] = [
  'news',
  'event',
  'report',
  'gallery'
]

export const MAX_AUTO_COUNT = 10
export const MAX_GALLERY_IMAGES = 10

/** What the home page showed before the carousel became configurable. */
export const DEFAULT_CAROUSEL_SETTINGS: CarouselSettings = {
  newsCount: 2,
  eventsCount: 2,
  reportsCount: 2
}

/**
 * The albums (and photo positions within each, by upload order) that were
 * hardcoded into the slideshow. They seed the default gallery entries.
 */
export const DEFAULT_FEATURED_ALBUMS: ReadonlyArray<{ slug: string; positions: number[] }> = [
  { slug: '2026-thanksgiving-service', positions: [0, 3] },
  {
    slug: 'uniting-for-a-transparent-ghana-audit-service-may-day-celebration',
    positions: [3, 4]
  }
]

/** Shown alone when the configuration produces no slide at all. */
export const CAROUSEL_FALLBACK_SLIDE: HeroSlide = {
  id: 'fallback-1',
  type: 'news',
  image: '/images/hero/default-news.svg',
  imageAlt: 'Ghana Audit Service',
  title: 'Ghana Audit Service',
  excerpt: 'Protecting the Public Purse Through Accountability and Transparency',
  linkUrl: '/reports',
  linkLabel: 'slideshow.viewReport',
  categoryLabel: 'slideshow.news'
}

/** What the public carousel renders for a resolved list of slides. */
export function withCarouselFallback(slides: HeroSlide[]): HeroSlide[] {
  return slides.length > 0 ? slides : [CAROUSEL_FALLBACK_SLIDE]
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** A pin holds through the end of its `pinnedUntil` day; no date = no expiry. */
export function isPinActive(
  item: Pick<CarouselItemConfig, 'mode' | 'pinnedUntil'>,
  today: string
): boolean {
  return item.mode === 'pinned' && (item.pinnedUntil === null || item.pinnedUntil >= today)
}

export interface CarouselPlan {
  /** Active pins per type, in the admin's order. */
  pinned: Record<CarouselItemType, CarouselItemConfig[]>
  /** Ids the automatic feed must skip: hidden items and items already pinned. */
  excluded: Record<CarouselItemType, number[]>
}

export function planCarousel(items: CarouselItemConfig[], today: string): CarouselPlan {
  const plan: CarouselPlan = {
    pinned: { news: [], event: [], report: [], gallery: [] },
    excluded: { news: [], event: [], report: [], gallery: [] }
  }

  for (const item of items) {
    if (item.mode === 'hidden') {
      plan.excluded[item.type].push(item.refId)
    } else if (isPinActive(item, today)) {
      plan.pinned[item.type].push(item)
      plan.excluded[item.type].push(item.refId)
    }
    // An expired pin does nothing: the item is automatic again.
  }

  return plan
}

/**
 * The photos an album contributes: the admin's choices that still exist, in
 * the chosen order, topped up to `count` with the album's earliest remaining
 * photos.
 */
export function pickGalleryImages(
  albumImageIds: number[],
  selectedIds: number[],
  count: number
): number[] {
  const limit = Math.max(0, Math.min(count, MAX_GALLERY_IMAGES))
  const available = new Set(albumImageIds)
  const picked: number[] = []

  for (const id of selectedIds) {
    if (picked.length >= limit) break
    if (available.has(id) && !picked.includes(id)) picked.push(id)
  }
  for (const id of albumImageIds) {
    if (picked.length >= limit) break
    if (!picked.includes(id)) picked.push(id)
  }

  return picked
}
