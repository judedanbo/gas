# UiDateTimePicker Component Design

## Overview

A custom-built, themed date/time picker component for the Ghana Audit Service Nuxt 3 app. Replaces the existing `AdminDatePicker` with a unified component usable across both the public frontend and admin sections.

## Requirements

- **Three modes** via a `mode` prop: `date`, `time`, `datetime`
- **Custom calendar popover** styled with Ghana theme colors (primary green `#006B3F`, gold `#FCD116`, red `#CE1126`)
- **Scrollable time wheels** (iOS-style) for hour/minute selection with AM/PM toggle (12-hour format)
- **Light and dark mode** support via Tailwind `dark:` classes (class-based, already configured)
- **WCAG 2.1 AA** compliance: keyboard navigation, ARIA roles, focus management, contrast
- **No external date library** — uses native `Date` and `Intl` APIs (consistent with rest of codebase)
- **v-model binding** emitting ISO 8601 strings
- **Consistent styling** with existing `form-input` CSS class and `AdminFormGroup` wrapper

## Component API

**File:** `components/ui/DateTimePicker.vue`
**Auto-import name:** `<UiDateTimePicker />`

```typescript
interface Props {
  modelValue?: string | null          // ISO 8601 string (or '' for empty)
  mode?: 'date' | 'time' | 'datetime' // controls which panels show (default: 'date')
  label?: string
  id?: string
  placeholder?: string
  min?: string                        // ISO min bound
  max?: string                        // ISO max bound
  required?: boolean
  disabled?: boolean
  error?: string
  helpText?: string
  hint?: string                       // parenthetical after label
}

interface Emits {
  'update:modelValue': [value: string]
  'blur': []
}
```

### Usage Examples

```vue
<!-- Date only -->
<UiDateTimePicker v-model="form.publishedAt" mode="date" label="Publish Date" required />

<!-- Time only -->
<UiDateTimePicker v-model="form.startTime" mode="time" label="Start Time" />

<!-- Date + Time -->
<UiDateTimePicker v-model="form.eventStart" mode="datetime" label="Event Start" />
```

### Value Format

| Mode | Emitted format | Example |
|------|---------------|---------|
| `date` | `YYYY-MM-DD` | `"2026-05-14"` |
| `time` | `HH:mm` (24h internal) | `"10:30"` |
| `datetime` | Full ISO 8601 | `"2026-05-14T10:30:00.000Z"` |

## Architecture

### File Structure

```
components/ui/
  DateTimePicker.vue              <- main entry (orchestrator)
  date-time-picker/
    CalendarPanel.vue             <- month grid with navigation
    TimeWheels.vue                <- scrollable hour/min wheels + AM/PM
    PickerPopover.vue             <- floating dropdown container

composables/
  useDateTimePicker.ts            <- date math, formatting, parsing (no DOM)
```

### State Flow

```
UiDateTimePicker (owns modelValue, open/closed state)
  +-- text input (displays formatted date/time, readonly, click to open)
  +-- PickerPopover (teleported to <body>, positioned below input)
       +-- CalendarPanel (emits @select-date)       [mode: date | datetime]
       +-- TimeWheels (emits @select-time)           [mode: time | datetime]
```

- The parent holds a working `selectedDate` ref. Sub-components emit granular events, and the parent merges them into the final ISO string.
- The text input is readonly. Users click it to open the popover.

### Mode Composition

| Mode | What renders inside PickerPopover |
|------|-----------------------------------|
| `date` | `CalendarPanel` only |
| `time` | `TimeWheels` only |
| `datetime` | `CalendarPanel` on top, divider, `TimeWheels` below |

## Component Details

### CalendarPanel

**Layout:**
- Month/year header with left/right arrows
- Clicking month/year text opens a quick-select grid (months + year arrows) for jumping to distant dates
- 7-column weekday header row (Mo Tu We Th Fr Sa Su)
- 6x7 grid (42 cells) — always shows full weeks, with trailing/leading days from adjacent months

**Day Cell Visual States:**

| State | Light mode | Dark mode |
|-------|-----------|-----------|
| Default | `text-gray-700 hover:bg-gray-100` | `text-gray-200 hover:bg-gray-700` |
| Today (not selected) | `ring-1 ring-primary font-semibold` | same |
| Selected | `bg-primary text-white rounded-full` | same |
| Disabled (out of min/max) | `text-gray-300 cursor-not-allowed` | `text-gray-600` |
| Trailing/leading (other month) | `text-gray-400` | `text-gray-500` |

**Props:**
```typescript
interface CalendarPanelProps {
  selectedDate?: Date | null
  currentMonth: number        // 0-11
  currentYear: number
  minDate?: Date | null
  maxDate?: Date | null
}

interface CalendarPanelEmits {
  'select-date': [date: Date]
  'update:currentMonth': [month: number]
  'update:currentYear': [year: number]
}
```

**Keyboard:** Arrow keys move focus between days, Enter selects, Escape closes popover.

### TimeWheels

**Layout:**
- Two scrollable wheels side by side: Hour (1-12) and Minute (00-59)
- A center highlight bar behind the selected row (`bg-primary/10` light, `bg-primary/20` dark)
- AM/PM toggle buttons below the wheels

