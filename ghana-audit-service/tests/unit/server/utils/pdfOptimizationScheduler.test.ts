import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRedis } from '~/server/utils/redis'
import { createJob, updateJob } from '~/server/utils/pdfOptimizationJobs'
import {
  enqueue,
  getActiveJobForFile,
  getActiveJobIdLocal,
  registerActiveJob,
  releaseActiveJob,
  __resetSchedulerForTests
} from '~/server/utils/pdfOptimizationScheduler'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/redis', () => ({
  getRedis: vi.fn(() => null)
}))

function makeFakeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    client: {
      async set(key: string, value: string, ..._opts: unknown[]) {
        store.set(key, value)
        return 'OK'
      },
      async get(key: string) {
        return store.get(key) ?? null
      },
      async del(key: string) {
        return store.delete(key) ? 1 : 0
      }
    }
  }
}

function deferred() {
  let resolve!: () => void
  let reject!: (err: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('pdfOptimizationScheduler', () => {
  beforeEach(() => {
    __resetSchedulerForTests()
    vi.mocked(getRedis).mockReturnValue(null)
  })

  it('runs at most two jobs concurrently, FIFO for the rest', async () => {
    const started: string[] = []
    const gates = [deferred(), deferred(), deferred()]

    for (const [i, gate] of gates.entries()) {
      const job = createJob(`/pdf/reports/cap-${i}.pdf`)
      enqueue(job.id, job.fileUrl, () => {
        started.push(job.fileUrl)
        return gate.promise
      })
    }

    expect(started).toEqual(['/pdf/reports/cap-0.pdf', '/pdf/reports/cap-1.pdf'])

    gates[0].resolve()
    await flush()
    expect(started).toEqual([
      '/pdf/reports/cap-0.pdf',
      '/pdf/reports/cap-1.pdf',
      '/pdf/reports/cap-2.pdf'
    ])

    gates[1].resolve()
    gates[2].resolve()
    await flush()
  })

  it('lets an aborted item through at once, without waiting for a slot, and frees its file', async () => {
    const gates = [deferred(), deferred()]
    for (const [i, gate] of gates.entries()) {
      const job = createJob(`/pdf/reports/slot-${i}.pdf`)
      enqueue(job.id, job.fileUrl, () => gate.promise)
    }
    const waiting = createJob('/pdf/reports/aborted-in-queue.pdf')
    registerActiveJob(waiting.fileUrl, waiting.id)
    const controller = new AbortController()
    const run = vi.fn(async () => {})
    enqueue(waiting.id, waiting.fileUrl, run, controller.signal)
    expect(run).not.toHaveBeenCalled()

    controller.abort()

    // Both slots are still taken, yet the aborted item has run (and, doing no
    // work, finished) — so its file is free again.
    expect(run).toHaveBeenCalledTimes(1)
    await flush()
    expect(getActiveJobIdLocal(waiting.fileUrl)).toBeUndefined()

    // The slots it never held are untouched: one more item still queues.
    const next = createJob('/pdf/reports/after-abort.pdf')
    const nextRun = vi.fn(async () => {})
    enqueue(next.id, next.fileUrl, nextRun)
    expect(nextRun).not.toHaveBeenCalled()
    gates[0].resolve()
    await flush()
    expect(nextRun).toHaveBeenCalledTimes(1)
    gates[1].resolve()
    await flush()
  })

  it('releaseActiveJob drops the claim in Redis before resolving, but never another job’s', async () => {
    const fake = makeFakeRedis()
    vi.mocked(getRedis).mockReturnValue(fake.client as never)

    const job = createJob('/pdf/reports/release-await.pdf')
    registerActiveJob(job.fileUrl, job.id)
    await flush()
    await releaseActiveJob(job.fileUrl, job.id)
    expect(fake.store.has('gas:pdf-opt-active:/pdf/reports/release-await.pdf')).toBe(false)
    expect(getActiveJobIdLocal(job.fileUrl)).toBeUndefined()

    // Re-claimed by another replica meanwhile: left alone.
    fake.store.set('gas:pdf-opt-active:/pdf/reports/release-await.pdf', 'other-job')
    await releaseActiveJob(job.fileUrl, job.id)
    expect(fake.store.get('gas:pdf-opt-active:/pdf/reports/release-await.pdf')).toBe('other-job')
  })

  it('registers and resolves the active job for a file, ignoring terminal jobs', () => {
    const job = createJob('/pdf/reports/dedup.pdf', 1)
    registerActiveJob(job.fileUrl, job.id)

    expect(getActiveJobIdLocal(job.fileUrl)).toBe(job.id)

    updateJob(job.id, { status: 'success' })
    expect(getActiveJobIdLocal(job.fileUrl)).toBeUndefined()
  })

  it('releases the file claim when the run finishes (success or failure)', async () => {
    const ok = createJob('/pdf/reports/release-ok.pdf')
    registerActiveJob(ok.fileUrl, ok.id)
    enqueue(ok.id, ok.fileUrl, async () => {})

    const bad = createJob('/pdf/reports/release-bad.pdf')
    registerActiveJob(bad.fileUrl, bad.id)
    enqueue(bad.id, bad.fileUrl, async () => {
      throw new Error('optimizer exploded')
    })

    await flush()
    expect(getActiveJobIdLocal(ok.fileUrl)).toBeUndefined()
    expect(getActiveJobIdLocal(bad.fileUrl)).toBeUndefined()
  })

  it('finds a live claim from another replica via Redis', async () => {
    const fake = makeFakeRedis()
    vi.mocked(getRedis).mockReturnValue(fake.client as never)

    fake.store.set('gas:pdf-opt-active:/pdf/reports/remote.pdf', 'remote-job-1')
    fake.store.set(
      'gas:pdf-opt:remote-job-1',
      JSON.stringify({
        id: 'remote-job-1',
        status: 'running',
        fileUrl: '/pdf/reports/remote.pdf',
        reportId: null,
        events: [],
        nextSeq: 1,
        startedAt: Date.now(),
        updatedAt: Date.now()
      })
    )

    await expect(getActiveJobForFile('/pdf/reports/remote.pdf')).resolves.toBe('remote-job-1')
  })

  it('treats a stale Redis claim as free and cleans it up', async () => {
    const fake = makeFakeRedis()
    vi.mocked(getRedis).mockReturnValue(fake.client as never)

    // Claim points at a job whose mirror says it already finished.
    fake.store.set('gas:pdf-opt-active:/pdf/reports/stale.pdf', 'finished-job')
    fake.store.set(
      'gas:pdf-opt:finished-job',
      JSON.stringify({
        id: 'finished-job',
        status: 'success',
        fileUrl: '/pdf/reports/stale.pdf',
        reportId: null,
        events: [],
        nextSeq: 1,
        startedAt: 1,
        updatedAt: 2
      })
    )

    await expect(getActiveJobForFile('/pdf/reports/stale.pdf')).resolves.toBeUndefined()
    expect(fake.store.has('gas:pdf-opt-active:/pdf/reports/stale.pdf')).toBe(false)

    // A claim whose job mirror expired entirely is also free.
    fake.store.set('gas:pdf-opt-active:/pdf/reports/ghost.pdf', 'ghost-job')
    await expect(getActiveJobForFile('/pdf/reports/ghost.pdf')).resolves.toBeUndefined()
  })

  it('mirrors local claims to Redis for cross-replica visibility', () => {
    const fake = makeFakeRedis()
    vi.mocked(getRedis).mockReturnValue(fake.client as never)

    const job = createJob('/pdf/reports/mirror.pdf')
    registerActiveJob(job.fileUrl, job.id)
    // Local lookup is synchronous; the Redis write is fire-and-forget.
    expect(getActiveJobIdLocal(job.fileUrl)).toBe(job.id)
    return flush().then(() => {
      expect(fake.store.get('gas:pdf-opt-active:/pdf/reports/mirror.pdf')).toBe(job.id)
    })
  })
})
