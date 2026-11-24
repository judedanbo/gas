import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkMultiWindowRateLimit,
  consumeMultiWindowRateLimit,
  type RateLimitWindow
} from '~/server/utils/rateLimiter'

// No REDIS_URL in tests, so these exercise the in-process backend: the same
// rules the Redis script implements (see CONSUME_SCRIPT in rateLimiter.ts).
vi.mock('~/server/utils/redis', () => ({
  getRedis: vi.fn(() => null)
}))

const MINUTE = { limit: 5, windowMs: 60_000 }
const HOUR = { limit: 50, windowMs: 3_600_000 }

function windows(files: number): RateLimitWindow[] {
  return [
    { name: 'download:minute', config: MINUTE },
    { name: 'download:hour', config: HOUR, cost: files }
  ]
}

// A fresh identifier per test keeps tests independent of the shared store.
let visitor = 0
function nextVisitor(): string {
  return `203.0.113.${++visitor}`
}

describe('consumeMultiWindowRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('charges each window its own cost', async () => {
    const ip = nextVisitor()

    const first = await consumeMultiWindowRateLimit(ip, windows(20))
    // Minute: 1 of 5 used (4 left). Hour: 20 of 50 used (30 left).
    expect(first).toMatchObject({ isLimited: false, limit: 5, remaining: 4, limitedBy: null })

    const second = await consumeMultiWindowRateLimit(ip, windows(25))
    expect(second).toMatchObject({ isLimited: false, limit: 5, remaining: 3 })

    // 45 of 50 used: a ZIP of 10 no longer fits, and says how many would.
    const third = await consumeMultiWindowRateLimit(ip, windows(10))
    expect(third).toMatchObject({
      isLimited: true,
      limit: 50,
      remaining: 5,
      limitedBy: 'download:hour',
      retryAfterSeconds: 3600
    })
  })

  it('takes nothing from any window when the request is refused', async () => {
    const ip = nextVisitor()
    await consumeMultiWindowRateLimit(ip, windows(45))

    // Refused three times over...
    for (let i = 0; i < 3; i++) {
      expect((await consumeMultiWindowRateLimit(ip, windows(10))).isLimited).toBe(true)
    }

    // ...yet the 5 remaining files, and the minute window, are still intact:
    // 1 of 5 minute units used before this, so this is the second.
    const fits = await consumeMultiWindowRateLimit(ip, windows(5))
    expect(fits).toMatchObject({ isLimited: false, limit: 50, remaining: 0 })
  })

  it('answers a dry run without spending anything', async () => {
    const ip = nextVisitor()

    for (let i = 0; i < 10; i++) {
      const peek = await consumeMultiWindowRateLimit(ip, windows(25), { dryRun: true })
      expect(peek).toMatchObject({ isLimited: false, limit: 5, remaining: 5 })
    }

    const real = await consumeMultiWindowRateLimit(ip, windows(25))
    expect(real).toMatchObject({ isLimited: false, remaining: 4 })
  })

  it('reports in a dry run that a download would be refused', async () => {
    const ip = nextVisitor()
    await consumeMultiWindowRateLimit(ip, windows(40))

    const peek = await consumeMultiWindowRateLimit(ip, windows(11), { dryRun: true })

    expect(peek).toMatchObject({ isLimited: true, remaining: 10, limitedBy: 'download:hour' })
  })

  it('enforces the per-minute window on bulk requests too', async () => {
    const ip = nextVisitor()
    for (let i = 0; i < 5; i++) {
      expect((await consumeMultiWindowRateLimit(ip, windows(1))).isLimited).toBe(false)
    }

    const sixth = await consumeMultiWindowRateLimit(ip, windows(1))

    expect(sixth).toMatchObject({
      isLimited: true,
      limit: 5,
      remaining: 0,
      limitedBy: 'download:minute',
      retryAfterSeconds: 60
    })
  })

  it('names the window that takes longest to clear when several block', async () => {
    const ip = nextVisitor()
    for (let i = 0; i < 5; i++) await consumeMultiWindowRateLimit(ip, windows(10))

    // Both the minute (5/5) and the hour (50/50) windows are now full.
    const blocked = await consumeMultiWindowRateLimit(ip, windows(1))

    expect(blocked).toMatchObject({ isLimited: true, limitedBy: 'download:hour' })
  })

  it('frees the allowance again when a window ends', async () => {
    const ip = nextVisitor()
    await consumeMultiWindowRateLimit(ip, windows(50))
    expect((await consumeMultiWindowRateLimit(ip, windows(1))).isLimited).toBe(true)

    vi.advanceTimersByTime(3_600_001)

    const afterReset = await consumeMultiWindowRateLimit(ip, windows(25))
    expect(afterReset).toMatchObject({ isLimited: false, remaining: 4 })
  })

  it('draws on the same budget as single-file downloads', async () => {
    const ip = nextVisitor()
    const singleDownload = () =>
      checkMultiWindowRateLimit(ip, [
        { name: 'download:minute', config: MINUTE },
        { name: 'download:hour', config: HOUR }
      ])

    // Three single downloads, then a ZIP of 25: 28 of 50 used this hour.
    for (let i = 0; i < 3; i++) await singleDownload()
    await consumeMultiWindowRateLimit(ip, windows(25))

    const peek = await consumeMultiWindowRateLimit(ip, windows(25), { dryRun: true })
    expect(peek).toMatchObject({ isLimited: true, remaining: 22, limitedBy: 'download:hour' })

    // And the ZIP used a minute slot the fifth request needs.
    expect((await singleDownload()).isLimited).toBe(false)
    expect((await singleDownload()).isLimited).toBe(true)
  })

  it('can never admit a request that costs more than the whole window', async () => {
    const result = await consumeMultiWindowRateLimit(nextVisitor(), windows(51))

    expect(result).toMatchObject({ isLimited: true, remaining: 50, limitedBy: 'download:hour' })
  })
})
