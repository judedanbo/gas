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
  modelValue: null,
  mode: 'date',
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
  blur: []
}>()

const { parseValue, formatDisplay, toEmitValue } = useDateTimePicker()

// Unique ID for accessibility
const inputId = computed(() => props.id || `dtp-${Math.random().toString(36).slice(2, 9)}`)

// Popover open state
const isOpen = ref(false)

// Trigger element ref for popover positioning
const triggerRef = ref<HTMLElement | null>(null)

// Working state
const workingDate = ref<Date | null>(null)
const workingHours = ref(0)
const workingMinutes = ref(0)

// View state for calendar
const viewMonth = ref(new Date().getMonth())
const viewYear = ref(new Date().getFullYear())

// Min/max as Date objects
const minDate = computed<Date | null>(() => {
  if (!props.min) return null
  const d = new Date(props.min)
  return isNaN(d.getTime()) ? null : d
})

const maxDate = computed<Date | null>(() => {
  if (!props.max) return null
  const d = new Date(props.max)
  return isNaN(d.getTime()) ? null : d
})

function syncFromModel() {
  const parsed = parseValue(props.modelValue, props.mode as 'date' | 'time' | 'datetime')
  workingDate.value = parsed.date
  workingHours.value = parsed.hours
  workingMinutes.value = parsed.minutes

  if (parsed.date) {
    viewMonth.value = parsed.date.getMonth()
    viewYear.value = parsed.date.getFullYear()
  }
}

syncFromModel()

watch(() => props.modelValue, syncFromModel)

const displayValue = computed(() =>
  formatDisplay(
    workingDate.value,
    workingHours.value,
    workingMinutes.value,
    props.mode as 'date' | 'time' | 'datetime',
  ),
)

const effectivePlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder
  switch (props.mode) {
    case 'time':
      return 'Select time'
    case 'datetime':
      return 'Select date and time'
    default:
      return 'Select date'
  }
})

const inputClasses = computed(() => {
  const base = 'form-input w-full pl-10 pr-10 cursor-pointer'
  const errorClass = props.error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : ''
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : ''
  return [base, errorClass, disabledClass].filter(Boolean).join(' ')
})

function openPicker() {
  if (props.disabled) return
  isOpen.value = true
}

function closePicker() {
  isOpen.value = false
  emit('blur')
}

function toggleOpen() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (!isOpen.value) {
    emit('blur')
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleOpen()
  } else if (e.key === 'Escape') {
    isOpen.value = false
    emit('blur')
  }
}

function emitValue() {
  const value = toEmitValue(
    workingDate.value,
    workingHours.value,
    workingMinutes.value,
    props.mode as 'date' | 'time' | 'datetime',
  )
  emit('update:modelValue', value)
}

function handleDateSelect(date: Date) {
  workingDate.value = date
  viewMonth.value = date.getMonth()
  viewYear.value = date.getFullYear()
  emitValue()
  // Auto-close in date-only mode
  if (props.mode === 'date') {
    isOpen.value = false
    emit('blur')
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

<template>
  <AdminFormGroup
    :id="inputId"
    :label="label"
    :required="required"
    :error="error"
    :help-text="helpText"
    :hint="hint"
  >
    <!-- Trigger input -->
    <div ref="triggerRef" class="relative">
      <!-- Left icon -->
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <!-- Clock icon for time mode -->
        <svg
          v-if="mode === 'time'"
          class="h-5 w-5 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <!-- Calendar icon for date and datetime modes -->
        <svg
          v-else
          class="h-5 w-5 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      <!-- Readonly text input -->
      <input
        :id="inputId"
        type="text"
        readonly
        :value="displayValue"
        :placeholder="effectivePlaceholder"
        :disabled="disabled"
        :class="inputClasses"
        :aria-expanded="isOpen"
        :aria-haspopup="'dialog'"
        aria-autocomplete="none"
        @click="toggleOpen"
        @keydown="handleKeydown"
      />

      <!-- Right chevron icon -->
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg
          class="h-4 w-4 text-gray-400 transition-transform duration-150"
          :class="{ 'rotate-180': isOpen }"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </div>
    </div>

    <!-- Picker Popover -->
    <UiDateTimePickerPickerPopover
      :show="isOpen"
      :trigger-ref="triggerRef"
      @close="closePicker"
    >
      <div class="p-3">
        <!-- Calendar panel (date and datetime modes) -->
        <UiDateTimePickerCalendarPanel
          v-if="mode === 'date' || mode === 'datetime'"
          :selected-date="workingDate"
          :current-month="viewMonth"
          :current-year="viewYear"
          :min-date="minDate"
          :max-date="maxDate"
          @select-date="handleDateSelect"
          @update:current-month="viewMonth = $event"
          @update:current-year="viewYear = $event"
        />

        <!-- Divider between calendar and time wheels in datetime mode -->
        <div
          v-if="mode === 'datetime'"
          class="border-t border-gray-200 dark:border-gray-700 my-3"
        />

        <!-- Time wheels (time and datetime modes) -->
        <UiDateTimePickerTimeWheels
          v-if="mode === 'time' || mode === 'datetime'"
          :hours="workingHours"
          :minutes="workingMinutes"
          @update:hours="handleHoursUpdate"
          @update:minutes="handleMinutesUpdate"
        />
      </div>
    </UiDateTimePickerPickerPopover>
  </AdminFormGroup>
</template>
