import { getPool } from '../../database'

/**
 * Delete request_events + search_queries older than ANALYTICS_RETENTION_DAYS
 * (default 30). The aggregated route_stats_hourly is retained indefinitely —
 * this only trims the raw forensic logs.
 *
 * Deletes in batches to keep individual transactions short on a busy DB.
 */

const BATCH_SIZE = 10_000

async function batchDelete(table: string, days: number, pool: ReturnType<typeof getPool>) {
  let total = 0
  for (let i = 0; i < 100; i++) {
    const [result] = (await pool.execute(
      `DELETE FROM ${table} WHERE ts < (NOW(3) - INTERVAL ? DAY) LIMIT ?`,
      [days, BATCH_SIZE]
    )) as [{ affectedRows: number }, unknown]
    total += result.affectedRows
    if (result.affectedRows < BATCH_SIZE) break
  }
  return total
}

export default defineTask({
  meta: {
    name: 'analytics:retention-raw',
    description: 'Delete request_events + search_queries older than ANALYTICS_RETENTION_DAYS'
  },
  async run() {
    const days = Math.max(1, Number(process.env.ANALYTICS_RETENTION_DAYS) || 30)
    const pool = getPool()

    const deletedEvents = await batchDelete('request_events', days, pool)
    const deletedSearches = await batchDelete('search_queries', days, pool)

    return {
      result: {
        deletedRequestEvents: deletedEvents,
        deletedSearchQueries: deletedSearches,
        days
      }
    }
  }
})
