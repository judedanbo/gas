import { ref, computed } from 'vue'
import { optimizationErrorMessage } from '~/utils/reportOptimizationUi'

export type CompressionPreset = 'screen' | 'ebook' | 'printer'
export type PageKind = 'native' | 'scanned'
export type OptimizationStatus = 'idle' | 'queued' | 'running' | 'success' | 'error'

export type OptimizationPhase =
  | 'inspect'
  | 'split'
  | 'classify'
  | 'ocr'
  | 'merge'
  | 'compress'
  | 'done'

export interface OptimizationResult {
  originalSize: number
  optimizedSize: number
  savedBytes: number
  skippedCompression: boolean
  nativePages: number
  scannedPages: number
  ocrFailedPages?: number
  pageCount?: number
}

export interface ProgressEvent {
  phase: OptimizationPhase
  pageCount?: number
  hasBookmarks?: boolean
  page?: number
  totalPages?: number
  kind?: PageKind
  reason?: string
  failed?: boolean
  originalSize?: number
  optimizedSize?: number
  savedBytes?: number
  skippedCompression?: boolean
  nativePages?: number
  scannedPages?: number
  ocrFailedPages?: number
}

export interface OptimizationStartOptions {
  fileUrl: string
  preset?: CompressionPreset
  reportId?: number | null
  allowDropBookmarks?: boolean
}

export interface OptimizationAttachLookup {
  jobId?: string
  reportId?: number
  fileUrl?: string
}

// Mirror of the server's OptimizeStatusResponse (optimize-status.get.ts) —
// kept local so client code doesn't import from server/.
interface StatusResponse {
  active: boolean
  jobId: string | null
  status: 'queued' | 'running' | 'success' | 'error' | null
  fileUrl: string | null
  reportId: number | null
  error: string | null
  errorCode: string | null
  result: OptimizationResult | null
  lastEvent: ProgressEvent | null
  lastSeq: number
  startedAt: number | null
  updatedAt: number | null
}

const POLL_INTERVAL_MS = 2_000
const POLL_MAX_FAILURES = 5
const POLL_MAX_MS = 30 * 60_000

const PHASE_PROGRESS: Record<OptimizationPhase, number> = {
  inspect: 5,
  split: 10,
  classify: 25,
  ocr: 60,
  merge: 80,
  compress: 95,
  done: 100
}

