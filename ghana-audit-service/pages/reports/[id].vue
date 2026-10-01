<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: $t('common.reports'), path: localePath('/reports') },
        {
          label: report?.title || $t('reports.detail.fallbackTitle'),
          path: localePath(`/reports/${route.params.id}`)
        }
      ]"
    />

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container flex justify-center py-12">
        <UiLoadingSpinner />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error || !report" class="section">
      <div class="container text-center py-12">
        <Icon
          name="heroicons:document-text"
          class="w-16 h-16 text-primary mb-4 mx-auto"
          aria-hidden="true"
        />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t('reports.detail.notFoundTitle') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{ $t('reports.detail.notFoundBody') }}
        </p>
        <NuxtLink :to="localePath('/reports')" class="btn-primary">
          {{ $t('reports.detail.backToReports') }}
        </NuxtLink>
      </div>
    </div>

    <!-- Report Content -->
    <template v-else>
      <!-- Report Header -->
      <section
        class="on-brand relative overflow-hidden bg-gradient-to-br from-primary to-primary-dark text-white"
      >
        <div
          class="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-2xl pointer-events-none"
          aria-hidden="true"
        />
        <div class="container relative py-10 md:py-14">
          <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
            <div class="max-w-3xl">
              <div class="flex flex-wrap items-center gap-3 mb-4">
                <!-- Translucent chip: the coloured category badges vanish on the green header -->
                <span
                  class="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-inset ring-white/30"
                >
                  {{ categoryLabel }}
                </span>
                <span v-if="report.year" class="text-sm font-semibold tracking-wide text-white/80">
                  {{ report.year }}
                </span>
              </div>

              <h1
                class="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-white leading-tight mb-5 text-balance"
              >
                {{ report.title }}
              </h1>

              <dl class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90 mb-8">
                <div v-if="publishedLabel">
                  <dt class="sr-only">{{ $t('reports.detail.published') }}</dt>
                  <dd class="flex items-center gap-2">
                    <Icon name="heroicons:calendar" class="w-4 h-4" aria-hidden="true" />
                    {{ $t('reports.detail.publishedOn', { date: publishedLabel }) }}
                  </dd>
                </div>
                <div>
                  <dt class="sr-only">{{ $t('reports.detail.format') }}</dt>
                  <dd class="flex items-center gap-2">
                    <Icon name="heroicons:document-text" class="w-4 h-4" aria-hidden="true" />
                    {{ $t('reports.detail.formatPdf') }}
                  </dd>
                </div>
                <div v-if="fileSizeLabel">
                  <dt class="sr-only">{{ $t('reports.detail.fileSize') }}</dt>
                  <dd class="flex items-center gap-2">
                    <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" aria-hidden="true" />
                    {{ fileSizeLabel }}
                  </dd>
                </div>
              </dl>

              <div class="flex flex-wrap gap-3">
                <!-- Inline reading needs a tablet-sized screen; phones get the download -->
                <button type="button" class="btn-accent hidden sm:inline-flex" @click="readOnline">
                  <Icon name="heroicons:book-open" class="w-5 h-5" aria-hidden="true" />
                  {{ $t('reports.reader.readOnline') }}
                </button>
                <a
                  :href="report.fileUrl"
                  download
                  class="btn border-2 border-white/70 text-white hover:bg-white hover:text-primary-dark focus-visible:ring-accent focus-visible:ring-offset-primary"
                >
                  <Icon name="heroicons:arrow-down-tray" class="w-5 h-5" aria-hidden="true" />
                  {{ $t('common.downloadPdf') }}
                </a>
              </div>
            </div>

            <!-- Cover -->
            <div class="hidden lg:block" aria-hidden="true">
              <div class="relative mx-auto w-full max-w-[15rem]">
                <div class="absolute inset-0 translate-x-3 translate-y-3 rounded-xl bg-black/20" />
                <div
                  class="relative aspect-[3/4] rounded-xl overflow-hidden bg-white ring-1 ring-white/20 shadow-2xl"
                >
                  <UiBaseImage
                    :src="report.thumbnail"
                    fallback-src="/img/reports/default-cover.png"
                    alt=""
                    class="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Report Body -->
      <section class="section">
        <div class="container">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 min-w-0 space-y-8">
              <!-- Summary -->
              <article
                v-if="summaryHtml"
                class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8"
                aria-labelledby="report-summary-heading"
              >
                <h2
                  id="report-summary-heading"
                  class="flex items-center gap-2 text-xl font-heading font-semibold text-gray-900 dark:text-white mb-4"
                >
                  <Icon
                    name="heroicons:document-magnifying-glass"
                    class="w-6 h-6 text-primary dark:text-primary-200"
                    aria-hidden="true"
                  />
                  {{ $t('reports.detail.summaryTitle') }}
                </h2>
                <!-- eslint-disable-next-line vue/no-v-html -- content sanitized via sanitizeHtml() (DOMPurify) -->
                <div class="prose dark:prose-invert max-w-none" v-html="summaryHtml"></div>
              </article>

              <!-- PDF Reader: loads only when the visitor chooses to read online -->
              <ReportsPdfReader
                ref="reader"
                :file-url="report.fileUrl"
                :title="report.title"
                :file-size="report.fileSize"
              />
            </div>

            <!-- Sidebar -->
            <aside class="lg:col-span-1" :aria-label="$t('reports.detail.detailsTitle')">
              <div class="lg:sticky lg:top-24 space-y-6">
                <div
                  class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <h2
                    class="px-6 pt-6 text-lg font-heading font-semibold text-gray-900 dark:text-white"
                  >
                    {{ $t('reports.detail.detailsTitle') }}
                  </h2>

                  <dl class="px-6 py-2 divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                    <div class="flex items-center justify-between gap-4 py-3">
                      <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Icon name="heroicons:tag" class="w-4 h-4" aria-hidden="true" />
                        {{ $t('common.category') }}
                      </dt>
                      <dd class="text-right font-medium text-gray-900 dark:text-white">
                        {{ categoryLabel }}
                      </dd>
                    </div>
                    <div v-if="report.year" class="flex items-center justify-between gap-4 py-3">
                      <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Icon name="heroicons:folder" class="w-4 h-4" aria-hidden="true" />
                        {{ $t('common.year') }}
                      </dt>
                      <dd class="text-right font-medium text-gray-900 dark:text-white">
                        {{ report.year }}
                      </dd>
                    </div>
                    <div v-if="publishedLabel" class="flex items-center justify-between gap-4 py-3">
                      <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Icon name="heroicons:calendar" class="w-4 h-4" aria-hidden="true" />
                        {{ $t('reports.detail.published') }}
                      </dt>
                      <dd class="text-right font-medium text-gray-900 dark:text-white">
                        {{ publishedLabel }}
                      </dd>
                    </div>
                    <div class="flex items-center justify-between gap-4 py-3">
                      <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Icon name="heroicons:document-text" class="w-4 h-4" aria-hidden="true" />
                        {{ $t('reports.detail.format') }}
                      </dt>
                      <dd class="text-right font-medium text-gray-900 dark:text-white">PDF</dd>
                    </div>
                    <div v-if="fileSizeLabel" class="flex items-center justify-between gap-4 py-3">
                      <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Icon name="heroicons:scale" class="w-4 h-4" aria-hidden="true" />
                        {{ $t('reports.detail.fileSize') }}
                      </dt>
                      <dd class="text-right font-medium text-gray-900 dark:text-white">
                        {{ fileSizeLabel }}
                      </dd>
                    </div>
                  </dl>

                  <div
                    class="p-6 space-y-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40"
                  >
                    <UiDownloadButton :href="report.fileUrl" block>
                      {{
                        fileSizeLabel
                          ? $t('reports.reader.downloadWithSize', { size: fileSizeLabel })
                          : $t('common.downloadPdf')
                      }}
                    </UiDownloadButton>
                    <button type="button" class="btn-outline btn-sm w-full" @click="shareReport">
                      <Icon
                        v-if="copied"
                        name="heroicons:check"
                        class="w-4 h-4"
                        aria-hidden="true"
                      />
                      <Icon v-else name="heroicons:link" class="w-4 h-4" aria-hidden="true" />
                      {{
                        copied
                          ? $t('reports.detail.linkCopied')
                          : canShare
                            ? $t('reports.detail.share')
                            : $t('reports.detail.copyLink')
                      }}
                    </button>
                    <p class="sr-only" aria-live="polite">
                      {{ copied ? $t('reports.detail.linkCopied') : '' }}
                    </p>
                  </div>
                </div>

                <NuxtLink
                  :to="localePath('/reports')"
                  class="inline-flex items-center gap-2 text-sm font-semibold text-primary dark:text-primary-200 hover:underline"
                >
                  <Icon name="heroicons:arrow-left" class="w-4 h-4" aria-hidden="true" />
                  {{ $t('reports.detail.backToReports') }}
                </NuxtLink>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <!-- Related Reports -->
      <section
        v-if="relatedReports.length > 0"
        class="section bg-gray-50 dark:bg-gray-900"
        aria-labelledby="related-reports-heading"
      >
        <div class="container">
          <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2
                id="related-reports-heading"
                class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-2"
              >
                {{ $t('reports.detail.relatedTitle') }}
              </h2>
              <p class="text-gray-600 dark:text-gray-400">
                {{ $t('reports.detail.relatedDescription', { category: categoryLabel }) }}
              </p>
            </div>
            <UiViewAllLink
              :to="localePath('/reports')"
              :label="$t('home.viewAllReports')"
              variant="text"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ReportsReportCard
              v-for="related in relatedReports"
              :key="related.id"
              :report="related"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AuditReport, PaginatedResponse } from '~/types'
  import { htmlToPlainText } from '~/utils/htmlToPlainText'
  import { sanitizeHtml } from '~/utils/sanitizeHtml'

  const route = useRoute()
  const { t } = useI18n()
  const localePath = useLocalePath()
  const { formatDateLong } = useLocaleDate()
  const { getAuditCategoryLabel } = useCategoryBadge()
  const { getReportSchema, getBreadcrumbSchema } = useSchemaOrg()

  // Fetch report
  const {
    data: report,
    pending,
    error
  } = await useFetch<AuditReport>(`/api/reports/${route.params.id}`)

  // Related reports: same category, excluding this one. One extra is requested
  // so there are still three to show after filtering the current report out.
  const { data: relatedResponse } = useFetch<PaginatedResponse<AuditReport>>('/api/reports', {
    query: { category: report.value?.category, perPage: 4 },
    immediate: !!report.value,
    lazy: true
  })
  const relatedReports = computed(() =>
    (relatedResponse.value?.data ?? []).filter((r) => r.id !== report.value?.id).slice(0, 3)
  )

  const categoryLabel = computed(() =>
    report.value ? t(`reports.categories.${report.value.category}`) : ''
  )
  const publishedLabel = computed(() =>
    report.value?.publishedAt ? formatDateLong(report.value.publishedAt) : ''
  )
  const fileSizeLabel = computed(() =>
    report.value?.fileSize && report.value.fileSize !== 'N/A' ? report.value.fileSize : null
  )
  // Summaries are authored in the admin rich-text editor.
  const summaryHtml = computed(() =>
    htmlToPlainText(report.value?.summary) ? sanitizeHtml(report.value?.summary) : ''
  )

  // ── Actions ───────────────────────────────────────────────────

  const reader = ref<{ read: () => void } | null>(null)

  function readOnline() {
    reader.value?.read()
  }

  const { share, isSupported: canShare } = useShare()
  const { copy, copied } = useClipboard({ copiedDuring: 2500, legacy: true })

  async function shareReport() {
    const url = window.location.href
    if (canShare.value) {
      try {
        await share({ title: report.value?.title, url })
      } catch {
        // Share sheet dismissed — nothing to do.
      }
      return
    }
    await copy(url)
  }

  // ── SEO with structured data ──────────────────────────────────

  watchEffect(() => {
    if (report.value) {
      const schemas = [
        getReportSchema({
          title: report.value.title,
          summary: htmlToPlainText(report.value.summary),
          publishedAt: report.value.publishedAt,
          category: getAuditCategoryLabel(report.value.category),
          fileUrl: report.value.fileUrl,
          id: report.value.id
        }),
        getBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'A-G Reports', url: '/reports' },
          { name: report.value.title, url: `/reports/${report.value.id}` }
        ])
      ]

      useHead({
        script: [
          {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(schemas)
          }
        ]
      })
    }
  })

  useSeoMeta({
    title: () => (report.value ? `${report.value.title}` : 'Report'),
    // Flattened: summaries are rich text, and markup in a meta description ships
    // escaped tags straight into search results and link previews.
    description: () =>
      htmlToPlainText(report.value?.summary) || 'Audit report from the Ghana Audit Service'
  })
</script>
