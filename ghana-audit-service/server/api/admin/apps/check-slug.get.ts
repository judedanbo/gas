import { requirePermission } from '../../../utils/adminHelpers'
import { appSlugProblem } from '../../../../utils/serviceApps'
import { findServiceAppBySlug } from '../../../utils/serviceAppStore'
import { safeError } from '../../../utils/errors'

/**
 * Whether an app can take the address /<slug>: `{ available, reason? }`.
 * `excludeId` is the app being edited, which may keep its own address.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const slug = typeof query.slug === 'string' ? query.slug.trim().toLowerCase() : ''
  const excludeId = query.excludeId ? Number(query.excludeId) : undefined

  const problem = appSlugProblem(slug)
  if (problem) return { available: false, reason: problem }

  try {
    const taken = await findServiceAppBySlug(
      slug,
      Number.isInteger(excludeId) ? excludeId : undefined
    )
    return taken
      ? { available: false, reason: `Another app already uses /${slug}` }
      : { available: true }
  } catch (error) {
    throw safeError('admin:apps', error)
  }
})