export function useReportOptimization() {
  const status = ref<OptimizationStatus>('idle')
  const phase = ref<OptimizationPhase | null>(null)
  const page = ref(0)
  const totalPages = ref(0)
  const nativePages = ref(0)
  const scannedPages = ref(0)
  const hasBookmarks = ref(false)
  const result = ref<OptimizationResult | null>(null)
  const error = ref<string | null>(null)
  const errorCode = ref<string | null>(null)
  const jobId = ref<string | null>(null)

  // Friendly, admin-facing message for the current error code. The raw
  // `error` string stays available for logging/debugging.
  const errorMessage = computed(() =>
    status.value === 'error' ? optimizationErrorMessage(errorCode.value) : null
  )

  let eventSource: EventSource | null = null

  // Highest event seq applied so far (from SSE id:/Last-Event-ID or the
  // status endpoint). Guards against double-applying events on stream
  // replays and polling overlaps — classify counters increment per event, so
  // duplicates would inflate them.
  let lastSeenSeq = 0

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollFailures = 0
  let pollDeadline = 0

  const isRunning = computed(() => status.value === 'queued' || status.value === 'running')

  // Coarse 0-100 progress derived from the current phase, refined by the
  // page-of-N counter while we are inside classify/ocr.
  const progress = computed(() => {
    const p = phase.value
    if (!p) return 0
    if (p === 'classify' || p === 'ocr') {
      const base = p === 'classify' ? PHASE_PROGRESS.split : PHASE_PROGRESS.classify
      const span = PHASE_PROGRESS[p] - base
      const frac = totalPages.value ? Math.min(1, page.value / totalPages.value) : 0
      return Math.round(base + span * frac)
    }
    return PHASE_PROGRESS[p] ?? 0
  })

  function reset(): void {
    status.value = 'idle'
    phase.value = null
    page.value = 0
    totalPages.value = 0
    nativePages.value = 0
    scannedPages.value = 0
    hasBookmarks.value = false
    result.value = null
    error.value = null
    errorCode.value = null
    jobId.value = null
    lastSeenSeq = 0
    closeStream()
    stopPolling()
  }

  function closeStream(): void {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function applyStatusResponse(s: StatusResponse, onTerminal?: () => void): void {
    if (s.lastEvent && s.lastSeq > lastSeenSeq) {
      lastSeenSeq = s.lastSeq
      handleProgress(s.lastEvent)
    }
    if (s.status === 'success') {
      if (s.result) result.value = s.result
      status.value = 'success'
      stopPolling()
      onTerminal?.()
    } else if (s.status === 'error') {
      error.value = s.error || 'Optimization failed'
      errorCode.value = s.errorCode ?? null
      status.value = 'error'
      stopPolling()
      onTerminal?.()
    }
  }

  // Authenticated polling of the status endpoint. Used when the SSE stream
  // drops mid-job (its ~2min ticket can't survive reconnects on long jobs)
  // and for re-attaching to a job started elsewhere. While polling, only the
  // latest event is applied, so per-page counters may jump — the terminal
  // status response carries the authoritative result.
  function startPolling(onTerminal?: () => void): void {
    if (pollTimer) return
    const api = useAdminApi()
    pollFailures = 0
    pollDeadline = Date.now() + POLL_MAX_MS
    pollTimer = setInterval(async () => {
      if (!jobId.value || !isRunning.value) {
        stopPolling()
        return
      }
      try {
        const s = await api.get<StatusResponse>('reports/optimize-status', {
          jobId: jobId.value
        })
        pollFailures = 0
        applyStatusResponse(s, onTerminal)
      } catch (err) {
        pollFailures++
        const e = err as { statusCode?: number }
        if (e.statusCode === 404 || pollFailures >= POLL_MAX_FAILURES) {
          stopPolling()
          status.value = 'error'
          error.value = 'Lost contact with the optimization job'
          errorCode.value = null
          onTerminal?.()
          return
        }
      }
      if (pollTimer && Date.now() > pollDeadline) {
        stopPolling()
        status.value = 'error'
        error.value = 'Optimization timed out'
        errorCode.value = 'TIMEOUT'
        onTerminal?.()
      }
    }, POLL_INTERVAL_MS)
  }

  function handleProgress(e: ProgressEvent): void {
    phase.value = e.phase

    if (e.phase === 'inspect') {
      if (typeof e.pageCount === 'number') totalPages.value = e.pageCount
      if (typeof e.hasBookmarks === 'boolean') hasBookmarks.value = e.hasBookmarks
    }
    if (e.phase === 'classify' || e.phase === 'ocr') {
      if (typeof e.page === 'number') page.value = e.page
      if (typeof e.totalPages === 'number') totalPages.value = e.totalPages
      if (e.phase === 'classify' && e.kind === 'native') nativePages.value++
      if (e.phase === 'classify' && e.kind === 'scanned') scannedPages.value++
    }
    if (e.phase === 'done') {
      if (typeof e.originalSize === 'number') {
        result.value = {
          originalSize: e.originalSize ?? 0,
          optimizedSize: e.optimizedSize ?? 0,
          savedBytes: e.savedBytes ?? 0,
          skippedCompression: e.skippedCompression ?? false,
          nativePages: e.nativePages ?? nativePages.value,
          scannedPages: e.scannedPages ?? scannedPages.value,
          ocrFailedPages: e.ocrFailedPages ?? 0
        }
      }
    }
  }

  async function start(opts: OptimizationStartOptions): Promise<void> {
    reset()
    status.value = 'queued'

    const api = useAdminApi()

    let response: { jobId: string; sseTicket?: string }
    try {
      response = await api.post<{ jobId: string; sseTicket?: string }>('reports/optimize', {
        fileUrl: opts.fileUrl,
        preset: opts.preset ?? 'ebook',
        reportId: opts.reportId ?? undefined,
        allowDropBookmarks: opts.allowDropBookmarks === true
      })
    } catch (err) {
      const e = err as {
        statusMessage?: string
        message?: string
        data?: { data?: { code?: string } }
      }
      status.value = 'error'
      error.value = e.statusMessage || e.message || 'Failed to start optimization'
      errorCode.value = e.data?.data?.code ?? null
      return
    }

    jobId.value = response.jobId
    status.value = 'running'

    // EventSource cannot set custom headers, so we attach a short-lived,
    // aud-scoped SSE ticket (minted by the optimize endpoint) as a query param.
    // The admin middleware accepts ?ticket= for the SSE route only.
    const url = `/api/admin/reports/optimize-stream?jobId=${encodeURIComponent(response.jobId)}${
      response.sseTicket ? `&ticket=${encodeURIComponent(response.sseTicket)}` : ''
    }`

    eventSource = new EventSource(url, { withCredentials: true })

    return new Promise<void>((resolve) => {
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        resolve()
      }

      eventSource!.addEventListener('progress', (msg) => {
        try {
          const m = msg as MessageEvent
          // Frames carry the event seq as their SSE id. Skip anything we've
          // already applied (stream replay after reconnect, polling overlap).
          const seq = Number(m.lastEventId)
          if (Number.isFinite(seq) && seq > 0) {
            if (seq <= lastSeenSeq) return
            lastSeenSeq = seq
          }
          const data = JSON.parse(m.data) as ProgressEvent
          handleProgress(data)
        } catch {
          /* malformed event, ignore */
        }
      })

      eventSource!.addEventListener('done', (msg) => {
        try {
          const data = JSON.parse((msg as MessageEvent).data) as OptimizationResult | null
          if (data) result.value = data
        } catch {
          /* ignore */
        }
        status.value = 'success'
        closeStream()
        settle()
      })

      eventSource!.addEventListener('error', (msg) => {
        const ev = msg as MessageEvent | Event
        if ('data' in ev && typeof ev.data === 'string') {
          // Application-level error frame sent by the server — terminal.
          let message = 'Optimization stream error'
          let code: string | null = null
          try {
            const data = JSON.parse(ev.data) as { message?: string; code?: string | null }
            if (data?.message) message = data.message
            if (data?.code) code = data.code
          } catch {
            /* ignore */
          }
          if (status.value !== 'success') {
            status.value = 'error'
            error.value = message
            errorCode.value = code
            closeStream()
            settle()
          }
          return
        }
        // Native EventSource error events also fire on transport drops.
        // While CONNECTING the browser retries on its own; only a CLOSED
        // stream is final. The job usually keeps running server-side (and
        // the ~2min SSE ticket can't survive late reconnects), so fall back
        // to authenticated polling instead of reporting failure.
        if (
          eventSource &&
          eventSource.readyState === EventSource.CLOSED &&
          status.value !== 'success' &&
          status.value !== 'error'
        ) {
          closeStream()
          if (jobId.value) {
            startPolling(settle)
          } else {
            status.value = 'error'
            error.value = 'Optimization stream error'
            settle()
          }
        }
      })
    })
  }

  /**
   * Attach to an optimization job this tab didn't start (or lost). Looks the
   * job up via the status endpoint (by jobId, reportId, or fileUrl), seeds
   * local state from it, and keeps following it via polling. Returns false —
   * without touching state — when there is nothing active to attach to.
   */
  async function attach(lookup: OptimizationAttachLookup): Promise<boolean> {
    const api = useAdminApi()
    let s: StatusResponse
    try {
      s = await api.get<StatusResponse>('reports/optimize-status', {
        jobId: lookup.jobId,
        reportId: lookup.reportId,
        fileUrl: lookup.fileUrl
      })
    } catch {
      return false
    }
    if (!s.active || !s.jobId || !s.status) return false

    reset()
    jobId.value = s.jobId
    status.value = s.status === 'queued' ? 'queued' : 'running'
    if (s.lastEvent && s.lastSeq > 0) {
      lastSeenSeq = s.lastSeq
      handleProgress(s.lastEvent)
    }
    startPolling()
    return true
  }

  function cancel(): void {
    // v1 only closes the client stream — server work continues to completion.
    closeStream()
    stopPolling()
    if (status.value === 'running' || status.value === 'queued') {
      status.value = 'idle'
    }
  }

  return {
    status,
    phase,
    page,
    totalPages,
    nativePages,
    scannedPages,
    hasBookmarks,
    result,
    error,
    errorCode,
    errorMessage,
    jobId,
    progress,
    isRunning,
    start,
    attach,
    cancel,
    reset
  }
}
