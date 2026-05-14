<script setup lang="ts">
import { useDateTimePicker } from '~/composables/useDateTimePicker'

interface Props {
  selectedDate?: Date | null
  currentMonth: number // 0-11
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const showMonthPicker = ref(false)

const calendarDays = computed(() =>
  getCalendarDays(props.currentYear, props.currentMonth),
)

const today = new Date()
const todayYear = today.getFullYear()
const todayMonth = today.getMonth()
const todayDay = today.getDate()

function isToday(day: number, month: number, year: number): boolean {
  return day === todayDay && month === todayMonth && year === todayYear
}

function isSelected(day: number, month: number, year: number): boolean {
  if (!props.selectedDate) return false
  return (
    day === props.selectedDate.getDate() &&
    month === props.selectedDate.getMonth() &&
    year === props.selectedDate.getFullYear()
  )
}

function isDisabled(day: number, month: number, year: number): boolean {
  const d = new Date(year, month, day)
  return !isDateInRange(d, props.minDate ?? null, props.maxDate ?? null)
}

function selectDay(day: number, month: number, year: number) {
  if (isDisabled(day, month, year)) return
  emit('select-date', new Date(year, month, day))
}

function prevMonth() {
  if (props.currentMonth === 0) {
    emit('update:currentMonth', 11)
    emit('update:currentYear', props.currentYear - 1)
  } else {
    emit('update:currentMonth', props.currentMonth - 1)
  }
}

function nextMonth() {
  if (props.currentMonth === 11) {
    emit('update:currentMonth', 0)
    emit('update:currentYear', props.currentYear + 1)
  } else {
    emit('update:currentMonth', props.currentMonth + 1)
  }
}

function prevYear() {
  emit('update:currentYear', props.currentYear - 1)
}

function nextYear() {
  emit('update:currentYear', props.currentYear + 1)
}

function selectMonth(monthIndex: number) {
  emit('update:currentMonth', monthIndex)
  showMonthPicker.value = false
}

function getDayCellClasses(
  day: number,
  month: number,
  year: number,
  isCurrentMonth: boolean,
): string {
  const classes: string[] = [
    'w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  ]

  if (isDisabled(day, month, year)) {
    classes.push('text-gray-300 dark:text-gray-600 cursor-not-allowed')
  } else if (isSelected(day, month, year)) {
    classes.push('bg-primary text-white font-semibold rounded-full')
  } else if (!isCurrentMonth) {
    classes.push(
      'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer',
    )
  } else if (isToday(day, month, year)) {
    classes.push(
      'ring-1 ring-primary font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer',
    )
  } else {
    classes.push(
      'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer',
    )
  }

  return classes.join(' ')
}
</script>

<template>
  <div class="select-none">
    <!-- Month quick-select overlay -->
    <div v-if="showMonthPicker" class="px-2 pb-2">
      <!-- Year navigation in quick-select -->
      <div class="flex items-center justify-between mb-2">
        <button
          type="button"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Previous year"
          @click="prevYear"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="10 12 6 8 10 4" />
          </svg>
        </button>
        <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ currentYear }}</span>
        <button
          type="button"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Next year"
          @click="nextYear"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
      </div>

      <!-- 3x4 month grid -->
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="(abbr, idx) in MONTH_ABBR"
          :key="abbr"
          type="button"
          :class="[
            'py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            idx === currentMonth
              ? 'bg-primary text-white'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
          ]"
          :aria-pressed="idx === currentMonth"
          @click="selectMonth(idx)"
        >
          {{ abbr }}
        </button>
      </div>
    </div>

    <!-- Standard calendar view -->
    <div v-else>
      <!-- Month/Year header with prev/next arrows -->
      <div class="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Previous month"
          @click="prevMonth"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="10 12 6 8 10 4" />
          </svg>
        </button>

        <button
          type="button"
          class="text-sm font-semibold text-gray-800 dark:text-gray-100 hover:text-primary dark:hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
          @click="showMonthPicker = true"
        >
          {{ MONTH_NAMES[currentMonth] }} {{ currentYear }}
        </button>

        <button
          type="button"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Next month"
          @click="nextMonth"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
      </div>

      <!-- Weekday header row -->
      <div class="grid grid-cols-7 mb-1">
        <div
          v-for="wd in WEEKDAYS"
          :key="wd"
          class="flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400 h-8"
        >
          {{ wd }}
        </div>
      </div>

      <!-- 6x7 day grid -->
      <div role="grid" class="grid grid-cols-7 gap-y-0.5">
        <div
          v-for="(cell, idx) in calendarDays"
          :key="idx"
          role="gridcell"
          class="flex items-center justify-center"
        >
          <button
            type="button"
            :class="getDayCellClasses(cell.day, cell.month, cell.year, cell.isCurrentMonth)"
            :aria-selected="isSelected(cell.day, cell.month, cell.year)"
            :aria-label="`${cell.day} ${MONTH_NAMES[cell.month]} ${cell.year}`"
            :disabled="isDisabled(cell.day, cell.month, cell.year)"
            @click="selectDay(cell.day, cell.month, cell.year)"
          >
            {{ cell.day }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
