<template>
  <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all hover:border-primary hover:shadow-lg">
    <!-- Date Badge -->
    <div class="bg-primary text-white p-4 text-center">
      <div class="text-3xl font-bold">{{ formatDay(event.startDate) }}</div>
      <div class="text-sm uppercase">{{ formatMonth(event.startDate) }}</div>
      <div class="text-xs opacity-80">{{ formatYear(event.startDate) }}</div>
    </div>

    <!-- Content -->
    <div class="p-6">
      <div class="flex items-center gap-2 mb-3">
        <UiBadge :variant="event.isVirtual ? 'info' : 'secondary'" size="sm">
          {{ event.isVirtual ? 'Virtual' : 'In-Person' }}
        </UiBadge>
        <span v-if="isPast" class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Past Event</span>
      </div>

      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {{ event.title }}
      </h3>

      <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
        {{ event.description }}
      </p>

      <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{{ formatDateRange(event.startDate, event.endDate) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{{ event.location }}</span>
        </div>
      </div>

      <div v-if="event.registrationUrl && !isPast" class="mt-4">
        <a
          :href="event.registrationUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-primary btn-sm w-full justify-center"
        >
          Register Now
        </a>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Event } from '~/types'

interface Props {
  event: Event
}

const props = defineProps<Props>()

const isPast = computed(() => new Date(props.event.startDate) < new Date())

function formatDay(dateStr: string): string {
  return new Date(dateStr).getDate().toString()
}

function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short' })
}

function formatYear(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString()
}

function formatDateRange(start: string, end?: string): string {
  const startDate = new Date(start)
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

  if (!end) {
    return startDate.toLocaleDateString('en-GB', options)
  }

  const endDate = new Date(end)

  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.getDate()} - ${endDate.toLocaleDateString('en-GB', options)}`
  }

  return `${startDate.toLocaleDateString('en-GB', options)} - ${endDate.toLocaleDateString('en-GB', options)}`
}
</script>
