import {
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter
} from 'vue'
import {
  createTransferRateMeter,
  estimateSecondsRemaining,
  progressPercent
} from '~/utils/transferProgress'

export type PdfLoadStatus =
  /** Nothing fetched yet — waiting for the reader to opt in. */
  | 'idle'
  /** Streaming the file; `progress` updates as bytes arrive. */
  | 'loading'
  /** Fully downloaded; `objectUrl` is ready for the viewer. */
  | 'ready'
  /** The file lives on another origin (legacy redirect); the viewer must load `url` itself. */
  | 'external'
  | 'error'

export type PdfLoadErrorKind = 'unavailable' | 'rate-limited' | 'network'

export interface PdfLoadProgress {
  loaded: number
  /** Null when the server didn't send a usable Content-Length. */
  total: number | null
  percent: number | null
  bytesPerSecond: number | null
  secondsRemaining: number | null
}

interface UsePdfLoaderOptions {
  /** How often (ms) progress is published to the UI. */
  tickMs?: number
  /** Clock override for tests. */
  now?: () => number
}

const emptyProgress = (): PdfLoadProgress => ({
  loaded: 0,
  total: null,
  percent: null,
  bytesPerSecond: null,
  secondsRemaining: null
})

/**
 * Size of the decoded body, or null when it can't be trusted: with a
 * Content-Encoding the header counts compressed bytes while the stream
 * yields decompressed ones, so the percentage would overshoot.
 */
function bodyLength(headers: Headers): number | null {
  const encoding = headers.get('Content-Encoding')
  if (encoding && encoding !== 'identity') return null
  const length = Number(headers.get('Content-Length'))
  return Number.isFinite(length) && length > 0 ? length : null
}

function retryAfter(headers: Headers): number | null {
  const seconds = Number(headers.get('Retry-After'))
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null
}

/**
 * On-demand PDF download with live progress, for the inline report reader.
 *
 * Nothing is requested until `load()` is called, so opening a report page
 * costs readers no data for a file they may never read. The file is streamed
 * once with fetch() — giving byte-level progress, transfer rate and an ETA —
 * and handed to the viewer as a blob: URL, so the iframe doesn't download it
 * a second time.
 */
export function usePdfLoader(url: MaybeRefOrGetter<string>, options: UsePdfLoaderOptions = {}) {
  const tickMs = options.tickMs ?? 250
  const now = options.now ?? (() => performance.now())

  const status = ref<PdfLoadStatus>('idle')
  const errorKind = ref<PdfLoadErrorKind | null>(null)
  const retryAfterSeconds = ref<number | null>(null)
  const objectUrl = ref<string | null>(null)
  const progress = ref<PdfLoadProgress>(emptyProgress())

  let controller: AbortController | null = null
  let ticker: ReturnType<typeof setInterval> | null = null

  function stopTicker() {
    if (ticker) clearInterval(ticker)
    ticker = null
  }

  function abortInFlight() {
    controller?.abort()
    controller = null
    stopTicker()
  }

  function revokeObjectUrl() {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }

  function fail(kind: PdfLoadErrorKind) {
    stopTicker()
    errorKind.value = kind
    status.value = 'error'
  }

  async function load() {
    if (status.value === 'loading' || status.value === 'ready' || status.value === 'external') {
      return
    }

    abortInFlight()
    revokeObjectUrl()
    const current = new AbortController()
    controller = current
    const isCurrent = () => controller === current

    status.value = 'loading'
    errorKind.value = null
    retryAfterSeconds.value = null
    progress.value = emptyProgress()

    const meter = createTransferRateMeter()
    let loaded = 0
    let total: number | null = null

    // Published on a timer rather than per chunk: keeps re-renders (and
    // screen-reader chatter) bounded, and lets the rate decay during a stall.
    const publish = () => {
      meter.push(loaded, now())
      const bytesPerSecond = meter.rate()
      progress.value = {
        loaded,
        total,
        percent: progressPercent(loaded, total),
        bytesPerSecond,
        secondsRemaining: estimateSecondsRemaining(loaded, total, bytesPerSecond)
      }
    }

    try {
      // `manual`: publication downloads may 302 to the legacy live site. That
      // response is opaque (cross-origin), so let the iframe follow it instead.
      const response = await fetch(toValue(url), { redirect: 'manual', signal: current.signal })
      if (!isCurrent()) return

      if (response.type === 'opaqueredirect') {
        status.value = 'external'
        return
      }

      const contentType = response.headers.get('Content-Type') ?? ''
      if (!response.ok || contentType.includes('text/html')) {
        response.body?.cancel().catch(() => {})
        if (response.status === 429) {
          retryAfterSeconds.value = retryAfter(response.headers)
          fail('rate-limited')
        } else {
          fail('unavailable')
        }
        return
      }

      total = bodyLength(response.headers)
      publish()
      ticker = setInterval(publish, tickMs)

      const chunks: BlobPart[] = []
      if (response.body) {
        const reader = response.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          loaded += value.byteLength
        }
      } else {
        const buffer = await response.arrayBuffer()
        chunks.push(buffer)
        loaded = buffer.byteLength
      }

      if (!isCurrent()) return
      stopTicker()

      // A connection that drops mid-body can still end the stream "cleanly".
      if (total !== null && loaded < total) {
        fail('network')
        return
      }

      progress.value = {
        loaded,
        total: total ?? loaded,
        percent: 100,
        bytesPerSecond: meter.rate(),
        secondsRemaining: 0
      }
      objectUrl.value = URL.createObjectURL(new Blob(chunks, { type: 'application/pdf' }))
      status.value = 'ready'
    } catch {
      // Aborted by cancel()/reset()/unmount — state was already settled there.
      if (current.signal.aborted || !isCurrent()) return
      fail('network')
    } finally {
      if (isCurrent()) {
        stopTicker()
        controller = null
      }
    }
  }

  /** Stop an in-flight download and return to the opt-in prompt. */
  function cancel() {
    abortInFlight()
    if (status.value === 'loading') {
      status.value = 'idle'
      progress.value = emptyProgress()
    }
  }

  /** Drop everything (including a finished download) and return to idle. */
  function reset() {
    abortInFlight()
    revokeObjectUrl()
    status.value = 'idle'
    errorKind.value = null
    retryAfterSeconds.value = null
    progress.value = emptyProgress()
  }

  // A different file means a different download.
  watch(() => toValue(url), reset)

  if (getCurrentScope()) {
    onScopeDispose(() => {
      abortInFlight()
      revokeObjectUrl()
    })
  }

  return {
    status: readonly(status),
    errorKind: readonly(errorKind),
    retryAfterSeconds: readonly(retryAfterSeconds),
    objectUrl: readonly(objectUrl),
    progress: readonly(progress),
    load,
    cancel,
    reset
  }
}
