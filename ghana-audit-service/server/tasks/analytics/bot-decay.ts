import { getPool } from '../../database'

/**
 * Decay scores for bot_signatures that haven't been seen in 7 days.
 *
 * Without decay, a one-time burst would keep an IP/UA marked as abusive
 * forever, which is both wrong (the actor could be reassigned the IP) and
 * useless (the dashboard fills with stale rows). Each daily run halves
 * the score and reclassifies; rows with score 0 stay at 0. Human-decided
 * rows (decided_by IS NOT NULL) are skipped.
 */

const DECAY_SQL = `
  UPDATE bot_signatures
  SET
    score = FLOOR(score / 2),
    classification = CASE
      WHEN FLOOR(score / 2) >= 60 THEN 'abusive'
      WHEN FLOOR(score / 2) >= 35 THEN 'suspicious'
      WHEN FLOOR(score / 2) >= 10 THEN 'crawler'
      ELSE 'clean'
    END
  WHERE last_seen < (NOW() - INTERVAL 7 DAY)
    AND decided_by IS NULL
    AND score > 0
`

export default defineTask({
  meta: {
    name: 'analytics:bot-decay',
    description: 'Decay scores on stale bot_signatures'
  },
  async run() {
    const pool = getPool()
    const [result] = (await pool.execute(DECAY_SQL)) as [{ affectedRows: number }, unknown]
    return { result: { decayed: result.affectedRows } }
  }
})
