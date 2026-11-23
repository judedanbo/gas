<template>
  <div class="contents">
    <!--
      Always in the DOM, even while the bar is hidden: a live region that is
      inserted together with its text is often not announced.
    -->
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

    <!--
      Sticky rather than fixed: it rides the bottom of the screen while the
      report list is in view and settles below the list at its end, so it never
      sits on top of the footer.
    -->
    <section
      v-if="visible"
      ref="bar"
      class="sticky bottom-0 z-sticky border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_16px_-10px_rgba(0,0,0,0.3)] dark:border-gray-700 dark:bg-gray-800"
      :aria-label="$t('reports.bulk.barLabel')"
    >
      <div class="container py-3">
        <p
          v-if="errorMessage"
          role="alert"
          class="mb-3 flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-300"
        >
          <Icon
            name="heroicons:exclamation-triangle"
            class="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <span>{{ errorMessage }}</span>
        </p>

        <!-- Reports are selected -->
        <div
          v-if="count > 0"
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p class="font-semibold text-gray-900 dark:text-white">{{ selectedText }}</p>
            <p v-if="detailText" class="text-sm text-gray-600 dark:text-gray-300">
              {{ detailText }}
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" class="btn-ghost btn-sm" @click="emit('clear')">
              {{ $t('reports.bulk.clear') }}
            </button>
            <!--
              aria-disabled, not disabled: a disabled button drops keyboard
              focus while the server is asked whether the download can start.
            -->
            <button
              type="button"
              class="btn-primary btn-sm aria-disabled:cursor-wait aria-disabled:opacity-60"
              :aria-disabled="checking"
              @click="onDownload"
            >
              <UiLoadingSpinner v-if="checking" size="sm" label="" />
              <Icon v-else name="heroicons:arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
              {{ checking ? $t('reports.bulk.preparing') : $t('reports.bulk.download') }}
            </button>
          </div>
        </div>

        <!-- A download has just been handed to the browser -->
        <div
          v-else-if="started"
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p
            ref="startedMessage"
            tabindex="-1"
            class="flex min-w-0 items-start gap-2 text-gray-900 focus:outline-none dark:text-white"
          >
            <Icon
              name="heroicons:check-circle"
              class="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-primary-200"
              aria-hidden="true"
            />
            <span>{{ startedText }}</span>
          </p>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              class="btn-ghost btn-sm aria-disabled:cursor-wait aria-disabled:opacity-60"
              :aria-disabled="checking"
              @click="onDownloadAgain"
            >
              {{ checking ? $t('reports.bulk.preparing') : $t('reports.bulk.downloadAgain') }}
            </button>
            <button type="button" class="btn-outline btn-sm" @click="emit('dismiss')">
              {{ $t('common.close') }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { BulkDownloadError, StartedBulkDownload } from '~/composables/useReportBulkDownload'
  import { formatBytes } from '~/utils/formatBytes'

  interface Props {
    /** Reports currently selected. */
    count: number
    /** Most reports one ZIP may hold. */
    maxFiles: number
    /** Combined size of the selected reports, as far as the listing knows. */
    estimatedBytes: number
    /** Some selected reports have no size, so the total is a lower bound. */
    hasUnknownSizes: boolean
    /** The server is being asked whether the download can start. */
    checking: boolean
    error: BulkDownloadError | null
    started: StartedBulkDownload | null
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    download: []
    'download-again': []
    clear: []
    dismiss: []
  }>()

  const { t } = useI18n()

  const bar = ref<HTMLElement | null>(null)
  const startedMessage = ref<HTMLElement | null>(null)

  const visible = computed(() => props.count > 0 || props.started !== null)

  const selectedText = computed(() =>
    t('reports.bulk.selectedCount', { count: props.count }, props.count)
  )

  const detailText = computed(() => {
    const parts: string[] = []
    if (props.estimatedBytes > 0) {
      parts.push(
        t(props.hasUnknownSizes ? 'reports.bulk.sizeAtLeast' : 'reports.bulk.sizeAbout', {
          size: formatBytes(props.estimatedBytes)
        })
      )
    }
    if (props.count >= props.maxFiles) {
      parts.push(t('reports.bulk.limitReached', { max: props.maxFiles }))
    }
    return parts.join(' · ')
  })

  const startedText = computed(() => {
    const started = props.started
    if (!started) return ''

    const text = t(
      'reports.bulk.started',
      { count: started.count, size: formatBytes(started.bytes) },
      started.count
    )
    if (started.unavailable === 0) return text
    return `${text} ${t('reports.bulk.startedUnavailable', { count: started.unavailable }, started.unavailable)}`
  })

  /** "about 40 seconds" / "about 12 minutes", for limits that clear with time. */
  function waitText(seconds: number | null): string {
    if (seconds === null) return t('reports.bulk.waitLater')
    if (seconds < 60) {
      const rounded = Math.max(1, Math.ceil(seconds))
      return t('reports.bulk.waitSeconds', { count: rounded }, rounded)
    }
    const minutes = Math.ceil(seconds / 60)
    return t('reports.bulk.waitMinutes', { count: minutes }, minutes)
  }

  const errorMessage = computed(() => {
    const error = props.error
    if (!error) return ''

    switch (error.kind) {
      case 'rate-limited': {
        const wait = waitText(error.retryAfterSeconds)
        // Part of the selection would still go through: say how much.
        return error.remaining > 0 && error.remaining < props.count
          ? t('reports.bulk.errorLimitPartial', { count: error.remaining, wait }, error.remaining)
          : t('reports.bulk.errorLimit', { wait })
      }
      case 'too-large':
        return error.totalBytes
          ? t('reports.bulk.errorTooLarge', {
              size: formatBytes(error.totalBytes),
              max: formatBytes(error.maxBytes)
            })
          : t('reports.bulk.errorTooLargeUnknown', { max: formatBytes(error.maxBytes) })
      case 'unavailable':
        return t('reports.bulk.errorUnavailable')
      default:
        return t('reports.bulk.errorFailed')
    }
  })

  // Screen-reader announcements. Errors are not included: they are rendered
  // with role="alert", which announces itself.
  const announcement = ref('')
  watch(
    () => [props.count, props.started] as const,
    ([count, started], [previousCount]) => {
      if (count > 0) {
        announcement.value =
          count >= props.maxFiles
            ? `${selectedText.value}. ${t('reports.bulk.limitReached', { max: props.maxFiles })}`
            : selectedText.value
      } else if (started) {
        announcement.value = startedText.value
      } else if (previousCount > 0) {
        announcement.value = t('reports.bulk.cleared')
      }
    }
  )

  // The button that started the download disappears with the selection. Move
  // keyboard focus to the confirmation so it is not dropped back to the top of
  // the page, but only if focus was in the bar to begin with.
  watch(
    () => props.started,
    async (started, previous) => {
      if (!started || previous) return
      const hadFocus = bar.value?.contains(document.activeElement) ?? false
      await nextTick()
      if (hadFocus) startedMessage.value?.focus()
    },
    { flush: 'pre' }
  )

  // While the bar is stuck to the bottom of the screen, keep whatever gains
  // focus (or is scrolled to) clear of it: WCAG 2.4.11 Focus Not Obscured.
  const { height } = useElementSize(bar, undefined, { box: 'border-box' })
  watch([visible, height], ([isVisible, barHeight]) => {
    const root = document.documentElement
    if (isVisible && barHeight > 0) {
      root.style.scrollPaddingBottom = `${Math.ceil(barHeight) + 16}px`
    } else {
      root.style.scrollPaddingBottom = ''
    }
  })
  onBeforeUnmount(() => {
    document.documentElement.style.scrollPaddingBottom = ''
  })

  function onDownload() {
    if (!props.checking) emit('download')
  }

  function onDownloadAgain() {
    if (!props.checking) emit('download-again')
  }
</script>
