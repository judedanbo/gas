# UiDateTimePicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom, themed date/time picker component (`UiDateTimePicker`) with three modes (date, time, datetime), replace the existing `AdminDatePicker` across all admin pages, and delete the old component.

**Architecture:** A single `UiDateTimePicker.vue` orchestrator component composes three internal sub-components (`CalendarPanel`, `TimeWheels`, `PickerPopover`) based on a `mode` prop. Pure date-math logic lives in a `useDateTimePicker` composable, testable without DOM. The component emits ISO 8601 strings via v-model and integrates with the existing `AdminFormGroup` wrapper for labels/errors.

**Tech Stack:** Nuxt 3, Vue 3 Composition API (`<script setup lang="ts">`), Tailwind CSS (class-based dark mode), Vitest + happy-dom, native `Date` / `Intl` APIs (no external date library).

**Spec:** `docs/superpowers/specs/2026-05-14-date-time-picker-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `ghana-audit-service/composables/useDateTimePicker.ts` | Create | Pure date math, parsing, formatting, calendar grid generation |
| `ghana-audit-service/tests/unit/composables/useDateTimePicker.test.ts` | Create | Tests for the composable |
| `ghana-audit-service/components/ui/date-time-picker/CalendarPanel.vue` | Create | Month grid with navigation and year/month quick-select |
| `ghana-audit-service/components/ui/date-time-picker/TimeWheels.vue` | Create | Scrollable hour/minute wheels with AM/PM toggle |
| `ghana-audit-service/components/ui/date-time-picker/PickerPopover.vue` | Create | Teleported floating container with positioning and dismiss |
| `ghana-audit-service/components/ui/DateTimePicker.vue` | Create | Main orchestrator: trigger input, mode routing, v-model |
| `ghana-audit-service/tests/unit/components/ui/DateTimePicker.test.ts` | Create | Component integration tests |
| 14 admin pages (see Task 8) | Modify | Replace `AdminFormAdminDatePicker` → `UiDateTimePicker` |
| `ghana-audit-service/components/admin/form/AdminDatePicker.vue` | Delete | Old component, replaced by `UiDateTimePicker` |

---

## Task 1: Create branch and scaffold

**Files:**
- None created yet — branch setup only

- [ ] **Step 1: Create the feature branch**

```bash
cd ghana-audit-service
git checkout -b feature/date-time-picker
```

- [ ] **Step 2: Create the sub-component directory**

```bash
mkdir -p components/ui/date-time-picker
```

- [ ] **Step 3: Commit scaffold**

```bash
git add .
git commit -m "chore(ui): scaffold date-time-picker directory"
```

---

## Task 2: Build `useDateTimePicker` composable — tests first

**Files:**
- Create: `ghana-audit-service/tests/unit/composables/useDateTimePicker.test.ts`

- [ ] **Step 1: Write failing tests for all composable functions**

```typescript
import { describe, it, expect } from 'vitest'

