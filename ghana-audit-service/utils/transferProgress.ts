/**
 * Helpers for showing download progress: a smoothed transfer rate and the
 * time-remaining estimate derived from it. Pure (the caller supplies the
 * clock) so the maths is unit-testable without real network or timers.
 */

export interface TransferRateMeter {
  /** Record the cumulative byte count observed at `time` (ms). */
  push(loadedBytes: number, time: number): void
  /** Bytes per second over the sliding window, or null until there is enough data. */
  rate(): number | null
  reset(): void
}

/**
 * Sliding-window rate meter. A window (rather than the average since the
 * start) lets the estimate follow a connection that speeds up or stalls,
 * while still smoothing the burstiness of individual network chunks.
 *
 * Callers should also push on a timer, not only when a chunk arrives —
 * otherwise a stalled transfer keeps reporting its last good speed.
 */
export function createTransferRateMeter(windowMs = 5000, minSpanMs = 750): TransferRateMeter {
  const samples: { bytes: number; time: number }[] = []

  return {
    push(loadedBytes, time) {
      samples.push({ bytes: loadedBytes, time })
      // Keep the oldest sample at (or just past) the window edge so the span
      // covers the whole window once the transfer has run that long.
      while (samples.length > 2 && time - samples[1].time >= windowMs) {
        samples.shift()
      }
    },
    rate() {
      if (samples.length < 2) return null
      const first = samples[0]
      const last = samples[samples.length - 1]
      const span = last.time - first.time
      // Too short a span gives wild first estimates (one fast chunk ⇒ "1 GB/s").
      if (span < minSpanMs) return null
      return Math.max(0, ((last.bytes - first.bytes) * 1000) / span)
    },
    reset() {
      samples.length = 0
    }
  }
}

/**
 * Whole seconds until `total` is reached at `bytesPerSecond`, or null when it
 * can't be estimated (unknown size, no rate yet, or a stalled transfer).
 */
export function estimateSecondsRemaining(
  loaded: number,
  total: number | null,
  bytesPerSecond: number | null
): number | null {
  if (!total || total <= 0 || !bytesPerSecond || bytesPerSecond <= 0) return null
  const remaining = Math.max(0, total - loaded)
  return Math.ceil(remaining / bytesPerSecond)
}

/** Percentage (0–100, whole number) or null when the total size is unknown. */
export function progressPercent(loaded: number, total: number | null): number | null {
  if (!total || total <= 0) return null
  return Math.min(100, Math.max(0, Math.floor((loaded / total) * 100)))
}

/**
 * Split a duration into the parts the UI formats. Rounded to steps that don't
 * flicker: 5 s under a minute, whole minutes above ten minutes.
 */
export function splitDuration(totalSeconds: number): {
  hours: number
  minutes: number
  seconds: number
} {
  let s = Math.max(0, Math.round(totalSeconds))
  if (s >= 600) s = Math.round(s / 60) * 60
  else if (s > 10 && s < 60) s = Math.ceil(s / 5) * 5

  return {
    hours: Math.floor(s / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60
  }
}
