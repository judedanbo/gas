import type { LiveEventStatus } from '~/types'
import { getLiveEventStatus } from '../utils/liveEvents'
import { logError } from '../utils/logger'

export default defineEventHandler(async (): Promise<LiveEventStatus> => {
  try {
    return await getLiveEventStatus()
  } catch (error) {
    logError('live-events', error)
    return { isLive: false, events: [], checkedAt: new Date().toISOString() }
  }
})
