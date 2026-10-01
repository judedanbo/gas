import { createJob, flushJobMirrors, interruptJob, type JobState } from './pdfOptimizationJobs'
import { enqueue, registerActiveJob, releaseActiveJob } from './pdfOptimizationScheduler'
import { runReportOptimization, type RunReportOptimizationOptions } from './runReportOptimization'
import { settledOrTimeout } from './shutdownSignals'
import { logWarn } from './logger'

/*
 * Explicit optimizations — the edit page's "Optimize" button and the
 * bookmark-drop retry (POST /api/admin/reports/optimize) — run in the process
 * that received the request, tracked only by the in-memory job store and its
 * Redis mirror. Every deploy replaces that process.
 *
 * Unlike background uploads they are not handed off for resume: a resumed
 * optimization would start over from scratch anyway, an interrupted run
 * never touches the stored file, and the admin who started it is following
 * it and can run it again. What matters is that they hear about it: on
 * shutdown (drainExplicitOptimizations) every one still queued or running is
 * reported INTERRUPTED at once, instead of reading as running until the
 * stall watchdog calls it a timeout 15 minutes later.
 */

export type ExplicitOptimizationOptions = Omit<RunReportOptimizationOptions, 'jobId' | 'signal'>

interface ExplicitRun {
  jobId: string
  fileUrl: string
  controller: AbortController
  /** Settles when the run is over, however it ends. */
  done: Promise<void>
}

/**
 * How long a process that is shutting down waits for its interrupted runs
 * to wind down (temp copies removed, or a result that was already on its
 * way to storage landed). Aborted runs stop within moments; this only bounds
 * one that can't. It runs alongside the uploads' DRAIN_GRACE_MS (20s), well
 * inside the pod's terminationGracePeriodSeconds.
 */
export const SETTLE_GRACE_MS = 10_000

let accepting = true
let drainPromise: Promise<void> | null = null
const runs = new Map<string, ExplicitRun>()

/** False once this process has started shutting down: new optimizations belong on another replica. */
export function isAcceptingOptimizations(): boolean {
  return accepting
}

/**
 * Create the job, claim its file and queue the run through the shared
 * scheduler. Synchronous, so a caller that has just checked the file is free
 * starts it without a race. Returns null, starting nothing, once this
 * process is shutting down; `source` is then still the caller's to clean up.
 */
export function startExplicitOptimization(opts: ExplicitOptimizationOptions): JobState | null {
  if (!accepting) return null
  const job = createJob(opts.fileUrl, opts.reportId)
  registerActiveJob(opts.fileUrl, job.id)

  const controller = new AbortController()
  let settle!: () => void
  const run: ExplicitRun = {
    jobId: job.id,
    fileUrl: opts.fileUrl,
    controller,
    done: new Promise<void>((resolve) => (settle = resolve))
  }
  runs.set(job.id, run)

  enqueue(
    job.id,
    opts.fileUrl,
    () =>
      runReportOptimization({ ...opts, jobId: job.id, signal: controller.signal }).finally(() => {
        runs.delete(job.id)
        settle()
      }),
    controller.signal
  )
  return job
}

/**
 * Interrupt every explicit optimization this process still has: stop taking
 * new ones, abort the runs and report them INTERRUPTED, release their files,
 * and get all of that to Redis. Then give the runs a bounded time to wind
 * down. Idempotent: the shutdown signal and Nitro's close hook share one
 * drain.
 */
export function drainExplicitOptimizations(graceMs: number = SETTLE_GRACE_MS): Promise<void> {
  drainPromise ??= drain(graceMs)
  return drainPromise
}

async function drain(graceMs: number): Promise<void> {
  accepting = false
  const interrupted = [...runs.values()]
  if (interrupted.length === 0) return

  for (const run of interrupted) {
    // Kills the running tool, and nothing is written to storage after it; a
    // queued run passes through the scheduler without starting.
    run.controller.abort(new Error('Server is shutting down'))
    // Reported now, not when the run winds down: one that was already
    // pushing its result to storage can't be stopped, and this process may
    // be gone before it finishes. If it does finish, its outcome wins.
    interruptJob(run.jobId)
  }

  // A retry lands on a live replica, which must start the file afresh rather
  // than attach to a job that is going away.
  await Promise.all(interrupted.map((run) => releaseActiveJob(run.fileUrl, run.jobId)))
  logWarn('pdfOptimizer', `shutdown: interrupted ${interrupted.length} optimization(s)`)

  await settledOrTimeout(
    interrupted.map((run) => run.done),
    graceMs
  )
  // The interruptions went out to Redis above, ahead of anything that could
  // close the client; this makes sure they (and whatever the runs reported on
  // their way out, such as a late success) have landed before the process
  // is allowed to exit.
  await flushJobMirrors()
}

/** Test helper: reset drain state and forget registered runs. */
export function __resetExplicitOptimizationsForTests(): void {
  accepting = true
  drainPromise = null
  runs.clear()
}
