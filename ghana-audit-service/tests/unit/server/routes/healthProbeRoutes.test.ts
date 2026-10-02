import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkReadiness } from '~/server/utils/healthProbes'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/healthProbes', () => ({
  checkReadiness: vi.fn()
}))

interface FakeEvent {
  status: number
  headers: Record<string, string>
}

// h3 auto-imported helpers — stub BEFORE the dynamic imports below.
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('setResponseHeaders', (event: FakeEvent, headers: Record<string, string>) =>
  Object.assign(event.headers, headers)
)
vi.stubGlobal('setHeader', (event: FakeEvent, name: string, value: string) => {
  event.headers[name] = value
})
vi.stubGlobal('setResponseStatus', (event: FakeEvent, status: number) => {
  event.status = status
})

type Handler = (event: FakeEvent) => unknown
const { default: healthz } = (await import('~/server/routes/healthz')) as unknown as {
  default: Handler
}
const { default: readyz } = (await import('~/server/routes/readyz')) as unknown as {
  default: Handler
}

function fakeEvent(): FakeEvent {
  return { status: 200, headers: {} }
}

describe('probe routes', () => {
  beforeEach(() => {
    vi.mocked(checkReadiness).mockReset()
  })

  it('GET /healthz answers ok without touching the database', () => {
    const event = fakeEvent()

    expect(healthz(event)).toBe('ok')
    expect(event.status).toBe(200)
    expect(event.headers['Cache-Control']).toBe('no-store')
    expect(event.headers['Content-Type']).toMatch(/^text\/plain/)
    expect(checkReadiness).not.toHaveBeenCalled()
  })

  it('GET /readyz answers 200 while the database is reachable', async () => {
    const report = { status: 'ready', checks: { database: 'up' } }
    vi.mocked(checkReadiness).mockResolvedValue(report as never)
    const event = fakeEvent()

    await expect(readyz(event)).resolves.toEqual(report)
    expect(event.status).toBe(200)
    expect(event.headers['Cache-Control']).toBe('no-store')
  })

  it('GET /readyz answers 503 when the database is not', async () => {
    const report = { status: 'unavailable', checks: { database: 'down' } }
    vi.mocked(checkReadiness).mockResolvedValue(report as never)
    const event = fakeEvent()

    await expect(readyz(event)).resolves.toEqual(report)
    expect(event.status).toBe(503)
    expect(event.headers['Cache-Control']).toBe('no-store')
  })
})