// We'll import from the composable once it exists
// For now these tests define the contract

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
      expect(currentMonthDays).toHaveLength(31) // May has 31 days
    })

    it('starts the grid on Monday', () => {
      const { getCalendarDays } = useDateTimePicker()
      const days = getCalendarDays(2026, 4) // May 2026 starts on Friday
      // First cell should be Monday Apr 27
      expect(days[0].day).toBe(27)
      expect(days[0].month).toBe(3) // April (0-indexed)
      expect(days[0].isCurrentMonth).toBe(false)
    })

    it('handles February in a leap year', () => {
      const { getCalendarDays } = useDateTimePicker()
      const days = getCalendarDays(2028, 1) // Feb 2028 is a leap year
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
      const date = new Date(2026, 4, 14) // May 14, 2026
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run tests/unit/composables/useDateTimePicker.test.ts`
Expected: FAIL — `useDateTimePicker is not defined`

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/unit/composables/useDateTimePicker.test.ts
git commit -m "test(ui): add failing tests for useDateTimePicker composable"
```

---

## Task 3: Implement `useDateTimePicker` composable

**Files:**
- Create: `ghana-audit-service/composables/useDateTimePicker.ts`

- [ ] **Step 1: Implement the composable**

```typescript
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
```

- [ ] **Step 2: Add the import to the test file**

Add this line at the top of `tests/unit/composables/useDateTimePicker.test.ts`:

```typescript
import { useDateTimePicker } from '~/composables/useDateTimePicker'
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm run test:run tests/unit/composables/useDateTimePicker.test.ts`
Expected: All 22 tests PASS

- [ ] **Step 4: Commit**

```bash
git add composables/useDateTimePicker.ts tests/unit/composables/useDateTimePicker.test.ts
git commit -m "feat(ui): implement useDateTimePicker composable with tests"
```

---

## Task 4: Build `CalendarPanel.vue`

**Files:**
- Create: `ghana-audit-service/components/ui/date-time-picker/CalendarPanel.vue`

- [ ] **Step 1: Create CalendarPanel component**

```vue
<template>
  <div class="p-3">
    <!-- Month/Year Header -->
    <div class="flex items-center justify-between mb-2">
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        aria-label="Previous month"
        @click="navigateMonth(-1)"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        type="button"
        class="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        @click="showMonthSelect = !showMonthSelect"
      >
        {{ monthName }} {{ currentYear }}
      </button>

      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        aria-label="Next month"
        @click="navigateMonth(1)"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Month Quick Select -->
    <div v-if="showMonthSelect" class="mb-2">
      <div class="flex items-center justify-between mb-2">
        <button
          type="button"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          aria-label="Previous year"
          @click="$emit('update:currentYear', currentYear - 1)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ currentYear }}</span>
        <button
          type="button"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          aria-label="Next year"
          @click="$emit('update:currentYear', currentYear + 1)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="(name, index) in monthNames"
          :key="index"
          type="button"
          :class="[
            'px-2 py-1.5 text-xs rounded-lg transition-colors',
            index === currentMonth
              ? 'bg-primary text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
          ]"
          @click="selectMonth(index)"
        >
          {{ name }}
        </button>
      </div>
    </div>

    <!-- Calendar Grid -->
    <div v-else>
      <!-- Weekday Headers -->
      <div class="grid grid-cols-7 mb-1">
        <div
          v-for="day in weekdays"
          :key="day"
          class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
        >
          {{ day }}
        </div>
      </div>

      <!-- Day Cells -->
      <div class="grid grid-cols-7" role="grid" aria-label="Calendar">
        <button
          v-for="(cell, index) in calendarDays"
          :key="index"
          type="button"
          :disabled="!cellInRange(cell)"
          :aria-selected="isCellSelected(cell)"
          :class="dayCellClasses(cell)"
          @click="handleDayClick(cell)"
        >
          {{ cell.day }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useDateTimePicker } from '~/composables/useDateTimePicker'

  interface Props {
    selectedDate?: Date | null
    currentMonth: number
    currentYear: number
    minDate?: Date | null
    maxDate?: Date | null
  }

  const props = withDefaults(defineProps<Props>(), {
    selectedDate: null,
    minDate: null,
    maxDate: null,
  })

  const emit = defineEmits<{
    'select-date': [date: Date]
    'update:currentMonth': [month: number]
    'update:currentYear': [year: number]
  }>()

  const { getCalendarDays, isDateInRange } = useDateTimePicker()

  const showMonthSelect = ref(false)

  const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  const monthName = computed(() => {
    return new Intl.DateTimeFormat('en', { month: 'long' }).format(
      new Date(props.currentYear, props.currentMonth),
    )
  })

  const calendarDays = computed(() => getCalendarDays(props.currentYear, props.currentMonth))

  const today = new Date()
  const todayDate = today.getDate()
  const todayMonth = today.getMonth()
  const todayYear = today.getFullYear()

  function isToday(cell: { day: number; month: number; year: number }): boolean {
    return cell.day === todayDate && cell.month === todayMonth && cell.year === todayYear
  }

  function isCellSelected(cell: { day: number; month: number; year: number }): boolean {
    if (!props.selectedDate) return false
    return (
      cell.day === props.selectedDate.getDate() &&
      cell.month === props.selectedDate.getMonth() &&
      cell.year === props.selectedDate.getFullYear()
    )
  }

  function cellInRange(cell: { day: number; month: number; year: number }): boolean {
    const d = new Date(cell.year, cell.month, cell.day)
    return isDateInRange(d, props.minDate ?? null, props.maxDate ?? null)
  }

  function dayCellClasses(cell: { day: number; month: number; year: number; isCurrentMonth: boolean }) {
    const base = 'w-10 h-10 flex items-center justify-center text-sm rounded-full transition-colors'
    const selected = isCellSelected(cell)
    const todayCell = isToday(cell)
    const inRange = cellInRange(cell)

    if (!inRange) {
      return [base, 'text-gray-300 dark:text-gray-600 cursor-not-allowed']
    }
    if (selected) {
      return [base, 'bg-primary text-white font-semibold']
    }
    if (todayCell) {
      return [base, 'ring-1 ring-primary font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700']
    }
    if (!cell.isCurrentMonth) {
      return [base, 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer']
    }
    return [base, 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer']
  }

  function handleDayClick(cell: { day: number; month: number; year: number }) {
    if (!cellInRange(cell)) return
    emit('select-date', new Date(cell.year, cell.month, cell.day))
  }

  function navigateMonth(delta: number) {
    let newMonth = props.currentMonth + delta
    let newYear = props.currentYear

    if (newMonth < 0) {
      newMonth = 11
      newYear--
    } else if (newMonth > 11) {
      newMonth = 0
      newYear++
    }

    emit('update:currentMonth', newMonth)
    emit('update:currentYear', newYear)
  }

  function selectMonth(month: number) {
    emit('update:currentMonth', month)
    showMonthSelect.value = false
  }
</script>
```

- [ ] **Step 2: Smoke test — verify the file has no TypeScript errors**

Run: `npx vue-tsc --noEmit 2>&1 | grep -i "CalendarPanel\|error" | head -20`
Expected: No errors mentioning CalendarPanel

- [ ] **Step 3: Commit**

```bash
git add components/ui/date-time-picker/CalendarPanel.vue
git commit -m "feat(ui): add CalendarPanel sub-component for date picker"
```

---

## Task 5: Build `TimeWheels.vue`

**Files:**
- Create: `ghana-audit-service/components/ui/date-time-picker/TimeWheels.vue`

- [ ] **Step 1: Create TimeWheels component**

```vue
<template>
  <div class="p-3">
    <!-- Labels -->
    <div class="flex justify-center gap-8 mb-1">
      <span class="text-xs text-gray-500 dark:text-gray-400">Hour</span>
      <span class="text-xs text-gray-500 dark:text-gray-400">Min</span>
    </div>

    <!-- Wheels Container -->
    <div class="flex items-center justify-center gap-2">
      <!-- Hour Wheel -->
      <div class="relative h-[120px] w-16 overflow-hidden">
        <div class="absolute inset-x-0 top-[40px] h-[40px] bg-primary/10 dark:bg-primary/20 rounded-lg pointer-events-none z-10" />
        <div
          ref="hourWheelRef"
          class="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
          role="listbox"
          aria-label="Select hour"
          @scrollend="onHourScroll"
        >
          <!-- Top padding -->
          <div class="h-[40px]" aria-hidden="true" />
          <div
            v-for="h in 12"
            :key="h"
            :class="[
              'h-[40px] flex items-center justify-center text-lg snap-center transition-colors',
              displayHour === h
                ? 'font-semibold text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500',
            ]"
            role="option"
            :aria-selected="displayHour === h"
          >
            {{ h }}
          </div>
          <!-- Bottom padding -->
          <div class="h-[40px]" aria-hidden="true" />
        </div>
      </div>

      <!-- Separator -->
      <span class="text-xl font-bold text-gray-400 dark:text-gray-500">:</span>

      <!-- Minute Wheel -->
      <div class="relative h-[120px] w-16 overflow-hidden">
        <div class="absolute inset-x-0 top-[40px] h-[40px] bg-primary/10 dark:bg-primary/20 rounded-lg pointer-events-none z-10" />
        <div
          ref="minuteWheelRef"
          class="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
          role="listbox"
          aria-label="Select minute"
          @scrollend="onMinuteScroll"
        >
          <!-- Top padding -->
          <div class="h-[40px]" aria-hidden="true" />
          <div
            v-for="m in minuteOptions"
            :key="m"
            :class="[
              'h-[40px] flex items-center justify-center text-lg snap-center transition-colors',
              minutes === m
                ? 'font-semibold text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500',
            ]"
            role="option"
            :aria-selected="minutes === m"
          >
            {{ String(m).padStart(2, '0') }}
          </div>
          <!-- Bottom padding -->
          <div class="h-[40px]" aria-hidden="true" />
        </div>
      </div>
    </div>

    <!-- AM/PM Toggle -->
    <div class="flex justify-center gap-2 mt-3" role="radiogroup" aria-label="AM or PM">
      <button
        type="button"
        role="radio"
        :aria-checked="!isPM"
        :class="[
          'px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
          !isPM
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
        ]"
        @click="setAMPM(false)"
      >
        AM
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="isPM"
        :class="[
          'px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
          isPM
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
        ]"
        @click="setAMPM(true)"
      >
        PM
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    hours: number // 0-23
    minutes: number // 0-59
    minuteStep?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    minuteStep: 1,
  })

  const emit = defineEmits<{
    'update:hours': [hours: number]
    'update:minutes': [minutes: number]
  }>()

  const hourWheelRef = ref<HTMLElement | null>(null)
  const minuteWheelRef = ref<HTMLElement | null>(null)

  const isPM = computed(() => props.hours >= 12)
  const displayHour = computed(() => {
    const h = props.hours % 12
    return h === 0 ? 12 : h
  })

  const minuteOptions = computed(() => {
    const options: number[] = []
    for (let m = 0; m < 60; m += props.minuteStep) {
      options.push(m)
    }
    return options
  })

  function scrollToSelected() {
    nextTick(() => {
      if (hourWheelRef.value) {
        const hourIndex = displayHour.value - 1
        hourWheelRef.value.scrollTop = hourIndex * 40
      }
      if (minuteWheelRef.value) {
        const minuteIndex = minuteOptions.value.indexOf(props.minutes)
        if (minuteIndex >= 0) {
          minuteWheelRef.value.scrollTop = minuteIndex * 40
        }
      }
    })
  }

  function onHourScroll() {
    if (!hourWheelRef.value) return
    const index = Math.round(hourWheelRef.value.scrollTop / 40)
    const h12 = Math.min(Math.max(index + 1, 1), 12)
    let h24 = isPM.value ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12)
    emit('update:hours', h24)
  }

  function onMinuteScroll() {
    if (!minuteWheelRef.value) return
    const index = Math.round(minuteWheelRef.value.scrollTop / 40)
    const clampedIndex = Math.min(Math.max(index, 0), minuteOptions.value.length - 1)
    emit('update:minutes', minuteOptions.value[clampedIndex])
  }

  function setAMPM(pm: boolean) {
    const currentH12 = displayHour.value
    let h24: number
    if (pm) {
      h24 = currentH12 === 12 ? 12 : currentH12 + 12
    } else {
      h24 = currentH12 === 12 ? 0 : currentH12
    }
    emit('update:hours', h24)
  }

  onMounted(scrollToSelected)
  watch([() => props.hours, () => props.minutes], scrollToSelected)
</script>

<style scoped>
  .scrollbar-none {
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx vue-tsc --noEmit 2>&1 | grep -i "TimeWheels\|error" | head -20`
Expected: No errors mentioning TimeWheels

- [ ] **Step 3: Commit**

```bash
git add components/ui/date-time-picker/TimeWheels.vue
git commit -m "feat(ui): add TimeWheels sub-component with scroll-snap wheels"
```

---

## Task 6: Build `PickerPopover.vue`

**Files:**
- Create: `ghana-audit-service/components/ui/date-time-picker/PickerPopover.vue`

- [ ] **Step 1: Create PickerPopover component**

```vue
<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        ref="popoverRef"
        :style="positionStyle"
        class="fixed z-50 w-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg dark:shadow-black/20 origin-top"
        role="dialog"
        aria-modal="true"
        aria-label="Date time picker"
        @keydown.escape="$emit('close')"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  interface Props {
    show: boolean
    triggerRef: HTMLElement | null
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    close: []
  }>()

  const popoverRef = ref<HTMLElement | null>(null)

  const positionStyle = ref<Record<string, string>>({
    top: '0px',
    left: '0px',
  })

  function updatePosition() {
    if (!props.triggerRef) return

    const rect = props.triggerRef.getBoundingClientRect()
    const popoverHeight = popoverRef.value?.offsetHeight ?? 400
    const popoverWidth = 320
    const gap = 4

    let top = rect.bottom + gap
    let left = rect.left

    // Flip above if not enough space below
    if (top + popoverHeight > window.innerHeight) {
      top = rect.top - popoverHeight - gap
    }

    // Align right if overflowing right edge
    if (left + popoverWidth > window.innerWidth) {
      left = rect.right - popoverWidth
    }

    // Clamp left to 0
    left = Math.max(4, left)

    positionStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node
    if (
      popoverRef.value &&
      !popoverRef.value.contains(target) &&
      props.triggerRef &&
      !props.triggerRef.contains(target)
    ) {
      emit('close')
    }
  }

  let resizeHandler: (() => void) | null = null

  watch(
    () => props.show,
    (visible) => {
      if (visible) {
        nextTick(() => {
          updatePosition()
          document.addEventListener('mousedown', handleClickOutside)
          resizeHandler = () => updatePosition()
          window.addEventListener('resize', resizeHandler)
          window.addEventListener('scroll', resizeHandler, true)
        })
      } else {
        document.removeEventListener('mousedown', handleClickOutside)
        if (resizeHandler) {
          window.removeEventListener('resize', resizeHandler)
          window.removeEventListener('scroll', resizeHandler, true)
        }
      }
    },
  )

  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleClickOutside)
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler)
      window.removeEventListener('scroll', resizeHandler, true)
    }
  })
</script>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx vue-tsc --noEmit 2>&1 | grep -i "PickerPopover\|error" | head -20`
Expected: No errors mentioning PickerPopover

- [ ] **Step 3: Commit**

```bash
git add components/ui/date-time-picker/PickerPopover.vue
git commit -m "feat(ui): add PickerPopover with teleport and positioning"
```

---

## Task 7: Build main `DateTimePicker.vue` orchestrator

**Files:**
- Create: `ghana-audit-service/components/ui/DateTimePicker.vue`

- [ ] **Step 1: Create the main component**

```vue
<template>
  <AdminFormGroup
    :id="inputId"
    :label="label"
    :required="required"
    :error="error"
    :help-text="helpText"
    :hint="hint"
  >
    <!-- Trigger Input -->
    <div ref="triggerRef" class="relative">
      <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <!-- Calendar icon (date/datetime) -->
        <svg
          v-if="mode !== 'time'"
          class="w-5 h-5 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <!-- Clock icon (time) -->
        <svg
          v-else
          class="w-5 h-5 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <input
        :id="inputId"
        type="text"
        readonly
        :value="displayValue"
        :placeholder="effectivePlaceholder"
        :disabled="disabled"
        :class="[
          'form-input w-full pl-10 pr-10 cursor-pointer',
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : '',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]"
        @click="toggleOpen"
        @keydown.enter.prevent="toggleOpen"
        @keydown.space.prevent="toggleOpen"
        @blur="handleBlur"
      />

      <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg
          class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform"
          :class="{ 'rotate-180': isOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <!-- Popover -->
    <UiDateTimePickerPickerPopover
      :show="isOpen"
      :trigger-ref="triggerRef"
      @close="close"
    >
      <!-- Calendar Panel -->
      <UiDateTimePickerCalendarPanel
        v-if="mode === 'date' || mode === 'datetime'"
        :selected-date="workingDate"
        :current-month="viewMonth"
        :current-year="viewYear"
        :min-date="parsedMin"
        :max-date="parsedMax"
        @select-date="handleDateSelect"
        @update:current-month="viewMonth = $event"
        @update:current-year="viewYear = $event"
      />

      <!-- Divider -->
      <div
        v-if="mode === 'datetime'"
        class="border-t border-gray-200 dark:border-gray-700"
      />

      <!-- Time Wheels -->
      <UiDateTimePickerTimeWheels
        v-if="mode === 'time' || mode === 'datetime'"
        :hours="workingHours"
        :minutes="workingMinutes"
        @update:hours="handleHoursUpdate"
        @update:minutes="handleMinutesUpdate"
      />
    </UiDateTimePickerPickerPopover>
  </AdminFormGroup>
</template>

<script setup lang="ts">
  import { useDateTimePicker } from '~/composables/useDateTimePicker'

  interface Props {
    modelValue?: string | null
    mode?: 'date' | 'time' | 'datetime'
    label?: string
    id?: string
    placeholder?: string
    min?: string
    max?: string
    required?: boolean
    disabled?: boolean
    error?: string
    helpText?: string
    hint?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    mode: 'date',
    modelValue: '',
    label: undefined,
    id: undefined,
    placeholder: undefined,
    min: undefined,
    max: undefined,
    required: false,
    disabled: false,
    error: undefined,
    helpText: undefined,
    hint: undefined,
  })

  const emit = defineEmits<{
    'update:modelValue': [value: string]
    'blur': []
  }>()

  const { parseValue, formatDisplay, toEmitValue } = useDateTimePicker()

  const inputId = computed(() => props.id || `dtp-${Math.random().toString(36).slice(2, 9)}`)

  const triggerRef = ref<HTMLElement | null>(null)
  const isOpen = ref(false)

  // Working state (modified while popover is open, emitted on selection)
  const workingDate = ref<Date | null>(null)
  const workingHours = ref(0)
  const workingMinutes = ref(0)

  // View state for calendar navigation
  const viewMonth = ref(new Date().getMonth())
  const viewYear = ref(new Date().getFullYear())

  // Parse min/max
  const parsedMin = computed(() => {
    if (!props.min) return null
    const d = new Date(props.min)
    return isNaN(d.getTime()) ? null : d
  })

  const parsedMax = computed(() => {
    if (!props.max) return null
    const d = new Date(props.max)
    return isNaN(d.getTime()) ? null : d
  })

  const effectivePlaceholder = computed(() => {
    if (props.placeholder) return props.placeholder
    switch (props.mode) {
      case 'time': return 'Select time'
      case 'datetime': return 'Select date and time'
      default: return 'Select date'
    }
  })

  const displayValue = computed(() =>
    formatDisplay(workingDate.value, workingHours.value, workingMinutes.value, props.mode),
  )

  // Sync working state from modelValue
  function syncFromModel() {
    const parsed = parseValue(props.modelValue, props.mode)
    workingDate.value = parsed.date
    workingHours.value = parsed.hours
    workingMinutes.value = parsed.minutes

    if (parsed.date) {
      viewMonth.value = parsed.date.getMonth()
      viewYear.value = parsed.date.getFullYear()
    }
  }

  // Initialize
  syncFromModel()

  watch(() => props.modelValue, syncFromModel)

  function emitValue() {
    const value = toEmitValue(workingDate.value, workingHours.value, workingMinutes.value, props.mode)
    emit('update:modelValue', value)
  }

  function toggleOpen() {
    if (props.disabled) return
    isOpen.value = !isOpen.value
  }

  function close() {
    isOpen.value = false
  }

  function handleBlur() {
    emit('blur')
  }

  function handleDateSelect(date: Date) {
    workingDate.value = date
    emitValue()

    // Auto-close in date-only mode
    if (props.mode === 'date') {
      close()
    }
  }

  function handleHoursUpdate(hours: number) {
    workingHours.value = hours
    emitValue()
  }

  function handleMinutesUpdate(minutes: number) {
    workingMinutes.value = minutes
    emitValue()
  }
</script>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx vue-tsc --noEmit 2>&1 | grep -i "DateTimePicker\|error" | head -20`
Expected: No errors mentioning DateTimePicker

- [ ] **Step 3: Commit**

```bash
git add components/ui/DateTimePicker.vue
git commit -m "feat(ui): add main UiDateTimePicker orchestrator component"
```

---

## Task 8: Write component integration tests

**Files:**
- Create: `ghana-audit-service/tests/unit/components/ui/DateTimePicker.test.ts`

- [ ] **Step 1: Write integration tests**

The test file follows the same pattern as `tests/unit/components/ui/BaseCard.test.ts` — inline component definition for testing in happy-dom without full Nuxt runtime.

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useDateTimePicker } from '~/composables/useDateTimePicker'

// Stub globals that Nuxt auto-imports
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)

