<template>
  <div class="flex flex-1 min-h-0 flex-col" :aria-busy="phase === 'loading' ? 'true' : undefined">
    <!-- Controls -->
    <div
      v-if="phase === 'ready'"
      role="toolbar"
      :aria-label="$t('reports.reader.viewerControls')"
      class="flex items-center justify-between gap-2 px-2 sm:px-3 py-1.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm"
    >
      <div class="flex items-center gap-1">
        <button
          type="button"
          :class="controlClass"
          :disabled="currentPage <= 1"
          :aria-label="$t('reports.reader.previousPage')"
          :title="$t('reports.reader.previousPage')"
          @click="goToPage(currentPage - 1)"
        >
          <Icon name="heroicons:chevron-up" class="w-4 h-4" aria-hidden="true" />
        </button>
        <label :for="pageInputId" class="sr-only">{{ $t('reports.reader.pageNumber') }}</label>
        <input
          :id="pageInputId"
          v-model="pageInput"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          class="w-12 h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-1.5 text-center text-sm text-gray-900 dark:text-white tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          @change="submitPageInput"
          @keydown.enter.prevent="submitPageInput"
        />
        <span
          class="text-gray-600 dark:text-gray-400 tabular-nums whitespace-nowrap"
          aria-hidden="true"
        >
          / {{ pageCount }}
        </span>
        <button
          type="button"
          :class="controlClass"
          :disabled="currentPage >= pageCount"
          :aria-label="$t('reports.reader.nextPage')"
          :title="$t('reports.reader.nextPage')"
          @click="goToPage(currentPage + 1)"
        >
          <Icon name="heroicons:chevron-down" class="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          :class="controlClass"
          :disabled="!canZoomOut"
          :aria-label="$t('reports.reader.zoomOut')"
          :title="$t('reports.reader.zoomOut')"
          @click="zoom(-1)"
        >
          <Icon name="heroicons:magnifying-glass-minus" class="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :class="[controlClass, fitWidth && 'text-primary dark:text-primary-200']"
          :aria-pressed="fitWidth ? 'true' : 'false'"
          :aria-label="$t('reports.reader.fitWidth')"
          :title="$t('reports.reader.fitWidth')"
          @click="fitToWidth"
        >
          <Icon name="heroicons:arrows-right-left" class="w-4 h-4" aria-hidden="true" />
          <span class="tabular-nums" aria-hidden="true">{{ zoomLabel }}</span>
        </button>
        <button
          type="button"
          :class="controlClass"
          :disabled="!canZoomIn"
          :aria-label="$t('reports.reader.zoomIn')"
          :title="$t('reports.reader.zoomIn')"
          @click="zoom(1)"
        >
          <Icon name="heroicons:magnifying-glass-plus" class="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Pages. pdf.js requires an absolutely positioned, scrolling container. -->
    <div class="relative flex-1 min-h-0">
      <div
        ref="containerEl"
        class="absolute inset-0 overflow-auto bg-gray-100 dark:bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        tabindex="0"
        :aria-label="title"
      >
        <div ref="viewerEl" class="pdfViewer" />
      </div>
      <div
        v-if="phase === 'loading'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
      >
        <UiLoadingSpinner size="lg" color="primary" label="" />
        <p class="text-sm">{{ $t('reports.reader.viewerLoading') }}</p>
      </div>
    </div>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </div>
</template>

