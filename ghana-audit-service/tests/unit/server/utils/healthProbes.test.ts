import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getPool } from '~/server/database'
import {
  checkReadiness,
  isHealthProbePath,
  __resetReadinessForTests
} from '~/server/utils/healthProbes'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/database', () => ({
  getPool: vi.fn()
}))

const query = vi.fn()

const READY = { status: 'ready', checks: { database: 'up' } }
const UNAVAILABLE = { status: 'unavailable', checks: { database: 'down' } }

describe('healthProbes', () => {
  beforeEach(() => {
    __resetReadinessForTests()
    query.mockReset()
    vi.mocked(getPool).mockReset()
    vi.mocked(getPool).mockReturnValue({ query } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('isHealthProbePath', () => {
    it('matches exactly the probe paths', () => {
      expect(isHealthProbePath('/healthz')).toBe(true)
      expect(isHealthProbePath('/readyz')).toBe(true)
      for (const path of ['/', '/healthz/', '/api/health', '/readyz/x', '/ak/healthz']) {
        expect(isHealthProbePath(path)).toBe(false)
      }
    })
  })

  describe('checkReadiness', () => {
    it('is ready when the pool answers SELECT 1', async () => {
      query.mockResolvedValue([[{ 1: 1 }], []])

      await expect(checkReadiness()).resolves.toEqual(READY)
      expect(query).toHaveBeenCalledWith('SELECT 1')
    })

    it('is unavailable when the query fails', async () => {
      query.mockRejectedValue(
        Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
      )

      await expect(checkReadiness()).resolves.toEqual(UNAVAILABLE)
    })

    it('is unavailable when the pool cannot be created', async () => {
      vi.mocked(getPool).mockImplementation(() => {
        throw new Error('bad config')
      })

      await expect(checkReadiness()).resolves.toEqual(UNAVAILABLE)
    })

    it('answers within the timeout when the database hangs, without piling up queries', async () => {
      vi.useFakeTimers()
      let settle!: (value: unknown) => void
      query.mockReturnValue(new Promise((resolve) => (settle = resolve)))

      const first = checkReadiness()
      await vi.advanceTimersByTimeAsync(2000)
      await expect(first).resolves.toEqual(UNAVAILABLE)

      // A later probe (past the result TTL) waits on the same stuck query
      // rather than checking out another pool connection.
      const second = checkReadiness()
      await vi.advanceTimersByTimeAsync(2000)
      await expect(second).resolves.toEqual(UNAVAILABLE)
      expect(query).toHaveBeenCalledTimes(1)

      // Once it settles, the next check runs a fresh query.
      settle([[{ 1: 1 }], []])
      await vi.advanceTimersByTimeAsync(1000)
      query.mockResolvedValue([[{ 1: 1 }], []])
      await expect(checkReadiness()).resolves.toEqual(READY)
      expect(query).toHaveBeenCalledTimes(2)
    })

    it('answers a burst of requests from one database round-trip', async () => {
      vi.useFakeTimers()
      query.mockResolvedValue([[{ 1: 1 }], []])

      const burst = await Promise.all(Array.from({ length: 20 }, () => checkReadiness()))
      expect(burst.every((r) => r.status === 'ready')).toBe(true)
      expect(await checkReadiness()).toEqual(READY)
      expect(query).toHaveBeenCalledTimes(1)

      // The cached result expires after a second.
      await vi.advanceTimersByTimeAsync(1000)
      query.mockRejectedValue(new Error('gone'))
      await expect(checkReadiness()).resolves.toEqual(UNAVAILABLE)
      expect(query).toHaveBeenCalledTimes(2)
    })
  })
})