// Minimal AdminFormGroup stub
const AdminFormGroup = {
  name: 'AdminFormGroup',
  props: ['id', 'label', 'required', 'error', 'helpText', 'hint'],
  template: `<div class="form-group"><label v-if="label" :for="id">{{ label }}<span v-if="required" class="text-red-500">*</span></label><slot /></div>`,
}

// Minimal DateTimePicker for unit testing (bypasses sub-components, tests the orchestrator logic)
const DateTimePicker = {
  name: 'DateTimePicker',
  components: { AdminFormGroup },
  props: {
    modelValue: { type: String, default: '' },
    mode: { type: String, default: 'date' },
    label: { type: String, default: undefined },
    id: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    error: { type: String, default: undefined },
    helpText: { type: String, default: undefined },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props: Record<string, unknown>, { emit }: { emit: (event: string, ...args: unknown[]) => void }) {
    const { parseValue, formatDisplay, toEmitValue } = useDateTimePicker()
    const mode = computed(() => (props.mode as string) || 'date')
    const isOpen = ref(false)

    const workingDate = ref<Date | null>(null)
    const workingHours = ref(0)
    const workingMinutes = ref(0)

    function syncFromModel() {
      const parsed = parseValue(props.modelValue as string, mode.value as 'date' | 'time' | 'datetime')
      workingDate.value = parsed.date
      workingHours.value = parsed.hours
      workingMinutes.value = parsed.minutes
    }

    syncFromModel()
    watch(() => props.modelValue, syncFromModel)

    const displayValue = computed(() =>
      formatDisplay(workingDate.value, workingHours.value, workingMinutes.value, mode.value as 'date' | 'time' | 'datetime'),
    )

    const effectivePlaceholder = computed(() => {
      if (props.placeholder) return props.placeholder
      switch (mode.value) {
        case 'time': return 'Select time'
        case 'datetime': return 'Select date and time'
        default: return 'Select date'
      }
    })

    function toggleOpen() {
      if (props.disabled) return
      isOpen.value = !isOpen.value
    }

    function emitValue() {
      const value = toEmitValue(workingDate.value, workingHours.value, workingMinutes.value, mode.value as 'date' | 'time' | 'datetime')
      emit('update:modelValue', value)
    }

    return { displayValue, effectivePlaceholder, isOpen, toggleOpen, emitValue, workingDate, workingHours, workingMinutes }
  },
  template: `
    <AdminFormGroup :id="id" :label="label" :required="required" :error="error" :help-text="helpText">
      <input
        :id="id"
        type="text"
        readonly
        :value="displayValue"
        :placeholder="effectivePlaceholder"
        :disabled="disabled"
        :class="['form-input', error ? 'border-red-500' : '', disabled ? 'opacity-50' : '']"
        @click="toggleOpen"
      />
    </AdminFormGroup>
  `,
}

