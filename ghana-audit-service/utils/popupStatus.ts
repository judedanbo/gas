export type PopupStatus = 'inactive' | 'scheduled' | 'live' | 'ended'

interface PopupSchedule {
  isActive: boolean
  startsAt?: string | Date | null
  endsAt?: string | Date | null
}

/**
 * Where a pop-up is in its schedule. Mirrors the "live" filter in
 * server/api/announcement.ts: a missing bound is open-ended, the start is
 * inclusive and the end exclusive.
 */
export function getPopupStatus(popup: PopupSchedule, now: Date = new Date()): PopupStatus {
  if (!popup.isActive) return 'inactive'
  const time = now.getTime()
  if (popup.endsAt && new Date(popup.endsAt).getTime() <= time) return 'ended'
  if (popup.startsAt && new Date(popup.startsAt).getTime() > time) return 'scheduled'
  return 'live'
}
