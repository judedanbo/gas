import { describe, it, expect } from 'vitest'
import { getPopupStatus } from '../../../utils/popupStatus'

const now = new Date('2026-12-01T12:00:00.000Z')

describe('getPopupStatus', () => {
  it('is live with no schedule', () => {
    expect(getPopupStatus({ isActive: true, startsAt: null, endsAt: null }, now)).toBe('live')
  })

  it('is inactive when switched off, whatever the schedule says', () => {
    expect(
      getPopupStatus(
        {
          isActive: false,
          startsAt: '2026-11-01T00:00:00.000Z',
          endsAt: '2027-01-01T00:00:00.000Z'
        },
        now
      )
    ).toBe('inactive')
  })

  it('is scheduled before the start and live from the start instant', () => {
    expect(getPopupStatus({ isActive: true, startsAt: '2026-12-01T12:00:01.000Z' }, now)).toBe(
      'scheduled'
    )
    expect(getPopupStatus({ isActive: true, startsAt: '2026-12-01T12:00:00.000Z' }, now)).toBe(
      'live'
    )
  })

  it('is ended from the end instant onwards', () => {
    expect(getPopupStatus({ isActive: true, endsAt: '2026-12-01T12:00:00.000Z' }, now)).toBe(
      'ended'
    )
    expect(getPopupStatus({ isActive: true, endsAt: '2026-12-01T12:00:01.000Z' }, now)).toBe('live')
  })

  it('accepts Date objects', () => {
    expect(
      getPopupStatus(
        {
          isActive: true,
          startsAt: new Date('2026-11-30T00:00:00Z'),
          endsAt: new Date('2026-12-02T00:00:00Z')
        },
        now
      )
    ).toBe('live')
  })
})
