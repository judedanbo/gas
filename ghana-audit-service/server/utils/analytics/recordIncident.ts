import { getDatabase } from '../../database'
import { abuseIncidents, type NewAbuseIncident } from '../../database/schema/analytics'

/**
 * Best-effort fire-and-forget insert into abuse_incidents. Used by the
 * capture middleware (probing-path hits), the rate-limit middleware
 * (rate-limit hits), and the detector task (newly-classified abusive
 * signatures). Never throws — analytics must never break a response.
 */
export function recordIncident(input: NewAbuseIncident): void {
  void (async () => {
    try {
      const db = getDatabase()
      await db.insert(abuseIncidents).values(input)
    } catch (err) {
      console.warn('[analytics/incident] insert failed:', (err as Error).message)
    }
  })()
}
