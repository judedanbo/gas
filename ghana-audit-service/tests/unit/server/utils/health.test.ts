import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildHealthReport } from '~/server/utils/health'
import { checkConnection } from '~/server/database'
import { getRedis } from '~/server/utils/redis'
import type { Redis } from 'ioredis'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/database', () => ({
  checkConnection: vi.fn()
}))

vi.mock('~/server/utils/redis', () => ({
  getRedis: vi.fn()
}))

const mockCheckConnection = vi.mocked(checkConnection)
const mockGetRedis = vi.mocked(getRedis)

function redisWithPing(ping: () => Promise<'PONG'>): Redis {
  return { ping } as unknown as Redis
}

describe('buildHealthReport', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports ok when the database is up and Redis is not configured', async () => {
    mockCheckConnection.mockResolvedValue(true)
    mockGetRedis.mockReturnValue(null)

    const report = await buildHealthReport()

    expect(report.status).toBe('ok')
    expect(report.checks).toEqual({ database: 'up', redis: 'not_configured' })
    expect(new Date(report.timestamp).getTime()).not.toBeNaN()
  })

  it('reports ok when both the database and Redis respond', async () => {
    mockCheckConnection.mockResolvedValue(true)
    mockGetRedis.mockReturnValue(redisWithPing(() => Promise.resolve('PONG')))

    const report = await buildHealthReport()

    expect(report.status).toBe('ok')
    expect(report.checks).toEqual({ database: 'up', redis: 'up' })
  })

  it('reports degraded (not error) when a configured Redis is unreachable', async () => {
    mockCheckConnection.mockResolvedValue(true)
    mockGetRedis.mockReturnValue(redisWithPing(() => Promise.reject(new Error('ECONNREFUSED'))))

    const report = await buildHealthReport()

    expect(report.status).toBe('degraded')
    expect(report.checks).toEqual({ database: 'up', redis: 'down' })
  })

  it('reports error when the database is down', async () => {
    mockCheckConnection.mockResolvedValue(false)
    mockGetRedis.mockReturnValue(null)

    const report = await buildHealthReport()

    expect(report.status).toBe('error')
    expect(report.checks.database).toBe('down')
  })

  it('treats a hung database check as down instead of hanging the probe', async () => {
    vi.useFakeTimers()
    mockCheckConnection.mockReturnValue(new Promise(() => {})) // never settles
    mockGetRedis.mockReturnValue(null)

    const pending = buildHealthReport()
    await vi.advanceTimersByTimeAsync(5000)
    const report = await pending

    expect(report.status).toBe('error')
    expect(report.checks.database).toBe('down')
  })
})
