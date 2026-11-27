import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { usePdfLoader } from '../../../../composables/usePdfLoader'
import PdfReader from '../../../../components/reports/PdfReader.vue'

// Nuxt auto-imports the component relies on (resolved at mount time)
const translate = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('useId', useId)
vi.stubGlobal('useI18n', () => ({ t: translate }))
vi.stubGlobal('useLocalePath', () => (path: string) => path)
vi.stubGlobal('onKeyStroke', () => {})
vi.stubGlobal('usePdfLoader', usePdfLoader)

// The pdf.js viewer is a separate, lazily loaded component; here it only needs
// to show what it was given and be able to report a failure.
const PdfViewerStub = defineComponent({
  props: ['source', 'title'],
  emits: ['ready', 'error'],
  // Computed here: templates can't see the Blob global.
  setup: (props: { source: Blob | string }) => ({
    sourceType: computed(() => (props.source instanceof Blob ? 'blob' : 'url')),
    size: computed(() => (props.source instanceof Blob ? String(props.source.size) : ''))
  }),
  template: `
    <div
      data-testid="pdf-viewer"
      :data-source-type="sourceType"
      :data-size="size"
      :data-title="title"
    >
      <button type="button" data-testid="viewer-fail" @click="$emit('error', new Error('boom'))" />
    </div>
  `
})

const stubs = {
  Icon: true,
  UiLoadingSpinner: true,
  NuxtLink: { props: ['to'], template: '<a href="#"><slot /></a>' },
  LazyReportsPdfViewer: PdfViewerStub
}

function mountReader() {
  return mount(PdfReader, {
    props: {
      fileUrl: '/api/downloads/reports/7',
      title: 'Report on the Public Accounts of Ghana',
      fileSize: '4.2 MB'
    },
    global: { mocks: { $t: translate }, stubs }
  })
}

function controllableBody() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    }
  })
  return {
    body,
    push: (bytes: number) => controller.enqueue(new Uint8Array(bytes)),
    close: () => controller.close()
  }
}

function pdfResponse(body: ReadableStream<Uint8Array>, length: number) {
  return {
    ok: true,
    status: 200,
    type: 'basic',
    headers: new Headers({ 'Content-Type': 'application/pdf', 'Content-Length': String(length) }),
    body
  } as unknown as Response
}

/** What fetch() with `redirect: 'manual'` yields when the file lives on another origin. */
const opaqueRedirect = {
  ok: false,
  status: 0,
  type: 'opaqueredirect',
  headers: new Headers(),
  body: null
} as unknown as Response

const readButton = (wrapper: ReturnType<typeof mountReader>) =>
  wrapper.findAll('button').find((b) => b.text().includes('reports.reader.readOnline'))!

async function readFully(wrapper: ReturnType<typeof mountReader>) {
  const stream = controllableBody()
  vi.mocked(fetch).mockResolvedValue(pdfResponse(stream.body, 1000))
  await readButton(wrapper).trigger('click')
  stream.push(1000)
  stream.close()
  await flushPromises()
}

