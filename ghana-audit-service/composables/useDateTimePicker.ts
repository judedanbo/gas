type PickerMode = 'date' | 'time' | 'datetime'

interface CalendarDay {
  day: number
  month: number // 0-indexed
  year: number
  isCurrentMonth: boolean
}

interface ParsedValue {
  date: Date | null
  hours: number
  minutes: number
}

export function useDateTimePicker() {
  function getCalendarDays(year: number, month: number): CalendarDay[] {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Monday = 0, Sunday = 6 (ISO weekday)
    let startDayOfWeek = firstDay.getDay() - 1
    if (startDayOfWeek < 0) startDayOfWeek = 6

    const days: CalendarDay[] = []

    // Previous month trailing days
    const prevMonthLastDay = new Date(year, month, 0)
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay.getDate() - i
      days.push({
        day: d,
        month: month === 0 ? 11 : month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ day: d, month, year, isCurrentMonth: true })
    }

    // Next month leading days
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        month: month === 11 ? 0 : month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
      })
    }

    return days
  }

  function parseValue(value: string | null | undefined, mode: PickerMode): ParsedValue {
    if (!value) {
      return { date: null, hours: 0, minutes: 0 }
    }

    if (mode === 'time') {
      const [h, m] = value.split(':').map(Number)
      return { date: null, hours: h || 0, minutes: m || 0 }
    }

    const parsed = new Date(value)
    if (isNaN(parsed.getTime())) {
      return { date: null, hours: 0, minutes: 0 }
    }

    if (mode === 'date') {
      return { date: parsed, hours: 0, minutes: 0 }
    }

    // datetime
    return {
      date: parsed,
      hours: parsed.getUTCHours(),
      minutes: parsed.getUTCMinutes(),
    }
  }

  function formatDisplay(
    date: Date | null,
    hours: number,
    minutes: number,
    mode: PickerMode,
  ): string {
    if (mode === 'date') {
      if (!date) return ''
      return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date)
    }

    if (mode === 'time') {
      const h12 = hours % 12 || 12
      const ampm = hours < 12 ? 'AM' : 'PM'
      const mm = String(minutes).padStart(2, '0')
      return `${h12}:${mm} ${ampm}`
    }

    // datetime
    if (!date) return ''
    const datePart = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
    const h12 = hours % 12 || 12
    const ampm = hours < 12 ? 'AM' : 'PM'
    const mm = String(minutes).padStart(2, '0')
    return `${datePart}, ${h12}:${mm} ${ampm}`
  }

  function toEmitValue(
    date: Date | null,
    hours: number,
    minutes: number,
    mode: PickerMode,
  ): string {
    if (mode === 'time') {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    if (!date) return ''

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')

    if (mode === 'date') {
      return `${y}-${m}-${d}`
    }

    // datetime
    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    return `${y}-${m}-${d}T${hh}:${mm}:00.000Z`
  }

  function isDateInRange(
    date: Date,
    min: Date | null,
    max: Date | null,
  ): boolean {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (min) {
      const minDay = new Date(min.getFullYear(), min.getMonth(), min.getDate())
      if (dayStart < minDay) return false
    }
    if (max) {
      const maxDay = new Date(max.getFullYear(), max.getMonth(), max.getDate())
      if (dayStart > maxDay) return false
    }
    return true
  }

  function clampToStep(minutes: number, step: number): number {
    return Math.floor(minutes / step) * step
  }

  return {
    getCalendarDays,
    parseValue,
    formatDisplay,
    toEmitValue,
    isDateInRange,
    clampToStep,
  }
}
