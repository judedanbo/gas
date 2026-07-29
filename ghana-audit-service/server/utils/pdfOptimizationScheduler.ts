import { getRedis } from './redis'
import {
  effectiveJobState,
  getJob,
  getJobAcrossInstances,
  type JobState
} from './pdfOptimizationJobs'

// Ghostscript + Tesseract are CPU-heavy and run in the web pod, so at most
// this many optimizations execute concurrently per process. Anything beyond
// waits in FIFO order with job status 'queued'.
const MAX_RUNNING = 2

// Cross-replica per-file index: fileUrl -> jobId of the active optimization.
// TTL matches the job mirror so a dead pod's claim self-releases.
const ACTIVE_INDEX_PREFIX = 'gas:pdf-opt-active:'
const ACTIVE_INDEX_TTL_SEC = 30 * 60

interface QueueItem {
  jobId: string
  fileUrl: string
  run: () => Promise<void>
}

// In-process state. Registration and lookup of the local index are
// synchronous on purpose: the optimize endpoint claims a file and creates its
// job in one synchronous block, so two same-file POSTs on one pod can never
// both win. Cross-replica the Redis NX write narrows (but cannot fully close)
// the race — an acceptable worst case of one duplicate optimization.
const activeByFile = new Map<string, string>()
const queue: QueueItem[] = []
let running = 0

function isTerminal(state: JobState): boolean {
  return state.status === 'success' || state.status === 'error'
}

/**
 * Synchronous local-only lookup of an active job for this file. Used by the
 * optimize endpoint's post-materialize re-check (no await between this and
 * job creation → race-free in-process).
 */
export function getActiveJobIdLocal(fileUrl: string): string | undefined {
  const jobId = activeByFile.get(fileUrl)
  if (!jobId) return undefined
  const state = getJob(jobId)
  if (!state || isTerminal(effectiveJobState(state))) {
    activeByFile.delete(fileUrl)
    return undefined
  }
  return jobId
}

/**
 * Find the active (queued/running) optimization job for a file across all
 * replicas, or undefined if the file is free. Stale index entries — pointing
 * at terminal or stalled jobs — are treated as free and cleaned up.
 */
export async function getActiveJobForFile(fileUrl: string): Promise<string | undefined> {
  const local = getActiveJobIdLocal(fileUrl)
  if (local) return local

  const redis = getRedis()
  if (!redis) return undefined
  try {
    const remoteJobId = await redis.get(ACTIVE_INDEX_PREFIX + fileUrl)
    if (!remoteJobId) return undefined
    const state = await getJobAcrossInstances(remoteJobId)
    if (state && !isTerminal(effectiveJobState(state))) return remoteJobId
    // Stale claim (job finished, stalled, or its mirror expired) — release it.
    await redis.del(ACTIVE_INDEX_PREFIX + fileUrl)
    return undefined
  } catch {
    // Redis trouble degrades to in-process-only dedup, same as the job mirror.
    return undefined
  }
}

/**
 * Claim the file for a job. The local claim is synchronous; the Redis mirror
 * is best-effort (NX so a concurrent remote claim is not clobbered).
 */
export function registerActiveJob(fileUrl: string, jobId: string): void {
  activeByFile.set(fileUrl, jobId)
  const redis = getRedis()
  if (!redis) return
  void redis
    .set(ACTIVE_INDEX_PREFIX + fileUrl, jobId, 'EX', ACTIVE_INDEX_TTL_SEC, 'NX')
    .catch(() => {
      /* best-effort */
    })
}

function releaseActiveJob(fileUrl: string, jobId: string): void {
  if (activeByFile.get(fileUrl) === jobId) {
    activeByFile.delete(fileUrl)
  }
  const redis = getRedis()
  if (!redis) return
  void (async () => {
    try {
      // Only delete our own claim — another replica may have re-claimed.
      const current = await redis.get(ACTIVE_INDEX_PREFIX + fileUrl)
      if (current === jobId) {
        await redis.del(ACTIVE_INDEX_PREFIX + fileUrl)
      }
    } catch {
      /* best-effort; TTL is the backstop */
    }
  })()
}

/**
 * Enqueue an optimization run. Starts immediately if a slot is free,
 * otherwise waits in FIFO order (job status stays 'queued' until run()
 * begins). Slot release and file-index cleanup always happen in the finally,
 * regardless of how run() ends — the watchdog never touches these.
 */
export function enqueue(jobId: string, fileUrl: string, run: () => Promise<void>): void {
  queue.push({ jobId, fileUrl, run })
  pump()
}

function pump(): void {
  while (running < MAX_RUNNING && queue.length > 0) {
    const item = queue.shift()!
    running++
    void item
      .run()
      .catch(() => {
        // run() owns its own error reporting (job state + audit log); the
        // scheduler only guarantees cleanup.
      })
      .finally(() => {
        running--
        releaseActiveJob(item.fileUrl, item.jobId)
        pump()
      })
  }
}

/** Test helper: reset all scheduler state between test cases. */
export function __resetSchedulerForTests(): void {
  activeByFile.clear()
  queue.length = 0
  running = 0
}
