/**
 * Admin API for the home page carousel (singleton configuration).
 *
 *   GET    — the configuration plus the slides it currently produces
 *   PUT    — replace the whole configuration (settings + every override)
 *   DELETE — discard the configuration and return to the built-in defaults
 *
 * Until the first PUT nothing is stored and the defaults apply
 * (server/utils/carousel.ts).
 */
import type { H3Event } from 'h3'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction } from '../../../utils/auditLogger'
import { carouselConfigSchema, validateBody } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'
import {
  buildAdminCarousel,
  loadCarouselConfig,
  resetCarouselConfig,
  saveCarouselConfig
} from '../../../utils/carouselStore'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleGet(event)
  if (method === 'PUT') return handleUpdate(event)
  if (method === 'DELETE') return handleReset(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleGet(event: H3Event) {
  requirePermission(event, 'read')

  try {
    return await buildAdminCarousel()
  } catch (error) {
    throw safeError('admin:carousel', error)
  }
}

async function handleUpdate(event: H3Event) {
  requirePermission(event, 'update')

  const user = getCurrentUser(event)
  const input = validateBody(carouselConfigSchema, await readBody(event))

  try {
    const { settings, items } = await loadCarouselConfig()
    await saveCarouselConfig(input, user.id)
    await logAuditAction(event, 'update', 'carousel', null, {
      before: { settings, items },
      after: { settings: input.settings, items: input.items }
    })

    return await buildAdminCarousel()
  } catch (error) {
    throw safeError('admin:carousel', error)
  }
}

async function handleReset(event: H3Event) {
  requirePermission(event, 'update')

  try {
    const { settings, items, isDefault } = await loadCarouselConfig()
    if (!isDefault) {
      await resetCarouselConfig()
      await logAuditAction(event, 'delete', 'carousel', null, { before: { settings, items } })
    }

    return await buildAdminCarousel()
  } catch (error) {
    throw safeError('admin:carousel', error)
  }
}
