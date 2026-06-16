/**
 * Per-account login lockout.
 *
 * The login handler also rate-limits per IP, but that does not stop a
 * distributed attacker (many source IPs) brute-forcing one known account.
 * This module tracks failed attempts on the user row and locks the account
 * after too many failures within a window, with exponential backoff on repeat
 * lockouts. State lives in DB columns on `users` (failedLoginAttempts,
 * lockoutCount, lockedUntil, lastFailedLoginAt); a successful login resets it.
 *
 * All thresholds are env-configurable; the defaults are sensible for an admin
 * panel. The pure functions here take/return plain values so they can be
 * unit-tested without a database.
 */
import { parseDuration } from './duration'

export interface LockoutConfig {
  maxFailures: number
  windowMs: number
  baseLockoutMs: number
  multiplier: number
  maxLockoutMs: number
}

/** Subset of a user row this module reads. */
export interface LockoutUserState {
  failedLoginAttempts: number
  lockoutCount: number
  lockedUntil: Date | null
  lastFailedLoginAt: Date | null
}

/** Column values to write after a failed/successful attempt. */
export interface LockoutUpdate {
  failedLoginAttempts: number
  lockoutCount: number
  lockedUntil: Date | null
  lastFailedLoginAt: Date | null
}

const DEFAULTS = {
  maxFailures: 10,
  windowMs: 15 * 60_000, // 15m
  baseLockoutMs: 15 * 60_000, // 15m
  multiplier: 2,
  maxLockoutMs: 24 * 3_600_000 // 24h
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function getLockoutConfig(): LockoutConfig {
  return {
    maxFailures: parsePositiveInt(process.env.LOGIN_LOCKOUT_MAX_FAILURES, DEFAULTS.maxFailures),
    windowMs: parseDuration(process.env.LOGIN_LOCKOUT_WINDOW, DEFAULTS.windowMs),
    baseLockoutMs: parseDuration(process.env.LOGIN_LOCKOUT_BASE_DURATION, DEFAULTS.baseLockoutMs),
    // Multiplier of 1 disables backoff (constant lockout duration).
    multiplier: parsePositiveNumber(
      process.env.LOGIN_LOCKOUT_BACKOFF_MULTIPLIER,
      DEFAULTS.multiplier
    ),
    maxLockoutMs: parseDuration(process.env.LOGIN_LOCKOUT_MAX_DURATION, DEFAULTS.maxLockoutMs)
  }
}

/**
 * Backoff duration for the n-th consecutive lockout (n >= 1):
 * min(base × multiplier^(n−1), max).
 */
export function lockoutDurationMs(lockoutCount: number, cfg: LockoutConfig = getLockoutConfig()): number {
  const n = Math.max(1, lockoutCount)
  const scaled = cfg.baseLockoutMs * Math.pow(cfg.multiplier, n - 1)
  return Math.min(Math.round(scaled), cfg.maxLockoutMs)
}

/** True when the account is currently locked. */
export function isAccountLocked(
  user: Pick<LockoutUserState, 'lockedUntil'>,
  now: Date = new Date()
): boolean {
  return !!user.lockedUntil && user.lockedUntil.getTime() > now.getTime()
}

/**
 * Compute the new lockout columns after a failed login.
 *
 * Failures within `windowMs` of the previous one accumulate; otherwise the
 * window restarts at 1. On reaching `maxFailures` the account is locked for the
 * backed-off duration, `lockoutCount` is bumped (driving the next backoff), and
 * the attempt counter resets so a fresh window starts once the lock expires.
 */
export function nextFailureState(
  user: LockoutUserState,
  now: Date = new Date(),
  cfg: LockoutConfig = getLockoutConfig()
): LockoutUpdate {
  const withinWindow =
    !!user.lastFailedLoginAt && now.getTime() - user.lastFailedLoginAt.getTime() <= cfg.windowMs
  const attempts = withinWindow ? user.failedLoginAttempts + 1 : 1

  if (attempts >= cfg.maxFailures) {
    const lockoutCount = user.lockoutCount + 1
    return {
      failedLoginAttempts: 0,
      lockoutCount,
      lockedUntil: new Date(now.getTime() + lockoutDurationMs(lockoutCount, cfg)),
      lastFailedLoginAt: now
    }
  }

  return {
    failedLoginAttempts: attempts,
    lockoutCount: user.lockoutCount,
    lockedUntil: null,
    lastFailedLoginAt: now
  }
}

/** Column values to clear lockout state after a successful login. */
export function lockoutResetState(): LockoutUpdate {
  return {
    failedLoginAttempts: 0,
    lockoutCount: 0,
    lockedUntil: null,
    lastFailedLoginAt: null
  }
}
