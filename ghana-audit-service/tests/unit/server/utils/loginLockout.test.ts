import { describe, it, expect, afterEach } from 'vitest'
import {
  getLockoutConfig,
  lockoutDurationMs,
  isAccountLocked,
  nextFailureState,
  lockoutResetState,
  type LockoutUserState
} from '~/server/utils/loginLockout'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

const MIN = 60_000
const fresh = (over: Partial<LockoutUserState> = {}): LockoutUserState => ({
  failedLoginAttempts: 0,
  lockoutCount: 0,
  lockedUntil: null,
  lastFailedLoginAt: null,
  ...over
})

describe('getLockoutConfig', () => {
  it('uses sensible defaults when env is unset', () => {
    delete process.env.LOGIN_LOCKOUT_MAX_FAILURES
    delete process.env.LOGIN_LOCKOUT_WINDOW
    delete process.env.LOGIN_LOCKOUT_BASE_DURATION
    delete process.env.LOGIN_LOCKOUT_BACKOFF_MULTIPLIER
    delete process.env.LOGIN_LOCKOUT_MAX_DURATION
    const cfg = getLockoutConfig()
    expect(cfg.maxFailures).toBe(10)
    expect(cfg.windowMs).toBe(15 * MIN)
    expect(cfg.baseLockoutMs).toBe(15 * MIN)
    expect(cfg.multiplier).toBe(2)
    expect(cfg.maxLockoutMs).toBe(24 * 60 * MIN)
  })

  it('honours env overrides (durations parsed, invalid falls back)', () => {
    process.env.LOGIN_LOCKOUT_MAX_FAILURES = '3'
    process.env.LOGIN_LOCKOUT_WINDOW = '5m'
    process.env.LOGIN_LOCKOUT_BASE_DURATION = '10m'
    process.env.LOGIN_LOCKOUT_BACKOFF_MULTIPLIER = '0' // invalid (<=0) -> default 2
    const cfg = getLockoutConfig()
    expect(cfg.maxFailures).toBe(3)
    expect(cfg.windowMs).toBe(5 * MIN)
    expect(cfg.baseLockoutMs).toBe(10 * MIN)
    expect(cfg.multiplier).toBe(2)
  })
})

describe('lockoutDurationMs (backoff)', () => {
  const cfg = { maxFailures: 10, windowMs: 15 * MIN, baseLockoutMs: 15 * MIN, multiplier: 2, maxLockoutMs: 24 * 60 * MIN }

  it('escalates exponentially per lockout cycle', () => {
    expect(lockoutDurationMs(1, cfg)).toBe(15 * MIN)
    expect(lockoutDurationMs(2, cfg)).toBe(30 * MIN)
    expect(lockoutDurationMs(3, cfg)).toBe(60 * MIN)
    expect(lockoutDurationMs(4, cfg)).toBe(120 * MIN)
  })

  it('caps at maxLockoutMs', () => {
    expect(lockoutDurationMs(99, cfg)).toBe(24 * 60 * MIN)
  })

  it('multiplier of 1 gives a constant duration', () => {
    const flat = { ...cfg, multiplier: 1 }
    expect(lockoutDurationMs(1, flat)).toBe(15 * MIN)
    expect(lockoutDurationMs(5, flat)).toBe(15 * MIN)
  })
})

describe('isAccountLocked', () => {
  const now = new Date('2026-06-16T12:00:00Z')
  it('true when lockedUntil is in the future', () => {
    expect(isAccountLocked({ lockedUntil: new Date(now.getTime() + MIN) }, now)).toBe(true)
  })
  it('false when lockedUntil is past or null', () => {
    expect(isAccountLocked({ lockedUntil: new Date(now.getTime() - MIN) }, now)).toBe(false)
    expect(isAccountLocked({ lockedUntil: null }, now)).toBe(false)
  })
})

describe('nextFailureState', () => {
  const cfg = { maxFailures: 3, windowMs: 15 * MIN, baseLockoutMs: 15 * MIN, multiplier: 2, maxLockoutMs: 24 * 60 * MIN }
  const now = new Date('2026-06-16T12:00:00Z')

  it('increments within the window without locking', () => {
    const s = nextFailureState(fresh({ failedLoginAttempts: 1, lastFailedLoginAt: new Date(now.getTime() - MIN) }), now, cfg)
    expect(s.failedLoginAttempts).toBe(2)
    expect(s.lockedUntil).toBeNull()
    expect(s.lastFailedLoginAt).toEqual(now)
  })

  it('restarts the window when the last failure is older than windowMs', () => {
    const s = nextFailureState(fresh({ failedLoginAttempts: 2, lastFailedLoginAt: new Date(now.getTime() - 20 * MIN) }), now, cfg)
    expect(s.failedLoginAttempts).toBe(1)
    expect(s.lockedUntil).toBeNull()
  })

  it('locks at maxFailures, resets attempts, and bumps lockoutCount', () => {
    const s = nextFailureState(fresh({ failedLoginAttempts: 2, lockoutCount: 0, lastFailedLoginAt: new Date(now.getTime() - MIN) }), now, cfg)
    expect(s.failedLoginAttempts).toBe(0)
    expect(s.lockoutCount).toBe(1)
    expect(s.lockedUntil).toEqual(new Date(now.getTime() + 15 * MIN))
  })

  it('applies escalating backoff on the next lockout cycle', () => {
    const s = nextFailureState(fresh({ failedLoginAttempts: 2, lockoutCount: 1, lastFailedLoginAt: new Date(now.getTime() - MIN) }), now, cfg)
    expect(s.lockoutCount).toBe(2)
    expect(s.lockedUntil).toEqual(new Date(now.getTime() + 30 * MIN))
  })
})

describe('lockoutResetState', () => {
  it('clears all four fields', () => {
    expect(lockoutResetState()).toEqual({
      failedLoginAttempts: 0,
      lockoutCount: 0,
      lockedUntil: null,
      lastFailedLoginAt: null
    })
  })
})
