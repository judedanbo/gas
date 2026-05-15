<template>
  <article
    class="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-[0_1px_1px_rgba(0,107,63,0.06),0_2px_2px_rgba(0,107,63,0.06),0_4px_4px_rgba(0,107,63,0.06),0_8px_8px_rgba(0,107,63,0.06)]"
    :aria-labelledby="`featured-report-title-${report.id}`"
  >
    <div class="grid grid-cols-1 lg:grid-cols-5">
      <!-- Thumbnail -->
      <div class="relative bg-gray-100 dark:bg-gray-700 overflow-hidden lg:col-span-2">
        <div class="aspect-[4/3] lg:aspect-auto lg:h-full w-full">
          <img
            :src="report.thumbnail || '/img/reports/default-cover.png'"
            alt=""
            class="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>

        <!-- Category badge overlay -->
        <div class="absolute top-4 left-4">
          <UiBadge :variant="getAuditCategoryVariant(report.category)" size="md" class="shadow-sm">
            {{ getAuditCategoryLabel(report.category) }}
          </UiBadge>
        </div>
      </div>

      <!-- Content -->
      <div class="flex flex-col p-6 md:p-8 lg:col-span-3">
        <!-- Eyebrow -->
        <div class="flex items-center gap-2 mb-3">
          <Icon
            name="heroicons:star-solid"
            class="w-4 h-4 text-accent dark:text-accent"
            aria-hidden="true"
          />
          <span
            class="text-xs font-semibold text-primary dark:text-primary-light tracking-wider uppercase"
          >
            {{ $t('reports.featured.eyebrow') }}
          </span>
          <span class="text-xs text-gray-400 dark:text-gray-500" aria-hidden="true">·</span>
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
            {{ new Date(report.publishedAt).getFullYear() }}
          </span>
        </div>

        <!-- Title -->
        <h2
          :id="`featured-report-title-${report.id}`"
          class="text-2xl md:text-3xl font-heading font-bold leading-tight mb-4"
        >
          <NuxtLink
            :to="`/reports/${report.id}`"
            class="text-gray-900 dark:text-white no-underline transition-colors hover:text-primary dark:hover:text-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {{ report.title }}
          </NuxtLink>
        </h2>

        <!-- Summary -->
        <p
          v-if="report.summary"
          class="text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-6 line-clamp-3"
        >
          {{ report.summary }}
        </p>

        <!-- Metadata -->
        <div
          class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400 mb-6 mt-auto"
        >
          <span class="inline-flex items-center gap-1.5">
            <Icon name="heroicons:calendar" class="w-4 h-4" aria-hidden="true" />
            {{ formatDateShort(report.publishedAt) }}
          </span>
          <span
            v-if="report.fileSize && report.fileSize !== 'N/A'"
            class="inline-flex items-center gap-1.5"
          >
            <Icon name="heroicons:document-arrow-down" class="w-4 h-4" aria-hidden="true" />
            {{ report.fileSize }}
          </span>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap items-center gap-3">
          <UiDownloadButton
            :href="report.fileUrl"
            variant="primary"
            size="md"
            :aria-label="`${$t('common.downloadPdf')}: ${report.title}`"
          >
            {{ $t('common.downloadPdf') }}
          </UiDownloadButton>
          <UiViewAllLink
            :to="`/reports/${report.id}`"
            :label="$t('reports.featured.viewReport')"
            variant="text"
          />
        </div>
      </div>
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
</script>
