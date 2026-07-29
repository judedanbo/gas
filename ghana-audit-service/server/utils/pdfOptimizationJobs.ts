import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { getRedis } from './redis'
import type { OptimizeResult, ProgressEvent } from './pdfOptimizer'

export type JobStatus = 'queued' | 'running' | 'success' | 'error'

// Events carry a per-job monotonically increasing sequence number so consumers
// (SSE replay, polling clients) can dedupe across reconnects even after the
// ring buffer below has trimmed older entries — an array index cannot survive
// a trim, a seq can.
export interface SequencedEvent {
  seq: number
  event: ProgressEvent
}

export interface JobState {
  id: string
  status: JobStatus
  fileUrl: string
  reportId?: number | null
  events: SequencedEvent[]
  nextSeq: number
  error?: string
  errorCode?: string
  result?: OptimizeResult
  startedAt: number
  updatedAt: number
}

// Bound the per-job ring buffer of progress events. SSE reconnects will replay
// these; a long-running optimization on a 500-page report still fits well
// under this cap.
const MAX_EVENTS_PER_JOB = 500

// Wipe finished jobs from memory this long after they complete. The Redis
// mirror uses TTL for the same purpose.
const COMPLETED_TTL_MS = 30 * 60 * 1000

const JOB_REDIS_PREFIX = 'gas:pdf-opt:'
const JOB_REDIS_TTL_SEC = 30 * 60

// Watchdog thresholds. A 'running' job whose producer died mid-flight stops
// emitting events, so inactivity (updatedAt) is the signal — the threshold
// sits above the longest single child-process timeout (Ghostscript, 10 min),
// because a live job always emits or fails within that window. Queued jobs
// never advance updatedAt, so they get a separate total-wait cap instead.
const RUNNING_STALL_TIMEOUT_MS = 15 * 60_000
const QUEUE_WAIT_TIMEOUT_MS = 30 * 60_000
const SWEEP_INTERVAL_MS = 60_000

const jobs = new Map<string, JobState>()

// One EventEmitter per job lets SSE handlers push events to listeners without
// polling. Emitters are local to this process — if the producer and consumer
// of a job live on different Nitro instances (multi-replica deploy), the
// consumer falls back to polling the Redis mirror.
const emitters = new Map<string, EventEmitter>()

function getEmitter(id: string): EventEmitter {
  let em = emitters.get(id)
  if (!em) {
    em = new EventEmitter()
    em.setMaxListeners(50)
    emitters.set(id, em)
  }
  return em
}

function scheduleCleanup(id: string): void {
  setTimeout(() => {
    jobs.delete(id)
    emitters.delete(id)
  }, COMPLETED_TTL_MS).unref?.()
}

async function mirrorToRedis(state: JobState): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(JOB_REDIS_PREFIX + state.id, JSON.stringify(state), 'EX', JOB_REDIS_TTL_SEC)
  } catch {
    // Mirror is a best-effort affordance for multi-instance deploys. If
    // Redis is unhealthy, the in-process map still serves single-instance
    // clients correctly.
  }
}

let sweepTimer: ReturnType<typeof setInterval> | undefined

// Lazily started with the first job so idle processes never tick.
function ensureSweeper(): void {
  if (sweepTimer) return
  sweepTimer = setInterval(() => sweepStalledJobs(), SWEEP_INTERVAL_MS)
  sweepTimer.unref?.()
}

function stallOf(
  state: JobState,
  now: number
): { errorCode: 'TIMEOUT' | 'QUEUE_TIMEOUT' } | null {
  if (state.status === 'running' && now - state.updatedAt > RUNNING_STALL_TIMEOUT_MS) {
    return { errorCode: 'TIMEOUT' }
  }
  if (state.status === 'queued' && now - state.startedAt > QUEUE_WAIT_TIMEOUT_MS) {
    return { errorCode: 'QUEUE_TIMEOUT' }
  }
  return null
}

/**
 * Mark local jobs that stopped making progress as errored so clients don't
 * hang until the Redis TTL expires. Exported (with injectable clock) for
 * tests; production runs it on the sweep interval.
 *
 * The watchdog only flips client-visible job state — scheduler slots and
 * per-file indexes are owned by the scheduler's own completion handling (or,
 * for a dead pod, the Redis TTL).
 */
export function sweepStalledJobs(now: number = Date.now()): void {
  for (const state of jobs.values()) {
    const stall = stallOf(state, now)
    if (!stall) continue
    updateJob(state.id, {
      status: 'error',
      error: 'Optimization timed out',
      errorCode: stall.errorCode
    })
    // Terminal event so SSE subscribers get notified instead of hanging.
    pushEvent(state.id, {
      phase: 'done',
      originalSize: 0,
      optimizedSize: 0,
      savedBytes: 0,
      skippedCompression: true,
      nativePages: 0,
      scannedPages: 0,
      ocrFailedPages: 0
    })
  }
}

/**
 * Apply the stall rules to a job state without mutating it. Consumers of
 * Redis-deserialized states (SSE remote poll, status endpoint, scheduler
 * stale-index check) use this so a job owned by a dead pod still terminates
 * client-side before the 30-minute mirror TTL.
 */
export function effectiveJobState(state: JobState, now: number = Date.now()): JobState {
  const stall = stallOf(state, now)
  if (!stall) return state
  return {
    ...state,
    status: 'error',
    error: 'Optimization timed out',
    errorCode: stall.errorCode
  }
}

export function createJob(fileUrl: string, reportId?: number | null): JobState {
  ensureSweeper()
  const state: JobState = {
    id: randomUUID(),
    status: 'queued',
    fileUrl,
    reportId: reportId ?? null,
    events: [],
    nextSeq: 1,
    startedAt: Date.now(),
    updatedAt: Date.now()
  }
  jobs.set(state.id, state)
  void mirrorToRedis(state)
  return state
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id)
}

export async function getJobAcrossInstances(id: string): Promise<JobState | undefined> {
  const local = jobs.get(id)
  if (local) return local
  const redis = getRedis()
  if (!redis) return undefined
  try {
    const raw = await redis.get(JOB_REDIS_PREFIX + id)
    if (!raw) return undefined
    return JSON.parse(raw) as JobState
  } catch {
    return undefined
  }
}

export function updateJob(id: string, patch: Partial<JobState>): JobState | undefined {
  const state = jobs.get(id)
  if (!state) return undefined
  Object.assign(state, patch, { updatedAt: Date.now() })
  void mirrorToRedis(state)
  if (state.status === 'success' || state.status === 'error') {
    scheduleCleanup(id)
  }
  return state
}

export function pushEvent(id: string, event: ProgressEvent): void {
  const state = jobs.get(id)
  if (!state) return
  const wrapped: SequencedEvent = { seq: state.nextSeq++, event }
  state.events.push(wrapped)
  if (state.events.length > MAX_EVENTS_PER_JOB) {
    state.events.splice(0, state.events.length - MAX_EVENTS_PER_JOB)
  }
  state.updatedAt = Date.now()
  void mirrorToRedis(state)
  getEmitter(id).emit('event', wrapped)
}

export function subscribe(id: string, listener: (event: SequencedEvent) => void): () => void {
  const em = getEmitter(id)
  em.on('event', listener)
  return () => em.off('event', listener)
}
