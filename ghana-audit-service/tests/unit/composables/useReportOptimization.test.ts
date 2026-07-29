import { describe, it, expect, vi, afterEach } from 'vitest'
import { useReportOptimization } from '~/composables/useReportOptimization'

// The composable uses the auto-imported useAdminApi and the browser's
// EventSource; both are stubbed globally here.
const apiPost = vi.fn()
const apiGet = vi.fn()
vi.stubGlobal('useAdminApi', () => ({ post: apiPost, get: apiGet }))

type Listener = (ev: unknown) => void

class FakeEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  static instances: FakeEventSource[] = []

  url: string
  readyState = FakeEventSource.OPEN
  private listeners = new Map<string, Listener[]>()

  constructor(url: string, _opts?: unknown) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: Listener): void {
    const arr = this.listeners.get(type) ?? []
    arr.push(cb)
    this.listeners.set(type, arr)
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED
  }

  emit(type: string, ev: unknown): void {
    for (const cb of this.listeners.get(type) ?? []) cb(ev)
  }

  static latest(): FakeEventSource {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1]
  }
}

vi.stubGlobal('EventSource', FakeEventSource)

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function startOptimization(o: ReturnType<typeof useReportOptimization>) {
  apiPost.mockResolvedValue({ jobId: 'job-1', sseTicket: 'ticket' })
  const done = o.start({ fileUrl: '/pdf/reports/x.pdf' })
  return done
}

afterEach(() => {
  vi.useRealTimers()
  FakeEventSource.instances.length = 0
})

