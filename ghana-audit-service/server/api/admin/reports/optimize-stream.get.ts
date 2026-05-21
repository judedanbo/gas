import { requirePermission } from '../../../utils/adminHelpers'
import { getJob, subscribe, type JobState } from '../../../utils/pdfOptimizationJobs'
import type { ProgressEvent } from '../../../utils/pdfOptimizer'

// Heartbeat keeps idle proxies / browsers from killing the SSE connection
// before the optimizer finishes a long Ghostscript pass.
const HEARTBEAT_MS = 15_000

export default defineEventHandler(async (event) => {
  requirePermission(event, 'update')

  const jobId = getQuery(event).jobId
  if (typeof jobId !== 'string' || !jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }

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

  function sendBuffered(state: JobState): void {
    for (const e of state.events) send('progress', e)
  }

  function isTerminal(state: JobState): boolean {
    return state.status === 'success' || state.status === 'error'
  }

  function sendTerminal(state: JobState): void {
    if (state.status === 'success') send('done', state.result ?? null)
    else if (state.status === 'error') send('error', { message: state.error ?? 'unknown error' })
  }

  // Replay any progress events the producer has already buffered so a reconnect
  // does not miss anything.
  sendBuffered(job)

  if (isTerminal(job)) {
    sendTerminal(job)
    res.end()
    return
  }

  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`)
  }, HEARTBEAT_MS)
  heartbeat.unref?.()

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    unsubscribe()
    res.end()
  }

  const unsubscribe = subscribe(jobId, (e: ProgressEvent) => {
    if (closed) return
    send('progress', e)
    if (e.phase === 'done') {
      // Look up the freshest state to capture status (success vs error) and
      // the full OptimizeResult.
      const fresh = getJob(jobId)
      if (fresh && isTerminal(fresh)) {
        sendTerminal(fresh)
        close()
      }
    }
  })

  event.node.req.on('close', close)
  event.node.req.on('aborted', close)

  // Block until the connection is closed so the H3 handler does not return
  // (which would tear down the response stream).
  await new Promise<void>((resolve) => {
    res.on('close', resolve)
    res.on('finish', resolve)
  })
})
