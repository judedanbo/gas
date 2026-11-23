import { describe, it, expect } from 'vitest'
import {
  isPinActive,
  pickGalleryImages,
  planCarousel,
  todayUtc,
  withCarouselFallback,
  CAROUSEL_FALLBACK_SLIDE,
  type CarouselItemConfig
} from '../../../../server/utils/carousel'
import { carouselConfigSchema } from '../../../../server/utils/validation'

function item(overrides: Partial<CarouselItemConfig>): CarouselItemConfig {
  return {
    type: 'news',
    refId: 1,
    mode: 'pinned',
    pinnedUntil: null,
    imageCount: null,
    imageIds: [],
    ...overrides
  }
}

describe('todayUtc', () => {
  it('returns the UTC calendar day', () => {
    expect(todayUtc(new Date('2026-11-23T23:59:59Z'))).toBe('2026-11-23')
  })
})

describe('isPinActive', () => {
  it('keeps an item with no end date indefinitely', () => {
    expect(isPinActive(item({ pinnedUntil: null }), '2030-01-01')).toBe(true)
  })

  it('keeps an item through the end of its keep-until day', () => {
    expect(isPinActive(item({ pinnedUntil: '2026-12-31' }), '2026-12-30')).toBe(true)
    expect(isPinActive(item({ pinnedUntil: '2026-12-31' }), '2026-12-31')).toBe(true)
  })

  it('releases the item the day after', () => {
    expect(isPinActive(item({ pinnedUntil: '2026-12-31' }), '2027-01-01')).toBe(false)
  })

  it('is never active for hidden items', () => {
    expect(isPinActive(item({ mode: 'hidden' }), '2026-01-01')).toBe(false)
  })
})

describe('planCarousel', () => {
  const today = '2026-11-23'

  it('shows active pins and keeps them out of the automatic picks (no duplicates)', () => {
    const plan = planCarousel([item({ refId: 7 }), item({ type: 'report', refId: 3 })], today)

    expect(plan.pinned.news.map((i) => i.refId)).toEqual([7])
    expect(plan.excluded.news).toEqual([7])
    expect(plan.pinned.report.map((i) => i.refId)).toEqual([3])
    expect(plan.excluded.report).toEqual([3])
  })

  it('excludes hidden items from the automatic picks without showing them', () => {
    const plan = planCarousel([item({ refId: 9, mode: 'hidden' })], today)

    expect(plan.pinned.news).toEqual([])
    expect(plan.excluded.news).toEqual([9])
  })

  it('treats an expired pin as if it were not there', () => {
    const plan = planCarousel([item({ refId: 5, pinnedUntil: '2026-11-22' })], today)

    expect(plan.pinned.news).toEqual([])
    expect(plan.excluded.news).toEqual([])
  })

  it("preserves the admin's order within a type", () => {
    const plan = planCarousel(
      [item({ type: 'gallery', refId: 20 }), item({ type: 'gallery', refId: 4 })],
      today
    )

    expect(plan.pinned.gallery.map((i) => i.refId)).toEqual([20, 4])
  })
})

describe('pickGalleryImages', () => {
  const album = [10, 11, 12, 13, 14]

  it('uses the first photos of the album when none are chosen', () => {
    expect(pickGalleryImages(album, [], 2)).toEqual([10, 11])
  })

  it('shows the chosen photos in the chosen order', () => {
    expect(pickGalleryImages(album, [14, 11], 2)).toEqual([14, 11])
  })

  it('tops a short selection up with the earliest remaining photos', () => {
    expect(pickGalleryImages(album, [13], 3)).toEqual([13, 10, 11])
  })

  it('ignores chosen photos that no longer exist in the album', () => {
    expect(pickGalleryImages(album, [99, 12], 2)).toEqual([12, 10])
  })

  it('never returns more than the requested number or than the album holds', () => {
    expect(pickGalleryImages(album, [10, 11, 12], 2)).toEqual([10, 11])
    expect(pickGalleryImages([10], [], 4)).toEqual([10])
  })
})

describe('withCarouselFallback', () => {
  it('returns the slides untouched when there are any', () => {
    const slides = [{ ...CAROUSEL_FALLBACK_SLIDE, id: 'news-1' }]
    expect(withCarouselFallback(slides)).toBe(slides)
  })

  it('shows the single fallback slide when nothing is selected', () => {
    expect(withCarouselFallback([])).toEqual([CAROUSEL_FALLBACK_SLIDE])
  })
})

describe('carouselConfigSchema', () => {
  const settings = { newsCount: 2, eventsCount: 2, reportsCount: 2 }

  it('accepts a typical configuration and fills optional fields', () => {
    const parsed = carouselConfigSchema.parse({
      settings,
      items: [
        { type: 'news', refId: 1, mode: 'pinned', pinnedUntil: '2026-12-31' },
        { type: 'report', refId: 2, mode: 'hidden' },
        { type: 'gallery', refId: 3, mode: 'pinned', imageCount: 3, imageIds: [8, 9] }
      ]
    })

    expect(parsed.items[1]).toEqual({
      type: 'report',
      refId: 2,
      mode: 'hidden',
      pinnedUntil: null,
      imageCount: null,
      imageIds: []
    })
  })

  it('rejects automatic counts outside 0–10', () => {
    expect(
      carouselConfigSchema.safeParse({ settings: { ...settings, newsCount: 11 }, items: [] })
        .success
    ).toBe(false)
  })

  it('rejects a gallery album without a photo count or with too many photos chosen', () => {
    const gallery = { type: 'gallery', refId: 3, mode: 'pinned' }
    expect(carouselConfigSchema.safeParse({ settings, items: [gallery] }).success).toBe(false)
    expect(
      carouselConfigSchema.safeParse({
        settings,
        items: [{ ...gallery, imageCount: 1, imageIds: [1, 2] }]
      }).success
    ).toBe(false)
  })

  it('rejects the same item listed twice and malformed dates', () => {
    const news = { type: 'news', refId: 1, mode: 'pinned' }
    expect(carouselConfigSchema.safeParse({ settings, items: [news, news] }).success).toBe(false)
    expect(
      carouselConfigSchema.safeParse({ settings, items: [{ ...news, pinnedUntil: '31/12/2026' }] })
        .success
    ).toBe(false)
  })
})