describe('UiDateTimePicker', () => {
  describe('rendering', () => {
    it('renders with label and required indicator', () => {
      const wrapper = mount(DateTimePicker, {
        props: { label: 'Start Date', required: true, id: 'start' },
      })

      expect(wrapper.find('label').text()).toContain('Start Date')
      expect(wrapper.find('.text-red-500').exists()).toBe(true)
    })

    it('renders the input as readonly', () => {
      const wrapper = mount(DateTimePicker)
      const input = wrapper.find('input')
      expect(input.attributes('readonly')).toBeDefined()
    })

    it('shows error class when error prop is set', () => {
      const wrapper = mount(DateTimePicker, {
        props: { error: 'Required field' },
      })

      expect(wrapper.find('input').classes()).toContain('border-red-500')
    })

    it('is disabled when disabled prop is true', () => {
      const wrapper = mount(DateTimePicker, {
        props: { disabled: true },
      })

      expect(wrapper.find('input').attributes('disabled')).toBeDefined()
      expect(wrapper.find('input').classes()).toContain('opacity-50')
    })
  })

  describe('placeholders', () => {
    it('shows "Select date" for date mode', () => {
      const wrapper = mount(DateTimePicker, { props: { mode: 'date' } })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Select date')
    })

    it('shows "Select time" for time mode', () => {
      const wrapper = mount(DateTimePicker, { props: { mode: 'time' } })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Select time')
    })

    it('shows "Select date and time" for datetime mode', () => {
      const wrapper = mount(DateTimePicker, { props: { mode: 'datetime' } })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Select date and time')
    })

    it('uses custom placeholder when provided', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'date', placeholder: 'Pick a date' },
      })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Pick a date')
    })
  })

  describe('display formatting', () => {
    it('displays formatted date for date mode', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'date', modelValue: '2026-05-14' },
      })

      const value = wrapper.find('input').element.value
      expect(value).toContain('14')
      expect(value).toContain('May')
      expect(value).toContain('2026')
    })

    it('displays formatted time for time mode', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'time', modelValue: '14:30' },
      })

      expect(wrapper.find('input').element.value).toBe('2:30 PM')
    })

    it('displays formatted datetime for datetime mode', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'datetime', modelValue: '2026-05-14T10:30:00.000Z' },
      })

      const value = wrapper.find('input').element.value
      expect(value).toContain('14')
      expect(value).toContain('May')
      expect(value).toContain('10:30 AM')
    })

    it('shows empty when no value', () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'date', modelValue: '' },
      })

      expect(wrapper.find('input').element.value).toBe('')
    })
  })

  describe('interaction', () => {
    it('toggles open state on click when not disabled', async () => {
      const wrapper = mount(DateTimePicker)
      const input = wrapper.find('input')

      await input.trigger('click')
      expect(wrapper.vm.isOpen).toBe(true)

      await input.trigger('click')
      expect(wrapper.vm.isOpen).toBe(false)
    })

    it('does not toggle when disabled', async () => {
      const wrapper = mount(DateTimePicker, {
        props: { disabled: true },
      })

      await wrapper.find('input').trigger('click')
      expect(wrapper.vm.isOpen).toBe(false)
    })
  })

  describe('model sync', () => {
    it('updates display when modelValue changes', async () => {
      const wrapper = mount(DateTimePicker, {
        props: { mode: 'time', modelValue: '10:00' },
      })

      expect(wrapper.find('input').element.value).toBe('10:00 AM')

      await wrapper.setProps({ modelValue: '15:30' })
      expect(wrapper.find('input').element.value).toBe('3:30 PM')
    })
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm run test:run tests/unit/components/ui/DateTimePicker.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/components/ui/DateTimePicker.test.ts
git commit -m "test(ui): add UiDateTimePicker component integration tests"
```

---

## Task 9: Migrate admin pages from `AdminDatePicker` to `UiDateTimePicker`

**Files to modify (14 files):** Every `AdminFormAdminDatePicker` usage is replaced with `UiDateTimePicker`. The prop mapping is:
- `type="date"` → `mode="date"`
- `type="datetime-local"` → `mode="datetime"`
- All other props (`v-model`, `label`, `required`, `:error`, `help-text`, `v-if`) remain the same.

- [ ] **Step 1: Migrate events pages (create + edit)**

In `pages/admin/events/create.vue`, replace:
```vue
<AdminFormAdminDatePicker
  v-model="form.startDate"
  label="Start Date"
  type="datetime-local"
  required
  :error="errors.startDate"
/>
<AdminFormAdminDatePicker
  v-model="form.endDate"
  label="End Date"
  type="datetime-local"
  :error="errors.endDate"
/>
```
With:
```vue
<UiDateTimePicker
  v-model="form.startDate"
  label="Start Date"
  mode="datetime"
  required
  :error="errors.startDate"
/>
<UiDateTimePicker
  v-model="form.endDate"
  label="End Date"
  mode="datetime"
  :error="errors.endDate"
/>
```

In `pages/admin/events/[id]/edit.vue`, apply the same replacement (same two fields, same props but with extra indentation).

- [ ] **Step 2: Migrate tenders pages (create + edit)**

In `pages/admin/tenders/create.vue`, replace all three instances:
```vue
<AdminFormAdminDatePicker
  v-model="form.submissionDeadline"
  label="Submission Deadline"
  type="datetime-local"
  required
  :error="errors.submissionDeadline"
/>
<AdminFormAdminDatePicker
  v-model="form.openingDate"
  label="Bid Opening Date"
  type="datetime-local"
/>
<AdminFormAdminDatePicker
  v-model="form.publishedAt"
  label="Published Date"
  type="datetime-local"
  help-text="When this tender was/will be published"
/>
```
With:
```vue
<UiDateTimePicker
  v-model="form.submissionDeadline"
  label="Submission Deadline"
  mode="datetime"
  required
  :error="errors.submissionDeadline"
/>
<UiDateTimePicker
  v-model="form.openingDate"
  label="Bid Opening Date"
  mode="datetime"
/>
<UiDateTimePicker
  v-model="form.publishedAt"
  label="Published Date"
  mode="datetime"
  help-text="When this tender was/will be published"
/>
```

Apply the same replacement pattern to `pages/admin/tenders/[id]/edit.vue`.

- [ ] **Step 3: Migrate vacancies pages (create + edit)**

In `pages/admin/vacancies/create.vue`, replace:
```vue
<AdminFormAdminDatePicker
  v-model="form.deadline"
  label="Application Deadline"
  type="date"
  required
  :error="errors.deadline"
/>
<AdminFormAdminDatePicker
  v-model="form.publishedAt"
  label="Published Date"
  type="datetime-local"
  help-text="When this vacancy was/will be published"
/>
```
With:
```vue
<UiDateTimePicker
  v-model="form.deadline"
  label="Application Deadline"
  mode="date"
  required
  :error="errors.deadline"
/>
<UiDateTimePicker
  v-model="form.publishedAt"
  label="Published Date"
  mode="datetime"
  help-text="When this vacancy was/will be published"
/>
```

Apply the same pattern to `pages/admin/vacancies/[id]/edit.vue`.

- [ ] **Step 4: Migrate single-instance pages**

Each of these files has one `AdminFormAdminDatePicker` → `UiDateTimePicker` replacement. The pattern is the same for all of them:

**`pages/admin/news/create.vue`** and **`pages/admin/news/[id]/edit.vue`:**
```vue
<!-- Before -->
<AdminFormAdminDatePicker v-if="form.isPublished" v-model="form.publishedAt" label="Publish Date" type="datetime-local" />
<!-- After -->
<UiDateTimePicker v-if="form.isPublished" v-model="form.publishedAt" label="Publish Date" mode="datetime" />
```

**`pages/admin/reports/create.vue`** and **`pages/admin/reports/[id]/edit.vue`:**
Same pattern — `v-if="form.isPublished"`, `v-model="form.publishedAt"`, `label="Publish Date"`, `type="datetime-local"` → `mode="datetime"`.

**`pages/admin/publications/create.vue`** and **`pages/admin/publications/[id]/edit.vue`:**
Same pattern.

**`pages/admin/videos/create.vue`** and **`pages/admin/videos/[id]/edit.vue`:**
Same pattern.

- [ ] **Step 5: Verify no remaining AdminDatePicker references**

Run: `grep -rn "AdminFormAdminDatePicker\|AdminDatePicker" pages/ --include="*.vue"`
Expected: No output (zero matches)

- [ ] **Step 6: Run typecheck**

Run: `npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add pages/admin/
git commit -m "refactor(admin): migrate all pages from AdminDatePicker to UiDateTimePicker"
```

---

## Task 10: Delete old `AdminDatePicker` and run full quality gates

**Files:**
- Delete: `ghana-audit-service/components/admin/form/AdminDatePicker.vue`

- [ ] **Step 1: Verify no remaining references to AdminDatePicker anywhere**

Run: `grep -rn "AdminDatePicker" --include="*.vue" --include="*.ts" .`
Expected: No output (the component file itself is the only match, and we're about to delete it)

- [ ] **Step 2: Delete the old component**

```bash
rm components/admin/form/AdminDatePicker.vue
```

- [ ] **Step 3: Run all quality gates**

```bash
npm run test:run && npm run lint && npm run typecheck
```

Expected: All tests pass, no lint errors, no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(admin): remove deprecated AdminDatePicker component"
```

- [ ] **Step 5: Verify branch is clean and ready**

```bash
git status
git log --oneline feature/date-time-picker --not main
```

Expected: Clean working tree. Commit history shows ~8-10 commits covering composable, sub-components, main component, tests, migration, and cleanup.

---

## Summary

| Task | What it produces |
|------|-----------------|
| 1 | Branch + directory scaffold |
| 2 | Failing composable tests (contract definition) |
| 3 | Passing composable implementation |
| 4 | CalendarPanel sub-component |
| 5 | TimeWheels sub-component |
| 6 | PickerPopover sub-component |
| 7 | Main DateTimePicker orchestrator |
| 8 | Component integration tests |
| 9 | Migration of all 14 admin pages |
| 10 | Cleanup + full quality gate run |
