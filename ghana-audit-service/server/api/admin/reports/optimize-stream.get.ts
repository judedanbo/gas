import { requirePermission } from '../../../utils/adminHelpers'
import { getJob, subscribe, type JobState } from '../../../utils/pdfOptimizationJobs'
import type { ProgressEvent } from '../../../utils/pdfOptimizer'

// Heartbeat keeps idle proxies / browsers from killing the SSE connection
// before the optimizer finishes a long Ghostscript pass.
const HEARTBEAT_MS = 15_000

export default defineEventHandler(async (event) => {
  requirePermission(event, 'update')

  const jobIdRaw = getQuery(event).jobId
  if (typeof jobIdRaw !== 'string' || !jobIdRaw) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }
  // Narrowed string captured in a const so the nested closures below keep the type.
  const jobId: string = jobIdRaw

  const job = getJob(jobId)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  const res = event.node.res
  res.flushHeaders?.()

  function send(name: string, data: unknown): void {
    res.write(`event: ${name}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  function isTerminal(state: JobState): boolean {
    return state.status === 'success' || state.status === 'error'
  }

  function sendTerminal(state: JobState): void {
    if (state.status === 'success') send('done', state.result ?? null)
    else if (state.status === 'error') send('error', { message: state.error ?? 'unknown error' })
  }

  let closed = false
  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`)
  }, HEARTBEAT_MS)
  heartbeat.unref?.()

  let unsubscribe = (): void => {}
  const close = (): void => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    unsubscribe()
    res.end()
  }

  // Flush any buffered progress events not yet sent, tracked by a cursor so the
  // initial replay and live delivery never duplicate or skip an event.
  let cursor = 0
  function flush(): void {
    const state = getJob(jobId)
    if (!state) return
    while (cursor < state.events.length) {
      send('progress', state.events[cursor])
      cursor++
    }
  }

  // If the job has finished, deliver its terminal event and close.
  function flushTerminal(): boolean {
    const fresh = getJob(jobId)
    if (fresh && isTerminal(fresh)) {
      sendTerminal(fresh)
      close()
      return true
    }
    return false
  }

  // Subscribe BEFORE the initial replay so an event emitted during replay (the
  // producer can finish a fast job in that window) is not lost. flush() dedupes
  // via the cursor, so receiving an event we already replayed is harmless.
  unsubscribe = subscribe(jobId, (_e: ProgressEvent) => {
    if (closed) return
    flush()
    flushTerminal()
  })

  // Replay buffered events, then check whether the job already completed
  // (covers jobs that finished before — or during — this connection setup).
  flush()
  if (flushTerminal()) return

  event.node.req.on('close', close)
  event.node.req.on('aborted', close)

  // Block until the connection is closed so the H3 handler does not return
  // (which would tear down the response stream).
  await new Promise<void>((resolve) => {
    res.on('close', resolve)
    res.on('finish', resolve)
  })
})
