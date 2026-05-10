import { getPool } from '../../database'

/**
 * Delete request_events older than ANALYTICS_RETENTION_DAYS (default 30).
 * The aggregated route_stats_hourly is retained indefinitely — this only
 * trims the raw forensic log.
 *
 * Deletes in batches to keep individual transactions short on a busy DB.
 */

const BATCH_SIZE = 10_000

export default defineTask({
  meta: {
    name: 'analytics:retention-raw',
    description: 'Delete request_events older than ANALYTICS_RETENTION_DAYS'
  },
  async run() {
    const days = Math.max(1, Number(process.env.ANALYTICS_RETENTION_DAYS) || 30)
    const pool = getPool()

    let totalDeleted = 0
    // Loop in batches so we don't hold a giant lock; bail after a sane
    // upper bound so a misconfigured retention value can't churn forever.
    for (let i = 0; i < 100; i++) {
      const [result] = (await pool.execute(
        'DELETE FROM request_events WHERE ts < (NOW(3) - INTERVAL ? DAY) LIMIT ?',
        [days, BATCH_SIZE]
      )) as [{ affectedRows: number }, unknown]
      totalDeleted += result.affectedRows
      if (result.affectedRows < BATCH_SIZE) break
    }

    return { result: { deleted: totalDeleted, days } }
  }
})
