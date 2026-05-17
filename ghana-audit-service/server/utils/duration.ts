/**
 * Duration parsing + admin session timing config.
 *
 * Durations accept a number with an optional unit suffix: `ms`, `s`, `m`,
 * `h`, `d` (e.g. `30m`, `8h`, `90s`, `500ms`). A bare number is milliseconds.
 * Anything unparseable falls back to the provided default.
 */

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000
}

export function parseDuration(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/)
  if (!match) return fallbackMs
  const amount = Number.parseFloat(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs
  const unit = match[2] || 'ms'
  return Math.round(amount * UNIT_MS[unit])
}

export interface SessionConfig {
  /** Sliding inactivity window. */
  idleTimeoutMs: number
  /** Hard cap measured from login, regardless of activity. */
  absoluteTimeoutMs: number
  /** How long before idle expiry the client shows the countdown modal. */
  warningBeforeMs: number
}

const DEFAULTS = {
  idleMs: 30 * 60_000, // 30m
  absoluteMs: 8 * 3_600_000, // 8h
  warningMs: 2 * 60_000 // 2m
}

export function getSessionConfig(): SessionConfig {
  const idleTimeoutMs = parseDuration(process.env.SESSION_IDLE_TIMEOUT, DEFAULTS.idleMs)
  const absoluteTimeoutMs = parseDuration(process.env.SESSION_ABSOLUTE_TIMEOUT, DEFAULTS.absoluteMs)
  let warningBeforeMs = parseDuration(process.env.SESSION_WARNING_BEFORE, DEFAULTS.warningMs)

  // The warning must fit inside the idle window; otherwise it would show
  // immediately on every login. Clamp to half the idle window.
  if (warningBeforeMs >= idleTimeoutMs) {
    warningBeforeMs = Math.floor(idleTimeoutMs / 2)
  }

  return { idleTimeoutMs, absoluteTimeoutMs, warningBeforeMs }
}
