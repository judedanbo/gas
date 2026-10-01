import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { usePdfLoader } from '../../../../composables/usePdfLoader'
import PdfReader from '../../../../components/reports/PdfReader.vue'

// Nuxt auto-imports the component relies on (resolved at mount time)
const translate = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('useId', useId)
vi.stubGlobal('useI18n', () => ({ t: translate }))
vi.stubGlobal('useLocalePath', () => (path: string) => path)
vi.stubGlobal('onKeyStroke', () => {})
vi.stubGlobal('usePdfLoader', usePdfLoader)

const stubs = {
  Icon: true,
  UiLoadingSpinner: true,
  NuxtLink: { props: ['to'], template: '<a href="#"><slot /></a>' }
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

const readButton = (wrapper: ReturnType<typeof mountReader>) =>
  wrapper.findAll('button').find((b) => b.text().includes('reports.reader.readOnline'))!

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
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.text()).toContain('reports.reader.promptTitle')
    expect(wrapper.text()).toContain('reports.reader.dataNotice {"size":"4.2 MB"}')
    expect(readButton(wrapper).exists()).toBe(true)
  })

  it('downloads with a progress bar once the visitor chooses to read, then shows the PDF', async () => {
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

    const frame = wrapper.find('iframe')
    expect(frame.exists()).toBe(true)
    expect(frame.attributes('src')).toBe('blob:report-7')
    expect(frame.attributes('title')).toBe('Report on the Public Accounts of Ghana')
    expect(wrapper.find('[aria-live="polite"]').text()).toBe('reports.reader.announceReady')
    wrapper.unmount()
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
