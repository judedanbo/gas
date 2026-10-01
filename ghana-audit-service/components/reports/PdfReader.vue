<template>
  <section
    ref="rootEl"
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col scroll-mt-40"
    :class="expanded ? 'fixed inset-0 z-[300] rounded-none border-0' : 'rounded-xl shadow-sm'"
    :aria-labelledby="headingId"
  >
    <!-- Toolbar -->
    <div
      class="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
    >
      <h2
        :id="headingId"
        class="flex items-center gap-2 min-w-0 text-sm font-semibold text-gray-700 dark:text-gray-300"
      >
        <Icon name="heroicons:document-text" class="w-4 h-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ viewerTitle || $t('reports.reader.viewerTitle') }}</span>
      </h2>
      <div class="flex items-center gap-1 shrink-0">
        <a
          v-if="status !== 'error'"
          :href="fileUrl"
          download
          class="inline-flex"
          :class="toolbarButtonClass"
          :aria-label="$t('common.downloadPdf')"
        >
          <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('common.download') }}</span>
        </a>
        <button
          v-if="isViewing"
          type="button"
          class="hidden sm:inline-flex"
          :class="toolbarButtonClass"
          @click="toggleExpand"
        >
          <Icon
            v-if="expanded"
            name="heroicons:arrows-pointing-in"
            class="w-4 h-4"
            aria-hidden="true"
          />
          <Icon v-else name="heroicons:arrows-pointing-out" class="w-4 h-4" aria-hidden="true" />
          {{ expanded ? $t('reports.reader.exitFullScreen') : $t('reports.reader.fullScreen') }}
        </button>
      </div>
    </div>

    <div
      class="relative flex-1 flex flex-col"
      :class="expanded ? 'min-h-0' : isViewing ? 'sm:min-h-[80vh]' : 'min-h-[22rem]'"
    >
      <!-- Opt-in prompt: nothing is downloaded until the reader asks for it -->
      <div
        v-if="status === 'idle'"
        class="flex-1 flex items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-primary/[0.04] to-transparent dark:from-primary/10"
      >
        <!-- Tablet / desktop: read inline -->
        <div class="hidden sm:block text-center max-w-lg">
          <div class="relative mx-auto mb-6 w-20 h-20" aria-hidden="true">
            <div class="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20 rotate-6" />
            <div
              class="absolute inset-0 rounded-2xl bg-white dark:bg-gray-800 border border-primary/20 dark:border-primary/40 shadow-sm flex items-center justify-center"
            >
              <Icon name="heroicons:book-open" class="w-9 h-9 text-primary dark:text-primary-200" />
            </div>
            <span
              class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent ring-4 ring-white dark:ring-gray-800"
            />
          </div>
          <h3 class="text-xl font-heading font-semibold text-gray-900 dark:text-white mb-2">
            {{ $t('reports.reader.promptTitle') }}
          </h3>
          <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
            {{ $t('reports.reader.promptBody') }}
          </p>
          <p
            v-if="sizeLabel"
            class="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
          >
            <Icon name="heroicons:signal" class="w-4 h-4" aria-hidden="true" />
            {{ $t('reports.reader.dataNotice', { size: sizeLabel }) }}
          </p>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <button ref="readButtonEl" type="button" class="btn-primary" @click="startReading">
              <Icon name="heroicons:book-open" class="w-5 h-5" aria-hidden="true" />
              {{ $t('reports.reader.readOnline') }}
            </button>
            <a :href="fileUrl" download class="btn-outline">
              <Icon name="heroicons:arrow-down-tray" class="w-5 h-5" aria-hidden="true" />
              {{ $t('common.downloadPdf') }}
            </a>
          </div>
        </div>

        <!-- Phones can't show PDFs inline, so offer the download instead -->
        <div class="sm:hidden text-center max-w-sm">
          <Icon
            name="heroicons:device-phone-mobile"
            class="w-12 h-12 text-primary dark:text-primary-200 mx-auto mb-4"
            aria-hidden="true"
          />
          <h3 class="text-lg font-heading font-semibold text-gray-900 dark:text-white mb-2">
            {{ $t('reports.reader.mobileTitle') }}
          </h3>
          <p class="text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
            {{ $t('reports.reader.mobileBody') }}
          </p>
          <a :href="fileUrl" download class="btn-primary btn-sm">
            <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" aria-hidden="true" />
            {{
              sizeLabel
                ? $t('reports.reader.downloadWithSize', { size: sizeLabel })
                : $t('common.downloadPdf')
            }}
          </a>
        </div>
      </div>

      <!-- Downloading -->
      <div
        v-else-if="status === 'loading'"
        class="flex-1 flex items-center justify-center p-6 sm:p-10"
      >
        <div class="w-full max-w-md">
          <div class="flex items-center gap-4 mb-5">
            <div
              class="shrink-0 w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-200 flex items-center justify-center"
              aria-hidden="true"
            >
              <Icon name="heroicons:arrow-down-tray" class="w-6 h-6 motion-safe:animate-pulse" />
            </div>
            <div class="min-w-0 flex-1">
              <h3
                :id="loadingHeadingId"
                ref="loadingHeadingEl"
                tabindex="-1"
                class="text-base sm:text-lg font-heading font-semibold text-gray-900 dark:text-white focus:outline-none"
              >
                {{ $t('reports.reader.loadingTitle') }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                {{ amountText }}
              </p>
            </div>
            <span
              v-if="progress.percent !== null"
              class="text-2xl font-heading font-bold text-primary dark:text-primary-200 tabular-nums"
              aria-hidden="true"
            >
              {{ progress.percent }}%
            </span>
          </div>

          <div
            role="progressbar"
            :aria-labelledby="loadingHeadingId"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="progress.percent ?? undefined"
            :aria-valuetext="progressValueText"
            class="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
          >
            <div
              v-if="progress.percent !== null"
              class="h-full rounded-full bg-primary dark:bg-primary-200 transition-[width] duration-300 ease-out motion-reduce:transition-none"
              :style="{ width: `${progress.percent}%` }"
            />
            <div
              v-else
              class="pdf-reader-indeterminate h-full w-1/3 rounded-full bg-primary dark:bg-primary-200"
            />
          </div>

          <div
            class="mt-3 flex items-center justify-between gap-4 text-sm text-gray-600 dark:text-gray-400 tabular-nums"
          >
            <span>{{ speedText }}</span>
            <span class="text-right">{{ etaText }}</span>
          </div>

          <div class="mt-6 flex justify-center">
            <button type="button" class="btn-ghost btn-sm" @click="cancelReading">
              <Icon name="heroicons:x-mark" class="w-4 h-4" aria-hidden="true" />
              {{ $t('reports.reader.cancel') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Failed -->
      <div
        v-else-if="status === 'error'"
        class="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900"
      >
        <div class="text-center max-w-md">
          <Icon
            v-if="errorKind === 'network'"
            name="heroicons:signal-slash"
            class="w-14 h-14 text-secondary/70 mx-auto mb-4"
            aria-hidden="true"
          />
          <Icon
            v-else-if="errorKind === 'rate-limited'"
            name="heroicons:clock"
            class="w-14 h-14 text-gray-400 mx-auto mb-4"
            aria-hidden="true"
          />
          <Icon
            v-else
            name="heroicons:exclamation-circle"
            class="w-14 h-14 text-secondary/70 mx-auto mb-4"
            aria-hidden="true"
          />
          <h3
            ref="errorHeadingEl"
            tabindex="-1"
            class="text-lg font-heading font-semibold text-gray-900 dark:text-white mb-2 focus:outline-none"
          >
            {{ errorCopy.title }}
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {{ errorCopy.body }}
          </p>
          <div class="flex flex-wrap justify-center gap-3">
            <template v-if="errorKind === 'unavailable'">
              <NuxtLink :to="reportIssueLink" class="btn-primary btn-sm">
                <Icon name="heroicons:envelope" class="w-4 h-4" aria-hidden="true" />
                {{ $t('reports.reader.reportIssue') }}
              </NuxtLink>
              <button type="button" class="btn-outline btn-sm" @click="startReading">
                <Icon name="heroicons:arrow-path" class="w-4 h-4" aria-hidden="true" />
                {{ $t('errors.tryAgain') }}
              </button>
            </template>
            <template v-else>
              <button type="button" class="btn-primary btn-sm" @click="startReading">
                <Icon name="heroicons:arrow-path" class="w-4 h-4" aria-hidden="true" />
                {{ $t('errors.tryAgain') }}
              </button>
              <a :href="fileUrl" download class="btn-outline btn-sm">
                <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" aria-hidden="true" />
                {{ $t('common.downloadPdf') }}
              </a>
            </template>
          </div>
        </div>
      </div>

      <!-- Viewer -->
      <template v-else>
        <iframe
          ref="frameEl"
          :src="frameSrc"
          :title="title"
          class="w-full flex-1 bg-gray-100 dark:bg-gray-700 hidden sm:block"
          @load="frameLoaded = true"
        />
        <!-- A cross-origin file is fetched by the iframe itself; cover it until it arrives -->
        <div
          v-if="status === 'external' && !frameLoaded"
          class="absolute inset-0 hidden sm:flex items-center justify-center bg-gray-50 dark:bg-gray-900"
        >
          <UiLoadingSpinner />
        </div>

        <div
          class="flex-1 flex sm:hidden items-center justify-center p-8 bg-gray-50 dark:bg-gray-900"
        >
          <div class="text-center max-w-sm">
            <Icon
              name="heroicons:document-arrow-down"
              class="w-12 h-12 text-gray-400 mx-auto mb-4"
              aria-hidden="true"
            />
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              {{ $t('reports.reader.mobileBody') }}
            </p>
            <a :href="fileUrl" download class="btn-primary btn-sm">
              <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" aria-hidden="true" />
              {{ $t('common.downloadPdf') }}
            </a>
          </div>
        </div>
      </template>
    </div>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </section>
</template>

<script setup lang="ts">
  import { formatBytes } from '~/utils/formatBytes'
  import { splitDuration } from '~/utils/transferProgress'

  interface Props {
    fileUrl: string
    title?: string
    viewerTitle?: string
    /** Human-readable size (e.g. "4.2 MB"), shown up front so readers know the data cost. */
    fileSize?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    title: 'Audit Report PDF',
    viewerTitle: undefined,
    fileSize: undefined
  })

  const { t } = useI18n()
  const localePath = useLocalePath()

  const uid = useId()
  const headingId = `pdf-reader-${uid}`
  const loadingHeadingId = `pdf-reader-loading-${uid}`

  const toolbarButtonClass =
    'items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'

  const viewUrl = computed(() => {
    const separator = props.fileUrl.includes('?') ? '&' : '?'
    return `${props.fileUrl}${separator}view=1`
  })

  const { status, errorKind, retryAfterSeconds, objectUrl, progress, load, cancel } =
    usePdfLoader(viewUrl)

  const isViewing = computed(() => status.value === 'ready' || status.value === 'external')
  const frameSrc = computed(() =>
    status.value === 'ready' && objectUrl.value ? objectUrl.value : viewUrl.value
  )
  const frameLoaded = ref(false)

  const sizeLabel = computed(() =>
    props.fileSize && props.fileSize !== 'N/A' ? props.fileSize : null
  )

  const reportIssueLink = computed(() => ({
    path: localePath('/contact'),
    hash: '#send-message',
    query: {
      subject: 'report',
      message: `I would like to report a broken link for the report: ${props.title}. The download link does not appear to be working.`
    }
  }))

  // ── Progress copy ─────────────────────────────────────────────

  const amountText = computed(() => {
    const { loaded, total } = progress.value
    return total
      ? t('reports.reader.loadedOf', { loaded: formatBytes(loaded), total: formatBytes(total) })
      : t('reports.reader.loadedUnknown', { loaded: formatBytes(loaded) })
  })

  const speedText = computed(() => {
    const rate = progress.value.bytesPerSecond
    return rate ? t('reports.reader.speed', { speed: formatBytes(Math.round(rate)) }) : ''
  })

  function formatEta(totalSeconds: number): string {
    if (totalSeconds <= 2) return t('reports.reader.etaAlmostDone')
    const { hours, minutes, seconds } = splitDuration(totalSeconds)
    if (hours > 0) return t('reports.reader.etaHours', { hours, minutes })
    if (minutes >= 10 || (minutes > 0 && seconds === 0)) {
      return t('reports.reader.etaMinutes', { minutes })
    }
    if (minutes > 0) return t('reports.reader.etaMinutesSeconds', { minutes, seconds })
    return t('reports.reader.etaSeconds', { seconds })
  }

  // No ETA without a known size; "estimating" until the rate has settled.
  const etaText = computed(() => {
    const { total, secondsRemaining } = progress.value
    if (!total) return ''
    if (secondsRemaining === null) return t('reports.reader.etaEstimating')
    return formatEta(secondsRemaining)
  })

  const progressValueText = computed(() =>
    [
      progress.value.percent !== null ? `${progress.value.percent}%` : '',
      amountText.value,
      etaText.value
    ]
      .filter(Boolean)
      .join(', ')
  )

  const errorCopy = computed(() => {
    if (errorKind.value === 'rate-limited') {
      return {
        title: t('reports.reader.rateLimitedTitle'),
        body: retryAfterSeconds.value
          ? t('reports.reader.rateLimitedBodySeconds', { seconds: retryAfterSeconds.value })
          : t('reports.reader.rateLimitedBody')
      }
    }
    if (errorKind.value === 'network') {
      return { title: t('reports.reader.networkTitle'), body: t('reports.reader.networkBody') }
    }
    return { title: t('reports.reader.errorTitle'), body: t('reports.reader.errorBody') }
  })

  // ── Full screen ───────────────────────────────────────────────

  const expanded = ref(false)

  function toggleExpand() {
    expanded.value = !expanded.value
    document.body.style.overflow = expanded.value ? 'hidden' : ''
  }

  // ── Actions, focus and announcements ─────────────────────────

  const rootEl = ref<HTMLElement | null>(null)
  const readButtonEl = ref<HTMLButtonElement | null>(null)
  const loadingHeadingEl = ref<HTMLElement | null>(null)
  const errorHeadingEl = ref<HTMLElement | null>(null)
  const frameEl = ref<HTMLIFrameElement | null>(null)

  const announcement = ref('')
  let lastMilestone = 0
  let focusOnNextState = false

  function startReading() {
    focusOnNextState = true
    load()
  }

  function cancelReading() {
    focusOnNextState = true
    cancel()
  }

  /**
   * Entry point for callers outside the reader (e.g. a "Read online" button in
   * the page header): bring the reader into view and start loading.
   */
  function read() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rootEl.value?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    if (status.value === 'loading' || isViewing.value) return
    startReading()
  }

  defineExpose({ read, status })

  /**
   * Focus `el` only if it's actually displayed (phone layouts hide some states).
   * Without scrolling: the new state replaces the one the reader was looking at,
   * and a tall viewer would otherwise yank the page down to fit it.
   */
  function focusIfVisible(el: HTMLElement | null) {
    if (el && el.getClientRects().length > 0) el.focus({ preventScroll: true })
  }

  // Runs before the DOM swaps states, so we can tell whether focus was inside
  // the reader — the element holding it (e.g. "Read online") is about to go.
  watch(status, async (next, prev) => {
    frameLoaded.value = false

    if (next === 'loading') {
      lastMilestone = 0
      announcement.value = t('reports.reader.announceStarted')
    } else if (next === 'ready' || next === 'external') {
      announcement.value = t('reports.reader.announceReady')
    } else if (next === 'error') {
      announcement.value = errorCopy.value.title
    } else if (next === 'idle' && prev === 'loading') {
      announcement.value = t('reports.reader.announceCancelled')
    }

    if (!isViewing.value && expanded.value) toggleExpand()

    const active = document.activeElement
    const shouldFocus = focusOnNextState || (!!active && !!rootEl.value?.contains(active))
    focusOnNextState = false
    if (!shouldFocus) return

    await nextTick()
    if (next === 'loading') focusIfVisible(loadingHeadingEl.value)
    else if (next === 'error') focusIfVisible(errorHeadingEl.value)
    else if (next === 'idle') focusIfVisible(readButtonEl.value)
    else focusIfVisible(frameEl.value)
  })

  // Milestone announcements; announcing every tick would drown out a screen reader.
  watch(
    () => progress.value.percent,
    (percent) => {
      if (status.value !== 'loading' || percent === null) return
      const milestone = Math.floor(percent / 25) * 25
      if (milestone > lastMilestone && milestone < 100) {
        lastMilestone = milestone
        announcement.value = t('reports.reader.announceProgress', { percent: milestone })
      }
    }
  )

  onKeyStroke('Escape', () => {
    if (expanded.value) toggleExpand()
  })

  onUnmounted(() => {
    if (expanded.value) document.body.style.overflow = ''
  })
</script>

<style scoped>
  .pdf-reader-indeterminate {
    animation: pdf-reader-indeterminate 1.4s ease-in-out infinite;
  }

  @keyframes pdf-reader-indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(300%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pdf-reader-indeterminate {
      animation: none;
      width: 100%;
      opacity: 0.5;
    }
  }
</style>
