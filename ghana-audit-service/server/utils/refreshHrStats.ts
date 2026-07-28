import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { fetchHrMetrics } from './hrApi'
import { logError, logInfo } from './logger'

export interface RefreshHrStatsResult {
  /** Number of HR-backed stats whose apiValue was updated. */
  synced: number
  /** Number of HR-backed stats skipped (no matching metric from the HR API). */
  skipped: number
}

/**
 * Refresh HR-backed site statistics from the HR API.
 *
 * For every `site_stats` row with source='hr_api' and an `hrMetricKey`, look up
 * the corresponding value from the HR metrics map and store it in `apiValue`
 * (with `apiSyncedAt`). Rows without a matching metric are left untouched so a
 * partial/unavailable HR response never wipes existing values. Shared by the
 * scheduled task and the admin "Sync from HR" endpoint.
 */
export async function refreshHrStats(): Promise<RefreshHrStatsResult> {
  const metrics = await fetchHrMetrics()
  const db = getDatabase()

  const hrStats = await db
    .select()
    .from(schema.siteStats)
    .where(eq(schema.siteStats.source, 'hr_api'))

  let synced = 0
  let skipped = 0
  const now = new Date()

  for (const stat of hrStats) {
    const metricKey = stat.hrMetricKey
    const value = metricKey ? metrics[metricKey] : undefined

    if (metricKey && typeof value === 'number' && Number.isFinite(value)) {
      try {
        await db
          .update(schema.siteStats)
          .set({ apiValue: Math.round(value), apiSyncedAt: now })
          .where(eq(schema.siteStats.id, stat.id))
        synced++
      } catch (error) {
        logError('hr-api:refresh', error)
        skipped++
      }
    } else {
      skipped++
    }
  }

  logInfo('hr-api:refresh', `Refreshed HR stats: ${synced} synced, ${skipped} skipped`)
  return { synced, skipped }
}
