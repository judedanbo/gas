<template>
  <article
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex flex-col transition-all hover:border-primary hover:shadow-lg"
  >
    <div class="flex justify-between items-center mb-3">
      <UiBadge :variant="getAuditCategoryVariant(report.category)" size="sm">
        {{ getAuditCategoryLabel(report.category) }}
      </UiBadge>
      <span class="text-sm font-semibold text-gray-500 dark:text-gray-400">{{ report.year }}</span>
    </div>

    <h3 class="text-lg font-semibold leading-snug mb-3">
      <NuxtLink
        :to="`/reports/${report.id}`"
        class="text-gray-900 dark:text-white no-underline transition-colors hover:text-primary"
      >
        {{ report.title }}
      </NuxtLink>
    </h3>

    <p
      v-if="report.summary"
      class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4 flex-grow line-clamp-3"
    >
      {{ report.summary }}
    </p>

    <div class="flex gap-4 mb-4">
      <UiIconText icon="calendar" size="xs" color="muted" gap="sm">
        {{ formatDate(report.publishedAt) }}
      </UiIconText>
      <UiIconText icon="file" size="xs" color="muted" gap="sm">
        {{ report.fileSize }}
      </UiIconText>
    </div>

    <div class="flex gap-2 mt-auto">
      <NuxtLink :to="`/reports/${report.id}`" class="btn-outline btn-sm flex-1 justify-center">
        {{ $t('common.viewDetails') }}
      </NuxtLink>

      <UiDownloadButton :href="report.fileUrl" variant="primary" size="sm" class="flex-1">
        {{ $t('common.downloadPdf') }}
      </UiDownloadButton>
    </div>
  </article>
</template>

<script setup lang="ts">
  import type { AuditReport } from '~/types'

  interface Props {
    report: AuditReport
  }

  defineProps<Props>()

  const { getAuditCategoryVariant, getAuditCategoryLabel } = useCategoryBadge()
  const { formatDateShort } = useLocaleDate()

  function formatDate(dateStr: string): string {
    return formatDateShort(dateStr)
  }
</script>
