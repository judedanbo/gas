import type { HeroSlide } from '~/types'
import { getLocaleFromRequest } from '../utils/locale'
import { DEFAULT_CAROUSEL_SETTINGS } from '../utils/carousel'
import { loadCarouselConfig, resolveCarousel } from '../utils/carouselStore'
import { logError } from '../utils/logger'

const STATIC_FALLBACK: HeroSlide = {
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

/**
 * Home page carousel feed. What it contains is managed at /admin/carousel:
 * an automatic feed of the latest content, plus the items an admin keeps or
 * removes (server/utils/carousel.ts).
 */
export default defineEventHandler(async (event) => {
  const locale = getLocaleFromRequest(event)

  let slides: HeroSlide[] = []
  try {
    // If the configuration can't be read, still show the latest content.
    const config = await loadCarouselConfig().catch((error) => {
      logError('carousel:config', error)
      return { settings: DEFAULT_CAROUSEL_SETTINGS, items: [] }
    })
    slides = (await resolveCarousel(config, locale)).map((resolved) => resolved.slide)
  } catch (error) {
    logError('carousel', error)
  }

  return { slides: slides.length > 0 ? slides : [STATIC_FALLBACK] }
})