describe('ReportsPdfReader', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report-7')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offers to read online without downloading anything on page load', async () => {
    const wrapper = mountReader()
    await flushPromises()

    expect(fetch).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="pdf-viewer"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('reports.reader.promptTitle')
    expect(wrapper.text()).toContain('reports.reader.dataNotice {"size":"4.2 MB"}')
    expect(readButton(wrapper).exists()).toBe(true)
  })

  it('offers to read online on every screen size, phones included', async () => {
    const wrapper = mountReader()
    await flushPromises()

    // Nothing between the button and the reader hides it below a breakpoint.
    const button = readButton(wrapper).element
    expect(button.closest('.hidden, [class*="sm:hidden"]')).toBeNull()
    expect(wrapper.text()).not.toContain('reports.reader.mobileTitle')
  })

  it('downloads with a progress bar once the visitor chooses to read, then shows the PDF in the viewer', async () => {
    const stream = controllableBody()
    vi.mocked(fetch).mockResolvedValue(pdfResponse(stream.body, 1000))

    const wrapper = mountReader()
    await readButton(wrapper).trigger('click')

    expect(fetch).toHaveBeenCalledWith(
      '/api/downloads/reports/7?view=1',
      expect.objectContaining({ redirect: 'manual' })
    )

    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
    expect(wrapper.text()).toContain('reports.reader.cancel')

    stream.push(1000)
    stream.close()
    await flushPromises()

    // The downloaded bytes go to pdf.js as a Blob — no second request, and
    // never an <iframe>, which phone browsers can't show a PDF in.
    const viewer = wrapper.find('[data-testid="pdf-viewer"]')
    expect(viewer.exists()).toBe(true)
    expect(viewer.attributes('data-source-type')).toBe('blob')
    expect(viewer.attributes('data-size')).toBe('1000')
    expect(viewer.attributes('data-title')).toBe('Report on the Public Accounts of Ghana')
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[aria-live="polite"]').text()).toBe('reports.reader.announceReady')
    wrapper.unmount()
  })

  it('falls back to the download when the viewer cannot display the file', async () => {
    const wrapper = mountReader()
    await readFully(wrapper)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await wrapper.find('[data-testid="viewer-fail"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="pdf-viewer"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('reports.reader.viewerFailedTitle')
    const download = wrapper
      .findAll('a[download]')
      .find((a) => a.text().includes('common.downloadPdf'))
    expect(download?.attributes('href')).toBe('/api/downloads/reports/7')

    // "Try again" mounts a fresh viewer
    const retry = wrapper.findAll('button').find((b) => b.text() === 'errors.tryAgain')!
    await retry.trigger('click')
    expect(wrapper.find('[data-testid="pdf-viewer"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens a file hosted on another origin in a new tab when the browser cannot frame PDFs', async () => {
    vi.mocked(fetch).mockResolvedValue(opaqueRedirect)

    const wrapper = mountReader()
    await readButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pdf-viewer"]').exists()).toBe(false)
    const open = wrapper.find('a[target="_blank"]')
    expect(open.exists()).toBe(true)
    expect(open.attributes('href')).toBe('/api/downloads/reports/7?view=1')
    expect(open.attributes('rel')).toContain('noopener')
    expect(wrapper.text()).toContain('reports.reader.externalTitle')
  })

  it('frames a file hosted on another origin on a desktop browser with a PDF viewer', async () => {
    // A mouse-driven browser with a built-in viewer. Restored by hand: the
    // fetch stub from tests/setup.ts must survive, so no unstubAllGlobals().
    const original = { navigator: globalThis.navigator, matchMedia: globalThis.matchMedia }
    vi.stubGlobal('navigator', { pdfViewerEnabled: true })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.mocked(fetch).mockResolvedValue(opaqueRedirect)

    try {
      const wrapper = mountReader()
      await readButton(wrapper).trigger('click')
      await flushPromises()

      const frame = wrapper.find('iframe')
      expect(frame.exists()).toBe(true)
      expect(frame.attributes('src')).toBe('/api/downloads/reports/7?view=1')
      expect(wrapper.find('a[target="_blank"]').exists()).toBe(false)
    } finally {
      vi.stubGlobal('navigator', original.navigator)
      vi.stubGlobal('matchMedia', original.matchMedia)
    }
  })

  it('returns to the prompt when loading is cancelled', async () => {
    const stream = controllableBody()
    vi.mocked(fetch).mockImplementation((_url, init) => {
      init?.signal?.addEventListener('abort', () => stream.body.cancel().catch(() => {}))
      return Promise.resolve(pdfResponse(stream.body, 1000))
    })

    const wrapper = mountReader()
    await readButton(wrapper).trigger('click')
    await flushPromises()

    const cancel = wrapper.findAll('button').find((b) => b.text() === 'reports.reader.cancel')!
    await cancel.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
    expect(readButton(wrapper).exists()).toBe(true)
  })

  it('explains when the file is unavailable and offers to report it', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      type: 'basic',
      headers: new Headers(),
      body: null
    } as unknown as Response)

    const wrapper = mountReader()
    await readButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('reports.reader.errorTitle')
    expect(wrapper.text()).toContain('reports.reader.reportIssue')
    expect(wrapper.text()).toContain('errors.tryAgain')
  })
})
