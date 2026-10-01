import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRateLimit, getClientIP } from '~/server/utils/rateLimiter'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/database', () => ({
  getPool: vi.fn()
}))

vi.mock('~/server/utils/rateLimiter', () => ({
  getClientIP: vi.fn(() => '203.0.113.9'),
  checkRateLimit: vi.fn(async () => ({
    isLimited: false,
    remaining: 99,
    resetTime: Date.now() + 60_000
  })),
  checkMultiWindowRateLimit: vi.fn(),
  createRateLimitKey: vi.fn((ip: string, route: string) => `${ip}:${route}`),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60_000 },
    page: { limit: 100, windowMs: 60_000 },
    form: { limit: 5, windowMs: 60_000 },
    search: { limit: 30, windowMs: 60_000 },
    download: { limit: 10, windowMs: 60_000 },
    downloadHourly: { limit: 50, windowMs: 3_600_000 }
  }
}))

vi.mock('~/server/utils/analytics/recordIncident', () => ({ recordIncident: vi.fn() }))
vi.mock('~/server/utils/analytics/recordIncidentDeduped', () => ({
  recordIncidentDeduped: vi.fn()
}))
vi.mock('~/server/utils/analytics/buffer', () => ({ pushAnalyticsEvent: vi.fn() }))
vi.mock('~/server/utils/analytics/geoip', () => ({
  getGeoIp: vi.fn(() => ({ country: null, asn: null }))
}))

// h3 auto-imported helpers — stub BEFORE the dynamic imports below.
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('setHeader', vi.fn())
vi.stubGlobal('setResponseStatus', vi.fn())

type Middleware = (event: ReturnType<typeof fakeEvent>) => unknown
const { default: analytics } = (await import('~/server/middleware/00-analytics')) as unknown as {
  default: Middleware
}
const { default: rateLimit } = (await import('~/server/middleware/rateLimit')) as unknown as {
  default: Middleware
}

// A browser request arriving through the ingress (X-Forwarded-For set), so the
// analytics middleware's kube-probe user-agent skip cannot be what exempts the
// probe paths: they are skipped for anyone who requests them.
function fakeEvent(path: string) {
  return {
    path,
    method: 'GET',
    context: {} as Record<string, unknown>,
    node: {
      req: {
        headers: {
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)',
          'x-forwarded-for': '203.0.113.9'
        },
        httpVersion: '1.1'
      },
      res: { on: vi.fn(), statusCode: 200, getHeader: vi.fn() }
    }
  }
}

describe('health probe exemptions', () => {
  beforeEach(() => {
    vi.mocked(getClientIP).mockClear()
    vi.mocked(checkRateLimit).mockClear()
  })

  it.each(['/healthz', '/readyz'])('analytics capture skips %s', (path) => {
    const event = fakeEvent(path)

    analytics(event)

    expect(event.context.analytics).toBeUndefined()
    expect(event.node.res.on).not.toHaveBeenCalled()
  })

  it.each(['/healthz', '/readyz'])('rate limiting skips %s', async (path) => {
    await expect(rateLimit(fakeEvent(path))).resolves.toBeUndefined()

    expect(getClientIP).not.toHaveBeenCalled()
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  it('still captures and rate-limits ordinary pages', async () => {
    const event = fakeEvent('/about')

    analytics(event)
    await rateLimit(event)

    expect(event.context.analytics).toBeDefined()
    expect(event.node.res.on).toHaveBeenCalledWith('close', expect.any(Function))
    expect(checkRateLimit).toHaveBeenCalledWith('203.0.113.9:page', 100, 60_000)
  })
})