describe('useReportOptimization', () => {
  it('tracks a successful run through SSE progress and done events', async () => {
    const o = useReportOptimization()
    const done = startOptimization(o)
    await flush()

    const es = FakeEventSource.latest()
    expect(es.url).toContain('jobId=job-1')
    expect(es.url).toContain('ticket=ticket')

    es.emit('progress', {
      lastEventId: '1',
      data: JSON.stringify({ phase: 'inspect', pageCount: 3, hasBookmarks: false })
    })
    es.emit('progress', {
      lastEventId: '2',
      data: JSON.stringify({ phase: 'classify', page: 2, totalPages: 3, kind: 'native' })
    })
    expect(o.totalPages.value).toBe(3)
    expect(o.nativePages.value).toBe(1)

    es.emit('done', {
      data: JSON.stringify({
        originalSize: 100,
        optimizedSize: 40,
        savedBytes: 60,
        skippedCompression: false,
        nativePages: 2,
        scannedPages: 1,
        ocrFailedPages: 0,
        pageCount: 3
      })
    })
    await done

    expect(o.status.value).toBe('success')
    expect(o.result.value?.savedBytes).toBe(60)
  })

  it('does not double-apply replayed events with the same seq', async () => {
    const o = useReportOptimization()
    const done = startOptimization(o)
    await flush()

    const es = FakeEventSource.latest()
    const classify = {
      lastEventId: '3',
      data: JSON.stringify({ phase: 'classify', page: 2, totalPages: 4, kind: 'native' })
    }
    es.emit('progress', classify)
    es.emit('progress', classify)
    expect(o.nativePages.value).toBe(1)

    es.emit('done', { data: 'null' })
    await done
  })

  it('surfaces application errors with their code', async () => {
    const o = useReportOptimization()
    const done = startOptimization(o)
    await flush()

    FakeEventSource.latest().emit('error', {
      data: JSON.stringify({ message: 'HAS_BOOKMARKS', code: 'HAS_BOOKMARKS' })
    })
    await done

    expect(o.status.value).toBe('error')
    expect(o.errorCode.value).toBe('HAS_BOOKMARKS')
    expect(o.errorMessage.value).toMatch(/bookmarks/i)
  })

  it('captures the error code from a rejected start request', async () => {
    const o = useReportOptimization()
    apiPost.mockRejectedValue({
      statusMessage: 'Server is busy',
      data: { data: { code: 'CAPACITY' } }
    })

    await o.start({ fileUrl: '/pdf/reports/x.pdf' })

    expect(o.status.value).toBe('error')
    expect(o.errorCode.value).toBe('CAPACITY')
  })

  it('falls back to polling when the SSE transport closes mid-job', async () => {
    vi.useFakeTimers()
    const o = useReportOptimization()
    const done = startOptimization(o)
    await Promise.resolve()
    await Promise.resolve()

    const es = FakeEventSource.latest()
    es.emit('progress', {
      lastEventId: '1',
      data: JSON.stringify({ phase: 'compress' })
    })

    apiGet
      .mockResolvedValueOnce({
        active: true,
        jobId: 'job-1',
        status: 'running',
        fileUrl: '/pdf/reports/x.pdf',
        reportId: null,
        error: null,
        errorCode: null,
        result: null,
        lastEvent: { phase: 'compress' },
        lastSeq: 2,
        startedAt: 0,
        updatedAt: 0
      })
      .mockResolvedValueOnce({
        active: false,
        jobId: 'job-1',
        status: 'success',
        fileUrl: '/pdf/reports/x.pdf',
        reportId: null,
        error: null,
        errorCode: null,
        result: {
          originalSize: 100,
          optimizedSize: 70,
          savedBytes: 30,
          skippedCompression: false,
          nativePages: 1,
          scannedPages: 0,
          ocrFailedPages: 0,
          pageCount: 1
        },
        lastEvent: null,
        lastSeq: 3,
        startedAt: 0,
        updatedAt: 0
      })

    // Transport drop: no data payload, stream closed for good.
    es.readyState = FakeEventSource.CLOSED
    es.emit('error', {})

    expect(o.status.value).toBe('running')

    await vi.advanceTimersByTimeAsync(2_000)
    expect(o.status.value).toBe('running')

    await vi.advanceTimersByTimeAsync(2_000)
    await done

    expect(o.status.value).toBe('success')
    expect(o.result.value?.savedBytes).toBe(30)
    expect(apiGet).toHaveBeenCalledWith('reports/optimize-status', { jobId: 'job-1' })
  })

  it('attaches to a job started elsewhere and follows it to completion', async () => {
    vi.useFakeTimers()
    const o = useReportOptimization()

    apiGet
      .mockResolvedValueOnce({
        active: true,
        jobId: 'job-9',
        status: 'running',
        fileUrl: '/pdf/reports/other.pdf',
        reportId: 7,
        error: null,
        errorCode: null,
        result: null,
        lastEvent: { phase: 'ocr', page: 3, totalPages: 5 },
        lastSeq: 8,
        startedAt: 0,
        updatedAt: 0
      })
      .mockResolvedValueOnce({
        active: false,
        jobId: 'job-9',
        status: 'success',
        fileUrl: '/pdf/reports/other.pdf',
        reportId: 7,
        error: null,
        errorCode: null,
        result: {
          originalSize: 200,
          optimizedSize: 90,
          savedBytes: 110,
          skippedCompression: false,
          nativePages: 3,
          scannedPages: 2,
          ocrFailedPages: 1,
          pageCount: 5
        },
        lastEvent: null,
        lastSeq: 12,
        startedAt: 0,
        updatedAt: 0
      })

    await expect(o.attach({ reportId: 7 })).resolves.toBe(true)
    expect(o.status.value).toBe('running')
    expect(o.jobId.value).toBe('job-9')
    expect(o.phase.value).toBe('ocr')

    await vi.advanceTimersByTimeAsync(2_000)
    expect(o.status.value).toBe('success')
    expect(o.result.value?.ocrFailedPages).toBe(1)
  })

  it('attach leaves state untouched when nothing is active', async () => {
    const o = useReportOptimization()
    apiGet.mockResolvedValue({
      active: false,
      jobId: null,
      status: null,
      fileUrl: null,
      reportId: null,
      error: null,
      errorCode: null,
      result: null,
      lastEvent: null,
      lastSeq: 0,
      startedAt: null,
      updatedAt: null
    })

    await expect(o.attach({ reportId: 1 })).resolves.toBe(false)
    expect(o.status.value).toBe('idle')
  })
})
