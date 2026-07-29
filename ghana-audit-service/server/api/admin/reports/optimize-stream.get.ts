import { requirePermission } from '../../../utils/adminHelpers'
import {
  effectiveJobState,
  getJob,
  getJobAcrossInstances,
  subscribe,
  type JobState,
  type SequencedEvent
} from '../../../utils/pdfOptimizationJobs'

// Heartbeat keeps idle proxies / browsers from killing the SSE connection
// before the optimizer finishes a long Ghostscript pass.
const HEARTBEAT_MS = 15_000

// Jobs living on another replica have no local EventEmitter to subscribe to,
// so their progress is polled from the Redis mirror instead. 1s is close
// enough to the optimizer's per-page progress cadence.
const REMOTE_POLL_MS = 1_000

export default defineEventHandler(async (event) => {
  requirePermission(event, 'update')

  const jobIdRaw = getQuery(event).jobId
  if (typeof jobIdRaw !== 'string' || !jobIdRaw) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }
  // Narrowed string captured in a const so the nested closures below keep the type.
  const jobId: string = jobIdRaw

  // The job may live on another replica: production runs >=2 pods (HPA), and
  // the POST that created the job and this SSE GET are load-balanced
  // independently. getJobAcrossInstances checks the local map first, then the
  // Redis mirror every mutation is written to. A local-only lookup here used
  // to 404 whenever the two requests landed on different pods.
  const job = await getJobAcrossInstances(jobId)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }
  const isLocalJob = getJob(jobId) !== undefined

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  const res = event.node.res
  res.flushHeaders?.()

  function send(name: string, data: unknown, id?: number): void {
    if (id !== undefined) {
      res.write(`id: ${id}\n`)
    }
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

  let pollTimer: ReturnType<typeof setInterval> | undefined
  let unsubscribe = (): void => {}
  const close = (): void => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    if (pollTimer) clearInterval(pollTimer)
    unsubscribe()
    res.end()
  }

  // Seq-tracked replay: the initial flush and live delivery (emitter or poll)
  // never duplicate or skip an event, even after the job's ring buffer trims
  // old entries (an array index would shift; seqs are stable). Each frame
  // carries an SSE `id:` so the browser sends Last-Event-ID on auto-reconnect
  // and we resume without re-replaying. A reconnect whose Last-Event-ID
  // predates the trimmed window loses that gap by design — progress events
  // are cosmetic and the terminal 'done' event carries authoritative totals.
  let lastSeq = 0
  const resumeFrom = Number(getHeader(event, 'last-event-id'))
  if (Number.isFinite(resumeFrom) && resumeFrom > 0) {
    lastSeq = resumeFrom
  }
  function flushFrom(state: JobState): void {
    for (const e of state.events) {
      if (e.seq <= lastSeq) continue
      send('progress', e.event, e.seq)
      lastSeq = e.seq
    }
  }

  // Deliver the terminal event and close if the job has finished.
  function terminalFrom(state: JobState): boolean {
    if (isTerminal(state)) {
      sendTerminal(state)
      close()
      return true
    }
    return false
  }

  if (isLocalJob) {
    // Subscribe BEFORE the initial replay so an event emitted during replay
    // (the producer can finish a fast job in that window) is not lost.
    // flushFrom dedupes via the cursor, so double delivery is harmless.
    unsubscribe = subscribe(jobId, (_e: SequencedEvent) => {
      if (closed) return
      const state = getJob(jobId)
      if (!state) return
      flushFrom(state)
      terminalFrom(state)
    })
  } else {
    // Remote job: poll the Redis mirror. inFlight guards against overlapping
    // reads if Redis is slow.
    let inFlight = false
    pollTimer = setInterval(() => {
      if (closed || inFlight) return
      inFlight = true
      getJobAcrossInstances(jobId)
        .then((state) => {
          if (closed) return
          if (!state) {
            // Mirror expired (TTL) without a terminal event reaching us.
            send('error', { message: 'job state expired' })
            close()
            return
          }
          // A remote job whose producer pod died stops updating its mirror;
          // the stall rules turn it terminal here instead of hanging.
          const effective = effectiveJobState(state)
          flushFrom(effective)
          terminalFrom(effective)
        })
        .catch(() => {
          // Transient Redis error — keep polling; the TTL branch above ends
          // the stream if the state is truly gone.
        })
        .finally(() => {
          inFlight = false
        })
    }, REMOTE_POLL_MS)
    pollTimer.unref?.()
  }

  // Replay events from the state fetched at connect, then check whether the
  // job already completed (covers jobs that finished before — or during —
  // this connection setup).
  flushFrom(job)
  if (terminalFrom(job)) return

  event.node.req.on('close', close)
  event.node.req.on('aborted', close)

  // Block until the connection is closed so the H3 handler does not return
  // (which would tear down the response stream).
  await new Promise<void>((resolve) => {
    res.on('close', resolve)
    res.on('finish', resolve)
  })
})
