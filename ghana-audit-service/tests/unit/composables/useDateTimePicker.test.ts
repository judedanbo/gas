import { describe, it, expect } from 'vitest'
import { useDateTimePicker } from '~/composables/useDateTimePicker'

describe('useDateTimePicker', () => {
  describe('getCalendarDays', () => {
    it('returns exactly 42 cells (6 weeks)', () => {
      const { getCalendarDays } = useDateTimePicker()
      const days = getCalendarDays(2026, 4) // May 2026 (0-indexed)
      expect(days).toHaveLength(42)
    })

    it('marks current-month days correctly for May 2026', () => {
      const { getCalendarDays } = useDateTimePicker()
      const days = getCalendarDays(2026, 4)
      const currentMonthDays = days.filter(d => d.isCurrentMonth)
      expect(currentMonthDays).toHaveLength(31)
    })

    it('starts the grid on Monday', () => {
      const { getCalendarDays } = useDateTimePicker()
      const days = getCalendarDays(2026, 4) // May 2026 starts on Friday
      expect(days[0].day).toBe(27)
      expect(days[0].month).toBe(3)
      expect(days[0].isCurrentMonth).toBe(false)
    })

    it('handles February in a leap year', () => {
      const { getCalendarDays } = useDateTimePicker()
      const days = getCalendarDays(2028, 1)
      const febDays = days.filter(d => d.isCurrentMonth)
      expect(febDays).toHaveLength(29)
    })
  })

  describe('parseValue', () => {
    it('parses a date-mode ISO string', () => {
      const { parseValue } = useDateTimePicker()
      const result = parseValue('2026-05-14', 'date')
      expect(result.date).toBeInstanceOf(Date)
      expect(result.date!.getFullYear()).toBe(2026)
      expect(result.date!.getMonth()).toBe(4)
      expect(result.date!.getDate()).toBe(14)
      expect(result.hours).toBe(0)
      expect(result.minutes).toBe(0)
    })

    it('parses a time-mode string', () => {
      const { parseValue } = useDateTimePicker()
      const result = parseValue('14:30', 'time')
      expect(result.date).toBeNull()
      expect(result.hours).toBe(14)
      expect(result.minutes).toBe(30)
    })

    it('parses a datetime-mode ISO string', () => {
      const { parseValue } = useDateTimePicker()
      const result = parseValue('2026-05-14T10:30:00.000Z', 'datetime')
      expect(result.date).toBeInstanceOf(Date)
      expect(result.hours).toBe(10)
      expect(result.minutes).toBe(30)
    })

    it('returns nulls for empty string', () => {
      const { parseValue } = useDateTimePicker()
      const result = parseValue('', 'date')
      expect(result.date).toBeNull()
      expect(result.hours).toBe(0)
      expect(result.minutes).toBe(0)
    })

    it('returns nulls for null', () => {
      const { parseValue } = useDateTimePicker()
      const result = parseValue(null, 'date')
      expect(result.date).toBeNull()
      expect(result.hours).toBe(0)
      expect(result.minutes).toBe(0)
    })
  })

  describe('formatDisplay', () => {
    it('formats date mode as readable string', () => {
      const { formatDisplay } = useDateTimePicker()
      const date = new Date(2026, 4, 14)
      const result = formatDisplay(date, 0, 0, 'date')
      expect(result).toContain('14')
      expect(result).toContain('May')
      expect(result).toContain('2026')
    })

    it('formats time mode as 12-hour with AM/PM', () => {
      const { formatDisplay } = useDateTimePicker()
      const result = formatDisplay(null, 14, 30, 'time')
      expect(result).toBe('2:30 PM')
    })

    it('formats time mode for midnight correctly', () => {
      const { formatDisplay } = useDateTimePicker()
      const result = formatDisplay(null, 0, 0, 'time')
      expect(result).toBe('12:00 AM')
    })

    it('formats time mode for noon correctly', () => {
      const { formatDisplay } = useDateTimePicker()
      const result = formatDisplay(null, 12, 0, 'time')
      expect(result).toBe('12:00 PM')
    })

    it('formats datetime mode as date + time', () => {
      const { formatDisplay } = useDateTimePicker()
      const date = new Date(2026, 4, 14)
      const result = formatDisplay(date, 10, 30, 'datetime')
      expect(result).toContain('14')
      expect(result).toContain('May')
      expect(result).toContain('10:30 AM')
    })

    it('returns empty string when no date in date mode', () => {
      const { formatDisplay } = useDateTimePicker()
      const result = formatDisplay(null, 0, 0, 'date')
      expect(result).toBe('')
    })
  })

  describe('toEmitValue', () => {
    it('emits YYYY-MM-DD for date mode', () => {
      const { toEmitValue } = useDateTimePicker()
      const date = new Date(2026, 4, 14)
      const result = toEmitValue(date, 0, 0, 'date')
      expect(result).toBe('2026-05-14')
    })

    it('emits HH:mm for time mode', () => {
      const { toEmitValue } = useDateTimePicker()
      const result = toEmitValue(null, 10, 30, 'time')
      expect(result).toBe('10:30')
    })

    it('emits full ISO for datetime mode', () => {
      const { toEmitValue } = useDateTimePicker()
      const date = new Date(2026, 4, 14)
      const result = toEmitValue(date, 10, 30, 'datetime')
      expect(result).toMatch(/^2026-05-14T10:30:00/)
    })

    it('pads single-digit hours and minutes', () => {
      const { toEmitValue } = useDateTimePicker()
      const result = toEmitValue(null, 9, 5, 'time')
      expect(result).toBe('09:05')
    })
  })

  describe('isDateInRange', () => {
    it('returns true when no bounds', () => {
      const { isDateInRange } = useDateTimePicker()
      const date = new Date(2026, 4, 14)
      expect(isDateInRange(date, null, null)).toBe(true)
    })

    it('returns false when before min', () => {
      const { isDateInRange } = useDateTimePicker()
      const date = new Date(2026, 4, 10)
      const min = new Date(2026, 4, 14)
      expect(isDateInRange(date, min, null)).toBe(false)
    })

    it('returns false when after max', () => {
      const { isDateInRange } = useDateTimePicker()
      const date = new Date(2026, 4, 20)
      const max = new Date(2026, 4, 14)
      expect(isDateInRange(date, null, max)).toBe(false)
    })

    it('returns true when within bounds', () => {
      const { isDateInRange } = useDateTimePicker()
      const date = new Date(2026, 4, 14)
      const min = new Date(2026, 4, 1)
      const max = new Date(2026, 4, 31)
      expect(isDateInRange(date, min, max)).toBe(true)
    })

    it('returns true when exactly on min boundary', () => {
      const { isDateInRange } = useDateTimePicker()
      const date = new Date(2026, 4, 14)
      const min = new Date(2026, 4, 14)
      expect(isDateInRange(date, min, null)).toBe(true)
    })
  })

  describe('clampToStep', () => {
    it('returns same value when step is 1', () => {
      const { clampToStep } = useDateTimePicker()
      expect(clampToStep(17, 1)).toBe(17)
    })

    it('rounds down to nearest step of 5', () => {
      const { clampToStep } = useDateTimePicker()
      expect(clampToStep(17, 5)).toBe(15)
    })

    it('rounds down to nearest step of 15', () => {
      const { clampToStep } = useDateTimePicker()
      expect(clampToStep(22, 15)).toBe(15)
    })

    it('returns 0 for 0', () => {
      const { clampToStep } = useDateTimePicker()
      expect(clampToStep(0, 5)).toBe(0)
    })

    it('handles step of 30', () => {
      const { clampToStep } = useDateTimePicker()
      expect(clampToStep(45, 30)).toBe(30)
    })
  })
})
