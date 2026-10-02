import {
  pruneUploadJobs,
  recoverOrphanedUploadJobs,
  sweepStalledUploadJobs,
  uploadWorkerId,
  type UploadJobSweepResult
} from '../utils/reportUploadJobs'
import {
  drainReportUploadPipelines,
  isAcceptingUploads,
  resumeInterruptedUploadJobs
} from '../utils/reportUploadPipeline'
import { onShutdownSignal } from '../utils/shutdownSignals'

/**
 * Lifecycle for background report uploads, whose pipelines run in this
 * process and so must outlive it.
 *
 * - Shutdown: on SIGTERM (deploys, scale-down) running uploads get a short
 *   grace period, then are handed off — released for resume if their file
 *   is stored, failed if not. Started from the signal itself so the handoff
 *   lands well before the kubelet's SIGKILL; the close hook awaits it.
 * - Startup: jobs this host was running when its previous process died
 *   (OOM kill, failed liveness probe — the pod name survives a container
 *   restart) are recovered at once rather than after the stall timeout.
 * - Every sweep: jobs whose run went silent without a handoff are failed or
 *   queued for resume, and queued ones are claimed and resumed here if this
 *   process has room. Hourly, old terminal rows are pruned.
 */

// Short enough that a job handed off during a deploy resumes on a live pod
// within seconds; every step is a cheap indexed query when there is no work.
const SWEEP_INTERVAL_MS = 15_000
const PRUNE_INTERVAL_MS = 60 * 60_000
const FIRST_SWEEP_DELAY_MS = 5_000
// A dev-server reload waits for the close hook; don't hold every code change
// for the full production grace while an upload is running.
const DEV_DRAIN_GRACE_MS = 3_000

function describe(result: UploadJobSweepResult): string {
  return `${result.interrupted} queued for resume, ${result.failed} failed`
}

export default defineNitroPlugin((nitroApp) => {
  // `nuxt build` prerenders pages with this server in-process. No uploads run
  // there, and it must not recover or claim real jobs from whatever database
  // the build machine happens to reach.
  if (import.meta.prerender) return

  const startedAt = new Date()
  const worker = uploadWorkerId()
  let recovered = false
  let sweeping = false

  async function sweep(): Promise<void> {
    // Never claim work while shutting down; skip a tick rather than overlap.
    if (sweeping || !isAcceptingUploads()) return
    sweeping = true
    try {
      if (!recovered) {
        const orphans = await recoverOrphanedUploadJobs(worker, startedAt)
        recovered = true
        if (orphans.failed + orphans.interrupted > 0) {
          console.warn(
            `[reportUploadJobs] recovered upload(s) after a restart: ${describe(orphans)}`
          )
        }
      }
      const stalled = await sweepStalledUploadJobs()
      if (stalled.failed + stalled.interrupted > 0) {
        console.warn(`[reportUploadJobs] stalled upload(s): ${describe(stalled)}`)
      }
      const { resumed, finalized } = await resumeInterruptedUploadJobs()
      if (resumed > 0) console.warn(`[reportUploadJobs] resumed ${resumed} interrupted upload(s)`)
      if (finalized > 0) {
        console.warn(
          `[reportUploadJobs] gave up optimizing ${finalized} upload(s) after repeated interruptions`
        )
      }
    } catch (err) {
      console.warn('[reportUploadJobs] sweep failed:', (err as Error).message)
    } finally {
      sweeping = false
    }
  }

  async function prune(): Promise<void> {
    try {
      await pruneUploadJobs()
    } catch (err) {
      console.warn('[reportUploadJobs] prune failed:', (err as Error).message)
    }
  }

  const first = setTimeout(() => {
    void sweep()
    void prune()
  }, FIRST_SWEEP_DELAY_MS)
  first.unref?.()

  const sweepTimer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS)
  sweepTimer.unref?.()
  const pruneTimer = setInterval(() => void prune(), PRUNE_INTERVAL_MS)
  pruneTimer.unref?.()

  // The dev server runs Nitro in a worker thread that never sees signals;
  // its reloads still reach the close hook below.
  const removeSignalHandlers = import.meta.dev
    ? () => {}
    : onShutdownSignal(() => drainReportUploadPipelines())

  nitroApp.hooks.hook('close', async () => {
    clearTimeout(first)
    clearInterval(sweepTimer)
    clearInterval(pruneTimer)
    removeSignalHandlers()
    await drainReportUploadPipelines(import.meta.dev ? DEV_DRAIN_GRACE_MS : undefined)
  })
})
