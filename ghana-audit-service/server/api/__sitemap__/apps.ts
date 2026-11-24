import { getPublishedServiceApps } from '../../utils/serviceAppStore'
import { appPath } from '../../../utils/serviceApps'
import { logError } from '../../utils/logger'

/**
 * Sitemap source for the app pages (/citizenseye, /tracker, …). They come
 * from the database, so @nuxtjs/sitemap can't find them among the static
 * pages. `_i18nTransform` adds each language version and its hreflang links.
 */
export default defineSitemapEventHandler(async () => {
  try {
    const apps = await getPublishedServiceApps()
    return apps.map((app) => ({ loc: appPath(app.slug), _i18nTransform: true }))
  } catch (error) {
    logError('sitemap:apps', error)
    return []
  }
})
