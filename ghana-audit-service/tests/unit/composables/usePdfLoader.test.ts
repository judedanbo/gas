import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { usePdfLoader } from '../../../composables/usePdfLoader'

/** A response body the test feeds chunk by chunk. */
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
    close: () => controller.close(),
    fail: (err: unknown) => controller.error(err)
  }
}

function fakeResponse({
  status = 200,
  headers = { 'Content-Type': 'application/pdf' } as Record<string, string>,
  body = null as ReadableStream<Uint8Array> | null,
  type = 'basic' as ResponseType
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    type,
    headers: new Headers(headers),
    body,
    arrayBuffer: async () => new ArrayBuffer(0)
  } as unknown as Response
}

/** Serve `response`, erroring its body when the request is aborted (as real fetch does). */
function serve(response: Response, stream?: ReturnType<typeof controllableBody>) {
  vi.mocked(fetch).mockImplementation((_url, init) => {
    init?.signal?.addEventListener('abort', () =>
      stream?.fail(new DOMException('Aborted', 'AbortError'))
    )
    return Promise.resolve(response)
  })
}

const URL_ = '/api/downloads/reports/1?view=1'
let clock = 0
let scope: EffectScope

function createLoader(url: Parameters<typeof usePdfLoader>[0] = URL_) {
  scope = effectScope()
  return scope.run(() => usePdfLoader(url, { tickMs: 100, now: () => clock }))!
}

