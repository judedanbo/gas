import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRedis } from '~/server/utils/redis'
import {
  createJob,
  getJob,
  getJobAcrossInstances,
  updateJob,
  pushEvent
} from '~/server/utils/pdfOptimizationJobs'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/redis', () => ({
  getRedis: vi.fn(() => null)
}))

function makeFakeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    client: {
      async set(key: string, value: string) {
        store.set(key, value)
        return 'OK'
      },
      async get(key: string) {
        return store.get(key) ?? null
      }
    }
  }
}

describe('pdfOptimizationJobs', () => {
  beforeEach(() => {
    vi.mocked(getRedis).mockReturnValue(null)
  })

  it('serves local jobs without Redis', async () => {
    const job = createJob('/pdf/reports/x.pdf', 1)
    expect(getJob(job.id)).toBe(job)
    await expect(getJobAcrossInstances(job.id)).resolves.toBe(job)
  })

  it('mirrors every mutation to Redis when configured', () => {
    const fake = makeFakeRedis()
    vi.mocked(getRedis).mockReturnValue(fake.client as never)

    const job = createJob('/pdf/reports/y.pdf', 2)
    updateJob(job.id, { status: 'running' })
    pushEvent(job.id, { phase: 'compress' } as never)

    const mirrored = fake.store.get(`gas:pdf-opt:${job.id}`)
    expect(mirrored).toBeTruthy()
    const parsed = JSON.parse(mirrored!)
    expect(parsed.status).toBe('running')
    expect(parsed.events).toHaveLength(1)
    // Seqs survive the JSON round-trip so remote consumers can dedupe.
    expect(parsed.events[0]).toEqual({ seq: 1, event: { phase: 'compress' } })
    expect(parsed.nextSeq).toBe(2)
  })

  it('stamps monotonically increasing seqs and keeps the highest after trimming', () => {
    const job = createJob('/pdf/reports/big.pdf', 4)
    for (let i = 0; i < 510; i++) {
      pushEvent(job.id, { phase: 'classify', page: i, totalPages: 510 } as never)
    }
    const state = getJob(job.id)!
    // Ring buffer caps at 500 — the oldest 10 are trimmed, seqs are stable.
    expect(state.events).toHaveLength(500)
    expect(state.events[0].seq).toBe(11)
    expect(state.events[state.events.length - 1].seq).toBe(510)
    for (let i = 1; i < state.events.length; i++) {
      expect(state.events[i].seq).toBe(state.events[i - 1].seq + 1)
    }
  })

  it('falls back to the Redis mirror for jobs owned by another instance', async () => {
    // The multi-replica production bug: the SSE GET lands on a pod whose local
    // map has never seen the job. The Redis mirror must satisfy the lookup.
    const fake = makeFakeRedis()
    vi.mocked(getRedis).mockReturnValue(fake.client as never)

    const remoteState = {
      id: 'remote-job-id',
      status: 'running',
      fileUrl: '/pdf/reports/z.pdf',
      reportId: 3,
      events: [{ seq: 1, event: { phase: 'inspect' } }],
      nextSeq: 2,
      startedAt: 1,
      updatedAt: 2
    }
    fake.store.set('gas:pdf-opt:remote-job-id', JSON.stringify(remoteState))

    expect(getJob('remote-job-id')).toBeUndefined()
    await expect(getJobAcrossInstances('remote-job-id')).resolves.toEqual(remoteState)
  })

  it('returns undefined when the job exists nowhere', async () => {
    const fake = makeFakeRedis()
    vi.mocked(getRedis).mockReturnValue(fake.client as never)
    await expect(getJobAcrossInstances('ghost')).resolves.toBeUndefined()
  })
})
