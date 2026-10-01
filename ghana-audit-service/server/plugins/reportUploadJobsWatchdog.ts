import { pruneUploadJobs, sweepStalledUploadJobs } from '../utils/reportUploadJobs'

/**
 * Watchdog for background report uploads.
 *
 * The pipeline heartbeats its job row while alive; if the pod that owns a
 * job dies mid-flight, the row would otherwise sit at "optimizing" forever.
 * Every minute, rows silent past STALL_TIMEOUT_MS are flipped to failed so
 * the notification center reports it honestly. Hourly, old terminal rows are
 * pruned.
 * Mirrors the sessionCleanup plugin's lifecycle wiring.
 */

const SWEEP_INTERVAL_MS = 60_000
const PRUNE_INTERVAL_MS = 60 * 60_000
const FIRST_SWEEP_DELAY_MS = 20_000

async function sweep(): Promise<void> {
  try {
    const flipped = await sweepStalledUploadJobs()
    if (flipped > 0) {
      console.warn(`[reportUploadJobs] marked ${flipped} stalled upload job(s) as failed`)
    }
  } catch (err) {
    console.warn('[reportUploadJobs] sweep failed:', (err as Error).message)
  }
}

async function prune(): Promise<void> {
  try {
    await pruneUploadJobs()
  } catch (err) {
    console.warn('[reportUploadJobs] prune failed:', (err as Error).message)
  }
}

export default defineNitroPlugin((nitroApp) => {
  const first = setTimeout(() => {
    void sweep()
    void prune()
  }, FIRST_SWEEP_DELAY_MS)
  first.unref?.()

  const sweepTimer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS)
  sweepTimer.unref?.()
  const pruneTimer = setInterval(() => void prune(), PRUNE_INTERVAL_MS)
  pruneTimer.unref?.()

  nitroApp.hooks.hook('close', () => {
    clearTimeout(first)
    clearInterval(sweepTimer)
    clearInterval(pruneTimer)
  })
})
