import { sql } from 'drizzle-orm'
import { requirePermission } from '../../../utils/adminHelpers'
import { getDatabase, schema } from '../../../database'

const WINDOW_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30
}

/**
 * Visits-by-geolocation overview for the admin analytics "Geo" tab.
 * Aggregates request_events over the window into:
 *   - top countries by visits (with unique-IP counts)
 *   - top ASNs by visits
 *   - a small totals block (total visits + how many were geo-resolved)
 *
 * Geo is enriched at capture time from MaxMind (country/asn columns); rows where
 * the MMDB wasn't mounted have NULL country and are reported under `unknown`.
 * unique-IP counts use ip_hash (stable + present on every row) rather than the
 * raw ip (NULL on /citizenseye rows), so counts stay correct site-wide.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')
  const query = getQuery(event)

  const windowKey = typeof query.window === 'string' ? query.window : '7d'
  const hours = WINDOW_HOURS[windowKey] ?? WINDOW_HOURS['7d']
  const since = sql`ts >= (NOW() - INTERVAL ${sql.raw(String(hours))} HOUR)`

  const db = getDatabase()

  const countries = await db
    .select({
      country: schema.requestEvents.country,
      visits: sql<number>`COUNT(*)`,
      uniqueIps: sql<number>`COUNT(DISTINCT ip_hash)`
    })
    .from(schema.requestEvents)
    .where(since)
    .groupBy(schema.requestEvents.country)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(50)

  const asns = await db
    .select({
      asn: schema.requestEvents.asn,
      visits: sql<number>`COUNT(*)`,
      uniqueIps: sql<number>`COUNT(DISTINCT ip_hash)`
    })
    .from(schema.requestEvents)
    .where(sql`${since} AND asn IS NOT NULL`)
    .groupBy(schema.requestEvents.asn)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(20)

  const [totals] = await db
    .select({
      visits: sql<number>`COUNT(*)`,
      geoResolved: sql<number>`SUM(CASE WHEN country IS NOT NULL THEN 1 ELSE 0 END)`,
      uniqueIps: sql<number>`COUNT(DISTINCT ip_hash)`
    })
    .from(schema.requestEvents)
    .where(since)

  return {
    windowHours: hours,
    totals: {
      visits: Number(totals?.visits ?? 0),
      geoResolved: Number(totals?.geoResolved ?? 0),
      uniqueIps: Number(totals?.uniqueIps ?? 0)
    },
    countries: countries.map((c) => ({
      country: c.country ?? null,
      visits: Number(c.visits),
      uniqueIps: Number(c.uniqueIps)
    })),
    asns: asns.map((a) => ({
      asn: a.asn != null ? Number(a.asn) : null,
      visits: Number(a.visits),
      uniqueIps: Number(a.uniqueIps)
    }))
  }
})
