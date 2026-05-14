<script setup lang="ts">
import { useDateTimePicker } from '~/composables/useDateTimePicker'

interface Props {
  hours: number // 0-23 internally, displayed as 12-hour
  minutes: number // 0-59
  minuteStep?: number // default 1
}

const props = withDefaults(defineProps<Props>(), {
  minuteStep: 1,
})

const emit = defineEmits<{
  'update:hours': [hours: number]
  'update:minutes': [minutes: number]
}>()

const { clampToStep } = useDateTimePicker()

// Refs for scroll containers
const hourWheelRef = ref<HTMLElement | null>(null)
const minuteWheelRef = ref<HTMLElement | null>(null)

// AM/PM state derived from hours prop
const isPM = computed(() => props.hours >= 12)

// 12-hour display value (1-12)
const display12Hour = computed(() => {
  const h = props.hours % 12
  return h === 0 ? 12 : h
})

// Hours list: 1-12
const hourItems = computed(() => {
  const items = []
  for (let h = 1; h <= 12; h++) {
    items.push(h)
  }
  return items
})

// Minutes list based on step
const minuteItems = computed(() => {
  const items = []
  for (let m = 0; m < 60; m += props.minuteStep) {
    items.push(m)
  }
  return items
})

// Scroll to selected values
async function scrollToSelected() {
  await nextTick()

  if (hourWheelRef.value) {
    const idx = hourItems.value.indexOf(display12Hour.value)
    if (idx >= 0) {
      hourWheelRef.value.scrollTop = idx * 40
    }
  }

  if (minuteWheelRef.value) {
    const clamped = clampToStep(props.minutes, props.minuteStep)
    const idx = minuteItems.value.indexOf(clamped)
    if (idx >= 0) {
      minuteWheelRef.value.scrollTop = idx * 40
    }
  }
}

// Handle scroll end on hour wheel
function onHourScrollEnd() {
  if (!hourWheelRef.value) return
  const idx = Math.round(hourWheelRef.value.scrollTop / 40)
  const clamped = Math.max(0, Math.min(idx, hourItems.value.length - 1))
  const h12 = hourItems.value[clamped]
  // Convert 12-hour to 0-23
  let h24: number
  if (isPM.value) {
    h24 = h12 === 12 ? 12 : h12 + 12
  } else {
    h24 = h12 === 12 ? 0 : h12
  }
  emit('update:hours', h24)
}

// Handle scroll end on minute wheel
function onMinuteScrollEnd() {
  if (!minuteWheelRef.value) return
  const idx = Math.round(minuteWheelRef.value.scrollTop / 40)
  const clamped = Math.max(0, Math.min(idx, minuteItems.value.length - 1))
  emit('update:minutes', minuteItems.value[clamped])
}

// Toggle AM/PM
function setAmPm(pm: boolean) {
  if (pm === isPM.value) return
  if (pm) {
    // AM -> PM: add 12, but 12 stays 12
    const h12 = props.hours % 12
    emit('update:hours', h12 === 0 ? 12 : h12 + 12)
  } else {
    // PM -> AM: subtract 12, but 12 becomes 0
    const h12 = props.hours % 12
    emit('update:hours', h12)
  }
}

onMounted(() => {
  scrollToSelected()
})

watch(
  () => [props.hours, props.minutes, props.minuteStep],
  () => {
    scrollToSelected()
  },
)
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <!-- Wheels row -->
    <div class="flex items-center gap-2">
      <!-- Hour wheel -->
      <div class="relative">
        <!-- Center highlight bar -->
        <div
          class="absolute left-0 right-0 top-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-lg pointer-events-none z-10"
          aria-hidden="true"
        />

        <div
          ref="hourWheelRef"
          role="listbox"
          aria-label="Hour"
          aria-orientation="vertical"
          class="scrollbar-none overflow-y-scroll relative z-0"
          style="height: 120px; scroll-snap-type: y mandatory;"
          @scrollend="onHourScrollEnd"
        >
          <!-- Top padding so first item can center -->
          <div style="height: 40px; flex-shrink: 0;" aria-hidden="true" />

          <div
            v-for="h in hourItems"
            :key="h"
            role="option"
            :aria-selected="h === display12Hour"
            style="height: 40px; scroll-snap-align: center; display: flex; align-items: center; justify-content: center;"
            :class="[
              'text-sm font-medium w-12 transition-colors',
              h === display12Hour
                ? 'text-primary font-semibold'
                : 'text-gray-600 dark:text-gray-300',
            ]"
          >
            {{ h }}
          </div>

          <!-- Bottom padding so last item can center -->
          <div style="height: 40px; flex-shrink: 0;" aria-hidden="true" />
        </div>
      </div>

      <!-- Separator -->
      <span class="text-lg font-bold text-gray-500 dark:text-gray-400 pb-0.5">:</span>

      <!-- Minute wheel -->
      <div class="relative">
        <!-- Center highlight bar -->
        <div
          class="absolute left-0 right-0 top-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-lg pointer-events-none z-10"
          aria-hidden="true"
        />

        <div
          ref="minuteWheelRef"
          role="listbox"
          aria-label="Minute"
          aria-orientation="vertical"
          class="scrollbar-none overflow-y-scroll relative z-0"
          style="height: 120px; scroll-snap-type: y mandatory;"
          @scrollend="onMinuteScrollEnd"
        >
          <!-- Top padding -->
          <div style="height: 40px; flex-shrink: 0;" aria-hidden="true" />

          <div
            v-for="m in minuteItems"
            :key="m"
            role="option"
            :aria-selected="m === minutes"
            style="height: 40px; scroll-snap-align: center; display: flex; align-items: center; justify-content: center;"
            :class="[
              'text-sm font-medium w-12 transition-colors',
              m === minutes
                ? 'text-primary font-semibold'
                : 'text-gray-600 dark:text-gray-300',
            ]"
          >
            {{ String(m).padStart(2, '0') }}
          </div>

          <!-- Bottom padding -->
          <div style="height: 40px; flex-shrink: 0;" aria-hidden="true" />
        </div>
      </div>
    </div>

    <!-- AM/PM toggle -->
    <div
      role="radiogroup"
      aria-label="AM or PM"
      class="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-600"
    >
      <button
        type="button"
        role="radio"
        :aria-checked="!isPM"
        :class="[
          'px-4 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          !isPM
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
        ]"
        @click="setAmPm(false)"
      >
        AM
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="isPM"
        :class="[
          'px-4 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isPM
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
        ]"
        @click="setAmPm(true)"
      >
        PM
      </button>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
