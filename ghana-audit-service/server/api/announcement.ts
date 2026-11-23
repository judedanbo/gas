import type { SitePopupResponse } from '~/types'
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { logError } from '../utils/logger'
import { transformPopup } from '../utils/transformPopup'

/**
 * The pop-up to show on page load, if one is live right now.
 *
 * Named "announcement" rather than "popup" on the public side because ad
 * blockers commonly drop requests whose URL contains "popup".
 *
 * When several are live at once, the one that started most recently wins
 * (a pop-up with no start date counts from when it was created).
 */
export default defineEventHandler(async (): Promise<SitePopupResponse> => {
  try {
    const db = getDatabase()
    const { popups } = schema
    // Compared as a bound Date (not NOW()) so it goes through the same
    // timezone conversion as the values the admin API wrote.
    const now = new Date()
    const effectiveStart = sql`COALESCE(${popups.startsAt}, ${popups.createdAt})`

    const [popup] = await db
      .select()
      .from(popups)
      .where(
        and(
          eq(popups.isActive, true),
          isNull(popups.deletedAt),
          or(isNull(popups.startsAt), lte(popups.startsAt, now)),
          or(isNull(popups.endsAt), gt(popups.endsAt, now))
        )
      )
      .orderBy(desc(effectiveStart), desc(popups.id))
      .limit(1)

    return { popup: popup ? transformPopup(popup) : null }
  } catch (error) {
    // A pop-up must never break a page load.
    logError('announcement', error)
    return { popup: null }
  }
})
