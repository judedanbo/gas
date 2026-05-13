<template>
  <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all hover:border-primary hover:shadow-lg">
    <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <UiBadge :variant="statusVariant" size="sm">
            {{ statusLabel }}
          </UiBadge>
          <UiBadge variant="gray" size="sm">
            {{ tender.category }}
          </UiBadge>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ tender.title }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ref: {{ tender.referenceNumber }}
        </p>
      </div>
    </div>

    <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
      {{ stripHtml(tender.description) }}
    </p>

    <div class="flex flex-wrap gap-4 mb-4 text-sm text-gray-600 dark:text-gray-300">
      <div class="flex items-center gap-1">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Deadline: {{ formatDate(tender.submissionDeadline) }}
      </div>
      <div v-if="tender.openingDate" class="flex items-center gap-1">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Opening: {{ formatDate(tender.openingDate) }}
      </div>
    </div>

    <div v-if="tender.documentUrl && tender.status === 'open'" class="flex gap-2">
      <a
        :href="tender.documentUrl"
        class="btn-primary btn-sm"
        download
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download Tender Document
      </a>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Tender } from '~/types'

interface Props {
  tender: Tender
}

const props = defineProps<Props>()

const statusVariant = computed(() => {
  switch (props.tender.status) {
    case 'open': return 'success'
    case 'closed': return 'warning'
    case 'awarded': return 'info'
    default: return 'gray'
  }
})

const statusLabel = computed(() => {
  switch (props.tender.status) {
    case 'open': return 'Open'
    case 'closed': return 'Closed'
    case 'awarded': return 'Awarded'
    default: return props.tender.status
  }
})

function stripHtml(html: string | undefined | null): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
</script>
