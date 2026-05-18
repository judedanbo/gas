import { describe, it, expect, afterEach, vi } from 'vitest'
import { parseDuration, getSessionConfig } from '../../../server/utils/duration'

describe('parseDuration', () => {
  it('parses unit suffixes', () => {
    expect(parseDuration('500ms', 0)).toBe(500)
    expect(parseDuration('90s', 0)).toBe(90_000)
    expect(parseDuration('30m', 0)).toBe(30 * 60_000)
    expect(parseDuration('8h', 0)).toBe(8 * 3_600_000)
    expect(parseDuration('7d', 0)).toBe(7 * 86_400_000)
  })

  it('treats a bare number as milliseconds and tolerates whitespace', () => {
    expect(parseDuration('1500', 0)).toBe(1500)
    expect(parseDuration('  2 h ', 0)).toBe(2 * 3_600_000)
  })

  it('falls back on missing or unparseable input', () => {
    expect(parseDuration(undefined, 999)).toBe(999)
    expect(parseDuration('', 999)).toBe(999)
    expect(parseDuration('soon', 999)).toBe(999)
    expect(parseDuration('-5m', 999)).toBe(999)
    expect(parseDuration('0', 999)).toBe(999)
  })
})

describe('getSessionConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses sane defaults when env is unset', () => {
    const cfg = getSessionConfig()
    expect(cfg.idleTimeoutMs).toBe(30 * 60_000)
    expect(cfg.absoluteTimeoutMs).toBe(8 * 3_600_000)
    expect(cfg.warningBeforeMs).toBe(2 * 60_000)
  })

  it('reads overrides from the environment', () => {
    vi.stubEnv('SESSION_IDLE_TIMEOUT', '15m')
    vi.stubEnv('SESSION_ABSOLUTE_TIMEOUT', '4h')
    vi.stubEnv('SESSION_WARNING_BEFORE', '90s')
    const cfg = getSessionConfig()
    expect(cfg.idleTimeoutMs).toBe(15 * 60_000)
    expect(cfg.absoluteTimeoutMs).toBe(4 * 3_600_000)
    expect(cfg.warningBeforeMs).toBe(90_000)
  })

  it('clamps the warning lead time below the idle window', () => {
    vi.stubEnv('SESSION_IDLE_TIMEOUT', '10m')
    vi.stubEnv('SESSION_WARNING_BEFORE', '30m')
    const cfg = getSessionConfig()
    expect(cfg.warningBeforeMs).toBe(5 * 60_000)
  })
})
