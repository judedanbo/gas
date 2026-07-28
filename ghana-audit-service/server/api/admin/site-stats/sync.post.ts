import { requirePermission } from '../../../utils/adminHelpers'
import { refreshHrStats } from '../../../utils/refreshHrStats'
import { safeError } from '../../../utils/errors'

/**
 * Manually refresh HR-backed site statistics from the HR API.
 * Returns { synced, skipped }. When the HR API is not configured this is a
 * graceful no-op that returns { synced: 0, skipped: <count> }.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'update')

  try {
    const result = await refreshHrStats()
    return { ...result, updatedAt: new Date().toISOString() }
  } catch (error) {
    throw safeError('admin:site-stats:sync', error)
  }
})
