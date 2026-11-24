import type { ServiceAppSummary } from '~/types'
import { getPublishedServiceApps } from '../../utils/serviceAppStore'
import { serviceAppLocale, transformServiceAppSummary } from '../../utils/transformServiceApp'
import { safeError } from '../../utils/errors'

/**
 * Published Audit Service apps, in display order — the /apps hub and the home
 * page. `?locale=ak` returns Akan text where it has been entered.
 */
export default defineEventHandler(async (event): Promise<ServiceAppSummary[]> => {
  const locale = serviceAppLocale(getQuery(event).locale)
  try {
    const apps = await getPublishedServiceApps()
    return apps.map((app) => transformServiceAppSummary(app, locale))
  } catch (error) {
    throw safeError('api:apps', error)
  }
})
