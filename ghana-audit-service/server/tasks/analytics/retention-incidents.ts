import { getPool } from '../../database'

/**
 * Trim abuse_incidents per the design doc retention policy:
 *   - severity='info'                         → 90 days
 *   - severity='warning' or 'critical'        → 365 days
 *
 * Deletes in one statement per severity tier. Volumes are low enough that
 * batching isn't necessary.
 */

const DELETE_INFO_SQL = `
  DELETE FROM abuse_incidents
  WHERE severity = 'info'
    AND ts < (NOW() - INTERVAL 90 DAY)
`

const DELETE_OLD_WARNINGS_SQL = `
  DELETE FROM abuse_incidents
  WHERE severity IN ('warning', 'critical')
    AND ts < (NOW() - INTERVAL 365 DAY)
`

export default defineTask({
  meta: {
    name: 'analytics:retention-incidents',
    description: 'Trim abuse_incidents per severity-based retention policy'
  },
  async run() {
    const pool = getPool()
    const [info] = (await pool.execute(DELETE_INFO_SQL)) as [{ affectedRows: number }, unknown]
    const [warn] = (await pool.execute(DELETE_OLD_WARNINGS_SQL)) as [
      { affectedRows: number },
      unknown
    ]
    return {
      result: {
        deletedInfo: info.affectedRows,
        deletedWarnCritical: warn.affectedRows
      }
    }
  }
})
