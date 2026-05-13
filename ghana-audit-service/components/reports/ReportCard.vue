<template>
  <article
    class="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:border-primary/40 hover:shadow-[0_1px_1px_rgba(0,107,63,0.06),0_2px_2px_rgba(0,107,63,0.06),0_4px_4px_rgba(0,107,63,0.06),0_8px_8px_rgba(0,107,63,0.06)]"
    :aria-labelledby="`report-title-${report.id}`"
  >
    <!-- Thumbnail -->
    <div class="relative bg-gray-100 dark:bg-gray-700 overflow-hidden">
      <div class="aspect-[4/3] w-full">
        <img
          :src="report.thumbnail || '/img/reports/default-cover.png'"
          alt=""
          class="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>

      <!-- Category badge overlay -->
      <div class="absolute top-3 left-3">
        <UiBadge :variant="getAuditCategoryVariant(report.category)" size="sm" class="shadow-sm">
          {{ getAuditCategoryLabel(report.category) }}
        </UiBadge>
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-col flex-grow p-4">
      <!-- Year -->
      <span class="text-xs font-semibold text-primary dark:text-primary-light tracking-wide uppercase mb-1">
        {{ new Date(report.publishedAt).getFullYear() }}
      </span>

      <!-- Title (clickable card target) -->
      <UiTooltip :text="report.title" position="bottom">
        <h3 :id="`report-title-${report.id}`" class="text-base font-heading font-semibold leading-snug mb-3 line-clamp-2">
          <NuxtLink
            :to="`/reports/${report.id}`"
            class="text-gray-900 dark:text-white no-underline transition-colors hover:text-primary after:absolute after:inset-0"
          >
            {{ report.title }}
          </NuxtLink>
        </h3>
      </UiTooltip>

      <!-- Metadata -->
      <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-auto mb-3">
        <span class="inline-flex items-center gap-1">
          <Icon name="heroicons:calendar" class="w-3.5 h-3.5" aria-hidden="true" />
          {{ formatDate(report.publishedAt) }}
        </span>
        <span v-if="report.fileSize && report.fileSize !== 'N/A'" class="inline-flex items-center gap-1">
          <Icon name="heroicons:document-arrow-down" class="w-3.5 h-3.5" aria-hidden="true" />
          {{ report.fileSize }}
        </span>
      </div>

      <!-- Download button (above the pseudo-element overlay) -->
      <UiDownloadButton
        :href="report.fileUrl"
        variant="outline"
        size="sm"
        block
        class="relative z-10"
        :aria-label="`${$t('common.downloadPdf')}: ${report.title}`"
      >
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