**Wheel Mechanics:**
- Each wheel is a scrollable `<div>` with CSS scroll-snap (`scroll-snap-type: y mandatory`, `scroll-snap-align: center`)
- Items are ~40px tall, visible window shows 3 items (120px)
- Padding items at top/bottom allow first/last values to center
- `scrollend` event reads `scrollTop` to determine selected value
- Hidden scrollbars via `scrollbar-width: none`

**AM/PM Toggle:**
- Two pill buttons
- Active: `bg-primary text-white`
- Inactive: `bg-gray-100 text-gray-600` / `dark:bg-gray-700 dark:text-gray-300`

**Props:**
```typescript
interface TimeWheelsProps {
  hours: number          // 0-23 (internal 24h, displayed as 12h)
  minutes: number        // 0-59
  minuteStep?: number    // default 1
}

interface TimeWheelsEmits {
  'update:hours': [hours: number]
  'update:minutes': [minutes: number]
}
```

**Accessibility:** `role="listbox"` on wheels, `role="option"` on items with `aria-selected`. AM/PM uses `role="radiogroup"` with `role="radio"` children. Up/Down arrows scroll one step, Home/End jump to first/last.

### PickerPopover

**Responsibilities:**
- Wraps CalendarPanel, TimeWheels, or both depending on mode
- Teleported to `<body>` via Vue `<Teleport>`
- Positioned absolutely below the trigger input
- Handles dismiss: click outside, Escape key, tab away
- Manages focus trap while open

**Positioning (via `usePopoverPosition` in the composable):**
1. Get trigger input bounding rect
2. Place below input, aligned left
3. Flip above if bottom exceeds viewport
4. Align right if right edge exceeds viewport
5. Re-calculate on scroll/resize (throttled)

**Styling:**

| Property | Light | Dark |
|----------|-------|------|
| Background | `bg-white` | `bg-gray-800` |
| Border | `border border-gray-200` | `border border-gray-700` |
| Shadow | `shadow-lg` | `shadow-lg shadow-black/20` |
| Radius | `rounded-xl` | `rounded-xl` |
| Width | `w-[320px]` | same |

**Animation (Vue `<Transition>`):**
- Enter: `opacity-0 scale-95` -> `opacity-100 scale-100` (150ms ease-out)
- Leave: reverse (100ms ease-in)

### Trigger Input

| Mode | Icon | Display format | Placeholder |
|------|------|----------------|-------------|
| `date` | calendar | `14 May 2026` | `Select date` |
| `time` | clock | `10:30 AM` | `Select time` |
| `datetime` | calendar | `14 May 2026, 10:30 AM` | `Select date and time` |

- Readonly text input using existing `form-input` CSS class
- Icon on left, chevron-down on right (inline SVG)
- Error state: `border-red-500 focus:ring-red-500`
- Wraps with `AdminFormGroup` when `label` is provided

## Composables

### `useDateTimePicker.ts`

Located at `composables/useDateTimePicker.ts`. Pure logic, no DOM access. Unit-testable.

| Function | Purpose |
|----------|---------|
| `parseValue(value, mode)` | ISO string -> `{ date, hours, minutes }` |
| `formatDisplay(date, mode)` | Date -> localized display string via `Intl.DateTimeFormat` |
| `toEmitValue(date, hours, minutes, mode)` | Parts -> ISO string for the specific mode |
| `getCalendarDays(year, month)` | Returns 42-cell array with `{ day, month, year, isCurrentMonth }` |
| `isDateInRange(date, min, max)` | Bounds check |
| `clampToStep(minutes, step)` | Snap to nearest `minuteStep` |

### `usePopoverPosition` (inside `PickerPopover.vue`)

DOM-dependent positioning logic, scoped to the popover component (not a shared composable). Reads bounding rects, listens to scroll/resize (throttled), and computes `top`/`left` styles for the popover.

## Migration Plan

The existing `AdminDatePicker.vue` will be deprecated and replaced. All ~20 admin pages that use it will be updated:

```vue
<!-- Before -->
<AdminFormAdminDatePicker
  v-model="form.publishedAt"
  label="Publish Date"
  type="datetime-local"
  required
/>

<!-- After -->
<UiDateTimePicker
  v-model="form.publishedAt"
  label="Publish Date"
  mode="datetime"
  required
/>
```

The `type` prop (`date` | `datetime-local`) maps directly to `mode` (`date` | `datetime`). The `time` mode is net-new functionality.

## Files to Create

| File | Purpose |
|------|---------|
| `components/ui/DateTimePicker.vue` | Main entry — orchestrates mode, state, popover |
| `components/ui/date-time-picker/CalendarPanel.vue` | Month grid with nav and year/month quick-select |
| `components/ui/date-time-picker/TimeWheels.vue` | Scrollable hour/min wheels + AM/PM toggle |
| `components/ui/date-time-picker/PickerPopover.vue` | Floating container with positioning, dismiss, transitions |
| `composables/useDateTimePicker.ts` | Date math, formatting, parsing (no DOM) |

## Files to Modify

All admin pages currently using `AdminFormAdminDatePicker` — replace with `UiDateTimePicker`.

After migration is complete, `components/admin/form/AdminDatePicker.vue` can be deleted.
