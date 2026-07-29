import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useLocaleDate } from '~/composables/useLocaleDate'

// Mock useI18n (auto-imported in the composable)
vi.stubGlobal('useI18n', () => ({ locale: ref('en') }))

describe('useLocaleDate', () => {
  describe('formatDate (UTC-safe)', () => {
    it('formats a date-only string on its own calendar day', () => {
      const { formatDate } = useLocaleDate()
      // "YYYY-MM-DD" parses as UTC midnight; without a UTC timeZone this
      // renders as the previous day in zones west of UTC and breaks
      // SSR/client hydration on ISR-cached pages.
      expect(formatDate('2024-01-01')).toBe('1 Jan 2024')
      expect(formatDate('2024-12-31')).toBe('31 Dec 2024')
    })

    it('formats in UTC regardless of the host timezone', () => {
      const { formatDate } = useLocaleDate()
      // 23:30 UTC is already the next day in zones east of UTC+0:30.
      expect(formatDate('2024-06-30T23:30:00Z')).toBe('30 Jun 2024')
    })

    it('passes timeZone UTC to Intl formatting', () => {
      const spy = vi.spyOn(Date.prototype, 'toLocaleDateString')
      const { formatDate } = useLocaleDate()
      formatDate('2024-01-01')
      expect(spy).toHaveBeenCalledWith(
        'en-GB',
        expect.objectContaining({ timeZone: 'UTC' })
      )
      spy.mockRestore()
    })

    it('lets callers override the timezone explicitly', () => {
      const { formatDate } = useLocaleDate()
      expect(
        formatDate('2024-01-01T00:30:00Z', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'America/New_York'
        })
      ).toBe('31 Dec 2023')
    })

    it('returns an empty string for invalid dates', () => {
      const { formatDate } = useLocaleDate()
      expect(formatDate('not-a-date')).toBe('')
      expect(formatDate('')).toBe('')
    })
  })

  describe('format variants', () => {
    it('formatDateLong spells out the month', () => {
      const { formatDateLong } = useLocaleDate()
      expect(formatDateLong('2024-12-15')).toBe('15 December 2024')
    })

    it('formatDateShort abbreviates the month', () => {
      const { formatDateShort } = useLocaleDate()
      expect(formatDateShort('2024-12-15')).toBe('15 Dec 2024')
    })

    it('formatDateNumeric renders dd/mm/yyyy', () => {
      const { formatDateNumeric } = useLocaleDate()
      expect(formatDateNumeric('2024-12-15')).toBe('15/12/2024')
    })
  })
})
