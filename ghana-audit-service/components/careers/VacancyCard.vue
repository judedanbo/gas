<template>
  <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all hover:border-primary hover:shadow-lg">
    <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <UiBadge :variant="vacancy.isActive ? 'success' : 'gray'" size="sm">
            {{ vacancy.isActive ? 'Active' : 'Closed' }}
          </UiBadge>
          <UiBadge variant="secondary" size="sm">
            {{ vacancy.type }}
          </UiBadge>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
          <NuxtLink
            :to="`/careers/${vacancy.slug}`"
            class="no-underline hover:text-primary dark:hover:text-primary-light transition-colors"
          >
            {{ vacancy.title }}
          </NuxtLink>
        </h3>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 mb-4 text-sm text-gray-600 dark:text-gray-300">
      <div class="flex items-center gap-1">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        {{ vacancy.department }}
      </div>
      <div class="flex items-center gap-1">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {{ vacancy.location }}
      </div>
      <div class="flex items-center gap-1">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Deadline: {{ formatDate(vacancy.deadline) }}
      </div>
    </div>

    <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
      {{ getExcerpt(vacancy.description) }}
    </p>

    <NuxtLink
      :to="`/careers/${vacancy.slug}`"
      class="text-primary dark:text-primary-light font-medium text-sm inline-flex items-center gap-1 hover:underline"
    >
      View Details
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </NuxtLink>
  </article>
</template>

<script setup lang="ts">
import type { Vacancy } from '~/types'

interface Props {
  vacancy: Vacancy
}

defineProps<Props>()

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function getExcerpt(description: string): string {
  // Get first paragraph or first 150 characters
  const firstParagraph = description.split('\n')[0]
  return firstParagraph.length > 150 ? firstParagraph.slice(0, 150) + '...' : firstParagraph
}
</script>
