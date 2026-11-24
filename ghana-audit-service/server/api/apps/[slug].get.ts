import type { ServiceApp } from '~/types'
import { APP_SLUG_MAX_LENGTH, APP_SLUG_PATTERN } from '../../../utils/serviceApps'
import { findPublishedServiceApp } from '../../utils/serviceAppStore'
import { serviceAppLocale, transformServiceApp } from '../../utils/transformServiceApp'
import { safeError } from '../../utils/errors'

/**
 * One published app's landing page content (pages/[slug].vue). Every
 * single-segment address no other page claims ends up here, so anything that
 * can't be an app address is turned away before the lookup.
 */
export default defineEventHandler(async (event): Promise<ServiceApp> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const notFound = () =>
    createError({ statusCode: 404, statusMessage: 'Not Found', message: 'App not found' })

  if (slug.length > APP_SLUG_MAX_LENGTH || !APP_SLUG_PATTERN.test(slug)) throw notFound()

  let app
  try {
    app = await findPublishedServiceApp(slug)
  } catch (error) {
    throw safeError('api:apps', error)
  }
  if (!app) throw notFound()

  return transformServiceApp(app, serviceAppLocale(getQuery(event).locale))
})
