/**
 * Content the admin can add to the home page carousel: published news
 * articles, events, A-G reports or gallery albums, newest first, optionally
 * filtered by title.
 */
import { requirePermission } from '../../../utils/adminHelpers'
import { createValidationError } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'
import { CAROUSEL_ITEM_TYPES, type CarouselItemType } from '../../../utils/carousel'
import { fetchCarouselSummaries } from '../../../utils/carouselStore'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const type = String(query.type || '') as CarouselItemType
  if (!CAROUSEL_ITEM_TYPES.includes(type)) {
    throw createValidationError({ type: 'Type must be news, event, report or gallery' })
  }
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : ''

  try {
    return { data: await fetchCarouselSummaries(type, { search, limit: 20 }) }
  } catch (error) {
    throw safeError('admin:carousel', error)
  }
})
