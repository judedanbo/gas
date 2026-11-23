/** Every photo of a gallery album, for the carousel photo picker. */
import { requirePermission } from '../../../../../utils/adminHelpers'
import { safeError } from '../../../../../utils/errors'
import { fetchCarouselAlbumImages } from '../../../../../utils/carouselStore'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })
  }

  try {
    return { data: await fetchCarouselAlbumImages(id) }
  } catch (error) {
    throw safeError('admin:carousel', error)
  }
})
