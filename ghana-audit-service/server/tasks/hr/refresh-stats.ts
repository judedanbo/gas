import { refreshHrStats } from '../../utils/refreshHrStats'
import { logError } from '../../utils/logger'

/**
 * Scheduled refresh of HR-backed site statistics from the HR API.
 * Runs daily (see nuxt.config.ts scheduledTasks). No-op until
 * NUXT_HR_API_BASE_URL / NUXT_HR_API_KEY are configured.
 */
export default defineTask({
  meta: {
    name: 'hr:refresh-stats',
    description: 'Refresh HR-backed site statistics (apiValue) from the HR API'
  },
  async run() {
    try {
      const result = await refreshHrStats()
      return { result }
    } catch (error) {
      logError('hr:refresh-stats', error)
      return { result: { synced: 0, skipped: 0, error: true } }
    }
  }
})
