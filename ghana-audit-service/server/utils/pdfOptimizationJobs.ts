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

export function createJob(fileUrl: string, reportId?: number | null): JobState {
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
