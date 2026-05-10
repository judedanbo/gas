import { getDatabase } from '../../database'
import { requestEvents, type NewRequestEvent } from '../../database/schema/analytics'

/**
 * In-process buffered writer for request_events.
 *
 * Capture happens on the response 'close' event of every non-static request,
 * which is hot enough to need batching. Events accumulate in memory and flush
 * to MySQL either every FLUSH_INTERVAL_MS or once the buffer reaches
 * FLUSH_THRESHOLD entries — whichever comes first.
 *
 * Failure modes:
 * - MySQL flush throws → events are re-queued at the head of the buffer;
 *   if requeueing would exceed HARD_CAP, the oldest events spill (counted
 *   in `dropped`).
 * - Buffer hits HARD_CAP between flushes → the oldest events are dropped;
 *   `dropped` is logged every 1000 drops.
 * - Process crash → in-memory buffer is lost. Acceptable for analytics;
 *   download_events and audit logs write synchronously elsewhere.
 */

const FLUSH_INTERVAL_MS = Number(process.env.ANALYTICS_FLUSH_INTERVAL_MS) || 5_000
const FLUSH_THRESHOLD = Number(process.env.ANALYTICS_FLUSH_THRESHOLD) || 500
const HARD_CAP = Number(process.env.ANALYTICS_BUFFER_CAP) || 5_000

let buffer: NewRequestEvent[] = []
let timer: NodeJS.Timeout | null = null
let isFlushing = false
let dropped = 0

function reportDrops(extra: number) {
  const before = dropped
  dropped += extra
  // Log on each crossing of a thousand boundary so persistent failure isn't
  // silent but bursts don't spam.
  if (Math.floor(dropped / 1000) > Math.floor(before / 1000)) {
    console.warn(`[analytics-buffer] dropped ${dropped} request events; sink is failing or lagging`)
  }
}

export function initAnalyticsBuffer(): void {
  if (timer) return
  timer = setInterval(() => {
    void flushAnalyticsBuffer()
  }, FLUSH_INTERVAL_MS)
  // Don't keep the event loop alive on shutdown.
  if (typeof timer.unref === 'function') timer.unref()
}

export function pushAnalyticsEvent(ev: NewRequestEvent): void {
  if (buffer.length >= HARD_CAP) {
    buffer.shift()
    reportDrops(1)
  }
  buffer.push(ev)
  if (buffer.length >= FLUSH_THRESHOLD && !isFlushing) {
    void flushAnalyticsBuffer()
  }
}

export async function flushAnalyticsBuffer(): Promise<void> {
  if (isFlushing) return
  if (buffer.length === 0) return
  isFlushing = true
  const batch = buffer
  buffer = []
  try {
    const db = getDatabase()
    await db.insert(requestEvents).values(batch)
  } catch (err) {
    console.warn('[analytics-buffer] flush failed:', (err as Error).message)
    // Re-queue the unflushed batch at the head, respecting the cap.
    const space = Math.max(0, HARD_CAP - buffer.length)
    if (space >= batch.length) {
      buffer = [...batch, ...buffer]
    } else {
      // Keep the most recent `space` events from the failed batch; older
      // events spill. Recent events are the more useful ones for live
      // dashboards once the sink recovers.
      const requeue = batch.slice(batch.length - space)
      buffer = [...requeue, ...buffer]
      reportDrops(batch.length - space)
    }
  } finally {
    isFlushing = false
  }
}

export async function closeAnalyticsBuffer(): Promise<void> {
  if (timer) clearInterval(timer)
  timer = null
  await flushAnalyticsBuffer()
}

/**
 * Test-only helpers. Not exported through any public barrel.
 */
export function __getBufferStateForTests() {
  return { length: buffer.length, dropped, isFlushing, hasTimer: timer !== null }
}

export function __resetBufferForTests() {
  if (timer) clearInterval(timer)
  timer = null
  buffer = []
  dropped = 0
  isFlushing = false
}
