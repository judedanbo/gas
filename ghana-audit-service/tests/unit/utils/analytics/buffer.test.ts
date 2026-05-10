import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  pushAnalyticsEvent,
  flushAnalyticsBuffer,
  closeAnalyticsBuffer,
  initAnalyticsBuffer,
  __getBufferStateForTests,
  __resetBufferForTests
} from '../../../../server/utils/analytics/buffer'
import type { NewRequestEvent } from '../../../../server/database/schema/analytics'

// Mock the database singleton so the buffer can be exercised without MySQL.
// vi.mock is hoisted by Vitest's transformer, so it takes effect before the
// imports above evaluate even though it appears after them in source order.
const insertCalls: unknown[][] = []
let nextInsertShouldThrow: Error | null = null

vi.mock('../../../../server/database', () => {
  const insert = vi.fn(() => ({
    values: vi.fn(async (rows: unknown[]) => {
      if (nextInsertShouldThrow) {
        const e = nextInsertShouldThrow
        nextInsertShouldThrow = null
        throw e
      }
      insertCalls.push(rows)
    })
  }))
  return {
    getDatabase: () => ({ insert }),
    schema: {}
  }
})

function makeEvent(overrides: Partial<NewRequestEvent> = {}): NewRequestEvent {
  return {
    method: 'GET',
    routePattern: '/api/reports/[id]',
    routePath: '/api/reports/123',
    status: 200,
    durationMs: 12,
    bytesOut: 1024,
    cacheHit: false,
    ipHash: 'a'.repeat(64),
    uaHash: 'b'.repeat(64),
    uaFamily: 'browser',
    country: null,
    asn: null,
    referrerHost: null,
    isBot: null,
    role: null,
    ...overrides
  }
}

describe('analytics/buffer', () => {
  beforeEach(() => {
    insertCalls.length = 0
    nextInsertShouldThrow = null
    __resetBufferForTests()
  })

  afterEach(async () => {
    await closeAnalyticsBuffer()
  })

  it('flushes manually when buffer has entries', async () => {
    pushAnalyticsEvent(makeEvent())
    pushAnalyticsEvent(makeEvent())
    expect(__getBufferStateForTests().length).toBe(2)

    await flushAnalyticsBuffer()

    expect(insertCalls).toHaveLength(1)
    expect((insertCalls[0] as unknown[]).length).toBe(2)
    expect(__getBufferStateForTests().length).toBe(0)
  })

  it('is a no-op when the buffer is empty', async () => {
    await flushAnalyticsBuffer()
    expect(insertCalls).toHaveLength(0)
  })

  it('auto-flushes when threshold (env-overridden to 3) is reached', async () => {
    process.env.ANALYTICS_FLUSH_THRESHOLD = '3'
    vi.resetModules()
    const m = await import('../../../../server/utils/analytics/buffer')
    m.__resetBufferForTests()

    m.pushAnalyticsEvent(makeEvent())
    m.pushAnalyticsEvent(makeEvent())
    m.pushAnalyticsEvent(makeEvent()) // hits threshold → triggers flush

    // pushAnalyticsEvent fires-and-forgets; let microtasks settle.
    await new Promise((r) => setImmediate(r))

    expect(insertCalls).toHaveLength(1)
    expect((insertCalls[0] as unknown[]).length).toBe(3)
    delete process.env.ANALYTICS_FLUSH_THRESHOLD
  })

  it('re-queues events when the flush throws', async () => {
    pushAnalyticsEvent(makeEvent({ routePath: '/first' }))
    pushAnalyticsEvent(makeEvent({ routePath: '/second' }))

    nextInsertShouldThrow = new Error('connection refused')
    await flushAnalyticsBuffer()

    // Insert was attempted but failed; events are back in the buffer.
    expect(__getBufferStateForTests().length).toBe(2)
    expect(__getBufferStateForTests().dropped).toBe(0)

    // Next flush succeeds — events drain.
    await flushAnalyticsBuffer()
    expect(insertCalls).toHaveLength(1)
    expect((insertCalls[0] as unknown[]).length).toBe(2)
    expect(__getBufferStateForTests().length).toBe(0)
  })

  it('drops oldest events when HARD_CAP is reached', async () => {
    process.env.ANALYTICS_BUFFER_CAP = '3'
    vi.resetModules()
    const m = await import('../../../../server/utils/analytics/buffer')
    m.__resetBufferForTests()

    m.pushAnalyticsEvent(makeEvent({ routePath: '/a' }))
    m.pushAnalyticsEvent(makeEvent({ routePath: '/b' }))
    m.pushAnalyticsEvent(makeEvent({ routePath: '/c' }))
    expect(m.__getBufferStateForTests().length).toBe(3)

    m.pushAnalyticsEvent(makeEvent({ routePath: '/d' }))
    expect(m.__getBufferStateForTests().length).toBe(3)
    expect(m.__getBufferStateForTests().dropped).toBe(1)

    delete process.env.ANALYTICS_BUFFER_CAP
  })

  it('init then close stops the periodic timer', async () => {
    initAnalyticsBuffer()
    expect(__getBufferStateForTests().hasTimer).toBe(true)
    await closeAnalyticsBuffer()
    expect(__getBufferStateForTests().hasTimer).toBe(false)
  })

  it('close drains pending events to the sink', async () => {
    pushAnalyticsEvent(makeEvent())
    pushAnalyticsEvent(makeEvent())
    await closeAnalyticsBuffer()
    expect(insertCalls).toHaveLength(1)
    expect((insertCalls[0] as unknown[]).length).toBe(2)
  })
})
