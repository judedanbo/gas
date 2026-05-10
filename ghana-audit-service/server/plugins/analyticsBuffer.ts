import { closeAnalyticsBuffer, initAnalyticsBuffer } from '../utils/analytics/buffer'
import { closeRedis } from '../utils/redis'

/**
 * Wire the analytics buffer into Nitro's lifecycle: start the periodic flush
 * timer at boot, and on shutdown drain any in-flight events to MySQL and
 * close Redis. Runs in production and dev.
 */
export default defineNitroPlugin((nitroApp) => {
  initAnalyticsBuffer()

  nitroApp.hooks.hook('close', async () => {
    try {
      await closeAnalyticsBuffer()
    } catch (err) {
      console.warn('[analyticsBuffer] close flush failed:', (err as Error).message)
    }
    try {
      await closeRedis()
    } catch {
      /* swallowed; we're shutting down */
    }
  })
})
