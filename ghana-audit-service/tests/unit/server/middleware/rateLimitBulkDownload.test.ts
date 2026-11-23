import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordIncident } from '~/server/utils/analytics/recordIncident'
import { BULK_REPORT_DOWNLOAD_PATH } from '~/utils/bulkReportDownload'

// Real rate limiter on its in-process backend, so these check what a visitor
// would actually be allowed, not which helper the middleware calls.
vi.mock('~/server/utils/redis', () => ({ getRedis: vi.fn(() => null) }))
vi.mock('~/server/utils/analytics/recordIncident', () => ({ recordIncident: vi.fn() }))

const headers = new Map<string, string>()
const status = { code: 200 }
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('setHeader', (_event: unknown, name: string, value: unknown) => {
  headers.set(name, String(value))
})
vi.stubGlobal('setResponseStatus', (_event: unknown, code: number) => {
  status.code = code
})

interface LimitBody {
  statusCode: number
  message: string
  retryAfter: number
  remaining?: number
}
type Middleware = (event: unknown) => Promise<LimitBody | undefined>
const { default: rateLimit } = (await import('~/server/middleware/rateLimit')) as unknown as {
  default: Middleware
}

let visitor = 0
let ip = ''

function request(path: string) {
  headers.clear()
  status.code = 200
  return rateLimit({
    path,
    method: 'GET',
    context: {},
    node: { req: { headers: {}, socket: { remoteAddress: ip } } }
  })
}

const ids = (count: number, from = 1) => Array.from({ length: count }, (_, i) => from + i).join(',')
const zip = (count: number, from = 1) =>
  request(`${BULK_REPORT_DOWNLOAD_PATH}?ids=${ids(count, from)}`)
const check = (count: number) => request(`${BULK_REPORT_DOWNLOAD_PATH}?ids=${ids(count)}&check=1`)
const single = (id: number) => request(`/api/downloads/reports/${id}`)

describe('rate limiting of bulk report downloads', () => {
  beforeEach(() => {
    ip = `198.51.100.${++visitor}`
    vi.mocked(recordIncident).mockClear()
  })

  it('counts every report in a ZIP against the hourly download limit', async () => {
    expect(await zip(25)).toBeUndefined()
    expect(await zip(25, 100)).toBeUndefined()

    // 50 files this hour: not even a single download is left.
    const third = await zip(1, 200)
    expect(status.code).toBe(429)
    expect(third).toMatchObject({ statusCode: 429, remaining: 0 })
    expect(third!.retryAfter).toBeGreaterThan(3500)
    expect(headers.get('Retry-After')).toBe(String(third!.retryAfter))

    expect((await single(7))?.statusCode).toBe(429)
  })

  it('cannot be used to get around the limit single downloads share', async () => {
    for (let id = 1; id <= 4; id++) expect(await single(id)).toBeUndefined()

    // 4 of 50 used: a full ZIP of 25 fits, a second one does not.
    expect(await zip(25)).toBeUndefined()
    const second = await check(25)

    expect(second).toMatchObject({ statusCode: 429, remaining: 21 })
  })

  it('tells the page how many reports would still fit', async () => {
    await zip(25)
    await zip(20, 100)

    const refused = await zip(10, 200)

    expect(refused).toMatchObject({ statusCode: 429, remaining: 5 })
    expect(refused!.message).toMatch(/limit/i)
    // And having been refused costs nothing: those 5 can still be downloaded.
    expect(await zip(5, 300)).toBeUndefined()
  })

  it('answers a check without spending any download allowance', async () => {
    for (let i = 0; i < 30; i++) expect(await check(25)).toBeUndefined()

    // 30 checks later the full allowance is intact: two ZIPs of 25 go through.
    expect(await zip(25)).toBeUndefined()
    expect(await zip(25, 100)).toBeUndefined()
  })

  it('still caps how often a visitor can ask', async () => {
    let refused: LimitBody | undefined
    for (let i = 0; i < 101 && !refused; i++) refused = await check(1)

    expect(refused).toMatchObject({ statusCode: 429 })
    expect(refused!.remaining).toBeUndefined()
  })

  it('applies the per-minute burst limit to ZIPs', async () => {
    for (let i = 0; i < 5; i++) expect(await zip(1, i + 1)).toBeUndefined()

    const sixth = await zip(1, 99)

    expect(sixth).toMatchObject({ statusCode: 429, remaining: 0 })
    expect(sixth!.retryAfter).toBeLessThanOrEqual(60)
  })

  it('logs a refused download as a rate-limit hit, but not a refused check', async () => {
    await zip(25)
    await zip(25, 100)

    await check(5)
    expect(recordIncident).not.toHaveBeenCalled()

    await zip(5, 200)
    expect(recordIncident).toHaveBeenCalledTimes(1)
    expect(recordIncident).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'rate_limit_download' })
    )
  })

  it('meters a malformed selection as one download and lets the handler reject it', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await request(`${BULK_REPORT_DOWNLOAD_PATH}?ids=not-a-number`)).toBeUndefined()
    }

    // Five malformed requests used the per-minute window like any five downloads.
    expect((await single(1))?.statusCode).toBe(429)
  })

  it('exposes the tightest window in the rate-limit headers', async () => {
    await zip(25)

    expect(headers.get('X-RateLimit-Limit')).toBe('5')
    expect(headers.get('X-RateLimit-Remaining')).toBe('4')
  })
})
