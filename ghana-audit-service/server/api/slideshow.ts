import type { HeroSlide } from '~/types'
import { getLocaleFromRequest } from '../utils/locale'
import { DEFAULT_CAROUSEL_SETTINGS, withCarouselFallback } from '../utils/carousel'
import { loadCarouselConfig, resolveCarousel } from '../utils/carouselStore'
import { logError } from '../utils/logger'

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

  return { slides: withCarouselFallback(slides) }
})