describe('usePdfLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clock = 0
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not request anything until load() is called', () => {
    const loader = createLoader()
    expect(fetch).not.toHaveBeenCalled()
    expect(loader.status.value).toBe('idle')
  })

  it('streams the file, reporting progress, speed and time remaining', async () => {
    const stream = controllableBody()
    serve(
      fakeResponse({
        headers: { 'Content-Type': 'application/pdf', 'Content-Length': '1000' },
        body: stream.body
      }),
      stream
    )

    const loader = createLoader()
    const done = loader.load()
    expect(loader.status.value).toBe('loading')
    expect(fetch).toHaveBeenCalledWith(URL_, expect.objectContaining({ redirect: 'manual' }))

    await vi.advanceTimersByTimeAsync(0)
    expect(loader.progress.value).toMatchObject({ loaded: 0, total: 1000, percent: 0 })

    stream.push(250)
    clock = 1000
    await vi.advanceTimersByTimeAsync(100)
    expect(loader.progress.value).toEqual({
      loaded: 250,
      total: 1000,
      percent: 25,
      bytesPerSecond: 250,
      secondsRemaining: 3
    })

    stream.push(750)
    stream.close()
    await done

    expect(loader.status.value).toBe('ready')
    expect(loader.objectUrl.value).toBe('blob:report')
    expect(loader.progress.value).toMatchObject({ loaded: 1000, percent: 100, secondsRemaining: 0 })

    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
    expect(blob.size).toBe(1000)
    expect(blob.type).toBe('application/pdf')
  })

  it('shows bytes but no percentage or ETA when the size is unknown', async () => {
    const stream = controllableBody()
    serve(fakeResponse({ body: stream.body }), stream)

    const loader = createLoader()
    const done = loader.load()
    await vi.advanceTimersByTimeAsync(0)
    stream.push(400)
    clock = 1000
    await vi.advanceTimersByTimeAsync(100)

    expect(loader.progress.value).toMatchObject({
      loaded: 400,
      total: null,
      percent: null,
      secondsRemaining: null
    })
    expect(loader.progress.value.bytesPerSecond).toBe(400)

    stream.close()
    await done
    expect(loader.status.value).toBe('ready')
    expect(loader.progress.value).toMatchObject({ loaded: 400, total: 400, percent: 100 })
  })

  it('ignores Content-Length for encoded bodies, whose decoded size differs', async () => {
    const stream = controllableBody()
    serve(
      fakeResponse({
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': '100',
          'Content-Encoding': 'gzip'
        },
        body: stream.body
      }),
      stream
    )

    const loader = createLoader()
    const done = loader.load()
    stream.push(300)
    stream.close()
    await done

    expect(loader.status.value).toBe('ready')
    expect(loader.progress.value.loaded).toBe(300)
  })

  it('cancel() aborts the download and returns to idle', async () => {
    const stream = controllableBody()
    serve(
      fakeResponse({
        headers: { 'Content-Type': 'application/pdf', 'Content-Length': '1000' },
        body: stream.body
      }),
      stream
    )

    const loader = createLoader()
    const done = loader.load()
    stream.push(100)
    await vi.advanceTimersByTimeAsync(100)

    loader.cancel()
    await done

    const init = vi.mocked(fetch).mock.calls[0][1]
    expect(init?.signal?.aborted).toBe(true)
    expect(loader.status.value).toBe('idle')
    expect(loader.progress.value.loaded).toBe(0)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('reports a missing file as unavailable', async () => {
    serve(fakeResponse({ status: 404, headers: { 'Content-Type': 'application/json' } }))

    const loader = createLoader()
    await loader.load()

    expect(loader.status.value).toBe('error')
    expect(loader.errorKind.value).toBe('unavailable')
  })

  it('treats an HTML page in place of the PDF as unavailable', async () => {
    serve(fakeResponse({ headers: { 'Content-Type': 'text/html; charset=utf-8' } }))

    const loader = createLoader()
    await loader.load()

    expect(loader.errorKind.value).toBe('unavailable')
  })

  it('reports rate limiting with the Retry-After delay', async () => {
    serve(fakeResponse({ status: 429, headers: { 'Retry-After': '30' } }))

    const loader = createLoader()
    await loader.load()

    expect(loader.status.value).toBe('error')
    expect(loader.errorKind.value).toBe('rate-limited')
    expect(loader.retryAfterSeconds.value).toBe(30)
  })

  it('hands cross-origin redirects to the viewer', async () => {
    serve(fakeResponse({ status: 0, type: 'opaqueredirect' }))

    const loader = createLoader()
    await loader.load()

    expect(loader.status.value).toBe('external')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('reports a body cut short as a network error', async () => {
    const stream = controllableBody()
    serve(
      fakeResponse({
        headers: { 'Content-Type': 'application/pdf', 'Content-Length': '1000' },
        body: stream.body
      }),
      stream
    )

    const loader = createLoader()
    const done = loader.load()
    stream.push(400)
    stream.close()
    await done

    expect(loader.status.value).toBe('error')
    expect(loader.errorKind.value).toBe('network')
  })

  it('reports a failed request as a network error and can retry', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const loader = createLoader()
    await loader.load()
    expect(loader.errorKind.value).toBe('network')

    const stream = controllableBody()
    serve(fakeResponse({ body: stream.body }), stream)
    const retry = loader.load()
    expect(loader.status.value).toBe('loading')
    expect(loader.errorKind.value).toBeNull()

    stream.push(10)
    stream.close()
    await retry
    expect(loader.status.value).toBe('ready')
  })

  it('does not start a second download while one is running or done', async () => {
    const stream = controllableBody()
    serve(fakeResponse({ body: stream.body }), stream)

    const loader = createLoader()
    const done = loader.load()
    void loader.load()
    stream.push(10)
    stream.close()
    await done
    await loader.load()

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('resets when the URL changes, releasing the old file', async () => {
    const stream = controllableBody()
    serve(fakeResponse({ body: stream.body }), stream)

    const url = ref(URL_)
    const loader = createLoader(url)
    const done = loader.load()
    stream.push(10)
    stream.close()
    await done
    expect(loader.status.value).toBe('ready')

    url.value = '/api/downloads/reports/2?view=1'
    await nextTick()

    expect(loader.status.value).toBe('idle')
    expect(loader.objectUrl.value).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })

  it('aborts and releases everything when its scope is disposed', async () => {
    const stream = controllableBody()
    serve(
      fakeResponse({
        headers: { 'Content-Type': 'application/pdf', 'Content-Length': '1000' },
        body: stream.body
      }),
      stream
    )

    const loader = createLoader()
    const done = loader.load()
    stream.push(10)
    await vi.advanceTimersByTimeAsync(0)

    scope.stop()
    await done

    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
