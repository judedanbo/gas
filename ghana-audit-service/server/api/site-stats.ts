import type { SiteStat } from '~/types'
import { eq, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { transformSiteStats } from '../utils/transformSiteStats'

export default defineEventHandler(async (): Promise<SiteStat[]> => {
  const db = getDatabase()

  const stats = await db
    .select()
    .from(schema.siteStats)
    .where(eq(schema.siteStats.isActive, true))
    .orderBy(asc(schema.siteStats.section), asc(schema.siteStats.displayOrder))

  return transformSiteStats(stats)
})