<script setup lang="ts">
  import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
  import type { EventBus, PDFViewer } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
  import { ensurePdfjsStylesheet, loadPdfjs, pdfjsDocumentOptions } from '~/utils/pdfjsRuntime'
  import { MAX_SCALE, MIN_SCALE, clampPage, nextScale, zoomPercent } from '~/utils/pdfViewer'

  /**
   * Inline PDF viewer built on pdf.js, so reports can be read in any browser —
   * including phone browsers, which have no PDF plugin for an <iframe> to use.
   * Pages are drawn to canvases on demand (pdf.js keeps only the pages around
   * the viewport rendered), with a text layer over them for selection and
   * screen readers, working links, fit-to-width, zoom and page navigation.
   *
   * The library itself is loaded only when this component mounts, from the
   * static files served by modules/pdfjs-assets.ts.
   */
  interface Props {
    /**
     * The PDF: the Blob usePdfLoader downloaded — handed to pdf.js as bytes, so
     * no further request is made (a blob: URL would need connect-src blob:) —
     * or a same-origin URL for pdf.js to fetch itself.
     */
    source: Blob | string
    /** Document title, read to screen-reader users as the viewer's label. */
    title: string
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    /** Pages are laid out and the first one is rendering. */
    ready: [pageCount: number]
    /** pdf.js could not be loaded or could not open the file. */
    error: [error: unknown]
  }>()

  const { t } = useI18n()
  const baseUrl = useRuntimeConfig().public.pdfjsBaseUrl
  const pageInputId = `pdf-viewer-page-${useId()}`

  const controlClass =
    'inline-flex items-center gap-1 h-9 min-w-[2.25rem] justify-center rounded-md px-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-primary dark:hover:text-primary-200 disabled:opacity-40 disabled:pointer-events-none transition-colors'

  const phase = ref<'loading' | 'ready' | 'error'>('loading')
  const pageCount = ref(0)
  const currentPage = ref(1)
  const pageInput = ref('1')
  const scale = ref(1)
  const fitWidth = ref(true)
  const announcement = ref('')

  const containerEl = ref<HTMLDivElement | null>(null)
  const viewerEl = ref<HTMLDivElement | null>(null)

  const zoomLabel = computed(() => `${zoomPercent(scale.value)}%`)
  const canZoomOut = computed(() => scale.value > MIN_SCALE)
  const canZoomIn = computed(() => scale.value < MAX_SCALE)

  let pdfViewer: PDFViewer | null = null
  let loadingTask: PDFDocumentLoadingTask | null = null
  let disposed = false

  onMounted(async () => {
    try {
      const [{ lib, viewer }] = await Promise.all([
        loadPdfjs(baseUrl),
        ensurePdfjsStylesheet(baseUrl)
      ])
      if (disposed || !containerEl.value || !viewerEl.value) return

      const eventBus: EventBus = new viewer.EventBus()
      const linkService = new viewer.PDFLinkService({
        eventBus,
        externalLinkTarget: viewer.LinkTarget.BLANK,
        externalLinkRel: 'noopener noreferrer'
      })
      pdfViewer = new viewer.PDFViewer({
        container: containerEl.value,
        viewer: viewerEl.value,
        eventBus,
        linkService,
        // 1 = TextLayerMode.ENABLE: real text over the page images, so it can be
        // selected, found with the browser's search and read by screen readers.
        textLayerMode: 1,
        // Links (contents pages, cross-references) work; forms stay read-only.
        annotationMode: lib.AnnotationMode.ENABLE,
        annotationEditorMode: lib.AnnotationEditorType.DISABLE,
        imageResourcesPath: `${baseUrl}/web/images/`
      })
      linkService.setViewer(pdfViewer)

      eventBus.on('pagesinit', () => {
        if (disposed || !pdfViewer) return
        // Only possible once pages exist; a phone shows one page at its full width.
        pdfViewer.currentScaleValue = 'page-width'
        phase.value = 'ready'
        emit('ready', pageCount.value)
      })
      eventBus.on('pagechanging', (evt: { pageNumber: number }) => {
        currentPage.value = evt.pageNumber
        pageInput.value = String(evt.pageNumber)
      })
      eventBus.on('scalechanging', (evt: { scale: number; presetValue?: string }) => {
        scale.value = evt.scale
        fitWidth.value = evt.presetValue === 'page-width'
      })

      const documentSource =
        typeof props.source === 'string'
          ? { url: props.source }
          : { data: new Uint8Array(await props.source.arrayBuffer()) }
      if (disposed) return

      loadingTask = lib.getDocument({ ...documentSource, ...pdfjsDocumentOptions(baseUrl) })
      const pdfDocument = await loadingTask.promise
      if (disposed) return

      pageCount.value = pdfDocument.numPages
      pdfViewer.setDocument(pdfDocument)
      linkService.setDocument(pdfDocument, null)
    } catch (error) {
      if (disposed) return
      phase.value = 'error'
      emit('error', error)
    }
  })

  // pdf.js doesn't refit pages when its container changes size (rotation,
  // full screen, a resized window), so keep "fit to width" true to its name.
  const refit = useDebounceFn(() => {
    if (fitWidth.value && phase.value === 'ready' && pdfViewer) {
      pdfViewer.currentScaleValue = 'page-width'
    }
  }, 100)
  useResizeObserver(containerEl, () => refit())

  // ── Controls ──────────────────────────────────────────────────

  function goToPage(page: number) {
    if (!pdfViewer || phase.value !== 'ready') return
    const target = clampPage(page, pageCount.value)
    pdfViewer.currentPageNumber = target
    pageInput.value = String(target)
    announcement.value = t('reports.reader.pageOf', { page: target, total: pageCount.value })
  }

  function submitPageInput() {
    const parsed = Number.parseInt(pageInput.value, 10)
    if (Number.isNaN(parsed)) {
      pageInput.value = String(currentPage.value)
      return
    }
    goToPage(parsed)
  }

  function zoom(direction: 1 | -1) {
    if (!pdfViewer || phase.value !== 'ready') return
    pdfViewer.currentScale = nextScale(scale.value, direction)
  }

  function fitToWidth() {
    if (!pdfViewer || phase.value !== 'ready') return
    pdfViewer.currentScaleValue = 'page-width'
  }

  /** Moves keyboard focus to the pages, without scrolling the page to them. */
  function focus() {
    containerEl.value?.focus({ preventScroll: true })
  }

  defineExpose({ focus })

  onBeforeUnmount(() => {
    disposed = true
    // Detaching the document releases the rendered pages; destroying the task
    // stops any download or parsing still in flight and frees the worker.
    pdfViewer?.setDocument(null as unknown as PDFDocumentProxy)
    pdfViewer = null
    loadingTask?.destroy().catch(() => {})
    loadingTask = null
  })
</script>
