import { ref, computed } from 'vue'

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
  originalSize?: number
  optimizedSize?: number
  savedBytes?: number
  skippedCompression?: boolean
  nativePages?: number
  scannedPages?: number
}

export interface OptimizationStartOptions {
  fileUrl: string
  preset?: CompressionPreset
  reportId?: number | null
  allowDropBookmarks?: boolean
}

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
  const jobId = ref<string | null>(null)

  let eventSource: EventSource | null = null

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
    jobId.value = null
    closeStream()
  }

  function closeStream(): void {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
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
          scannedPages: e.scannedPages ?? scannedPages.value
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
      const e = err as { statusMessage?: string; message?: string }
      status.value = 'error'
      error.value = e.statusMessage || e.message || 'Failed to start optimization'
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
          const data = JSON.parse((msg as MessageEvent).data) as ProgressEvent
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
        let message = 'Optimization stream error'
        if ('data' in ev && typeof ev.data === 'string') {
          try {
            const data = JSON.parse(ev.data) as { message?: string }
            if (data?.message) message = data.message
          } catch {
            /* ignore */
          }
        }
        // Native EventSource error events fire on transport drops, not only
        // on application errors. Only flip to error status when the stream
        // is actually closed (readyState === CLOSED) and we have not already
        // seen a 'done' event.
        if (status.value !== 'success') {
          if (eventSource && eventSource.readyState === EventSource.CLOSED) {
            status.value = 'error'
            error.value = message
            closeStream()
            settle()
          }
        }
      })
    })
  }

  function cancel(): void {
    // v1 only closes the client stream — server work continues to completion.
    closeStream()
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
    jobId,
    progress,
    isRunning,
    start,
    cancel,
    reset
  }
}
