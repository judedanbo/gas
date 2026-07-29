import { describe, it, expect, vi, beforeAll } from 'vitest'
import { EventEmitter } from 'node:events'
import { createJob, pushEvent, updateJob } from '~/server/utils/pdfOptimizationJobs'
import type { OptimizeResult } from '~/server/utils/pdfOptimizer'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/adminHelpers', () => ({
  requirePermission: vi.fn()
}))

vi.mock('~/server/utils/redis', () => ({
  getRedis: vi.fn(() => null)
}))

// The handler relies on Nitro's auto-imported h3 helpers, which don't exist in
// plain Vitest. Stub them on globalThis BEFORE the dynamic import below —
// module evaluation reads them at call time.
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('getQuery', (event: { query: Record<string, unknown> }) => event.query)
vi.stubGlobal(
  'getHeader',
  (event: { headers: Record<string, string> }, name: string) => event.headers?.[name]
)
vi.stubGlobal('createError', (input: object) => Object.assign(new Error('h3'), input))
vi.stubGlobal('setResponseHeaders', () => undefined)

class FakeRes extends EventEmitter {
  chunks: string[] = []
  ended = false
  flushHeaders(): void {}
  write(chunk: string): boolean {
    this.chunks.push(chunk)
    return true
  }
  end(): void {
    this.ended = true
    this.emit('finish')
  }
}

interface FakeH3Event {
  query: Record<string, unknown>
  headers: Record<string, string>
  node: { req: EventEmitter; res: FakeRes }
}

function makeEvent(jobId: string, headers: Record<string, string> = {}) {
  const res = new FakeRes()
  const req = new EventEmitter()
  const event: FakeH3Event = { query: { jobId }, headers, node: { req, res } }
  return { event, res }
}

interface Frame {
  id?: number
  event?: string
  data?: Record<string, unknown>
}

function parseFrames(chunks: string[]): Frame[] {
  return chunks
    .join('')
    .split('\n\n')
    .filter((block) => block.trim().length > 0 && !block.startsWith(': ping'))
    .map((block) => {
      const frame: Frame = {}
      for (const line of block.split('\n')) {
        if (line.startsWith('id: ')) frame.id = Number(line.slice(4))
        else if (line.startsWith('event: ')) frame.event = line.slice(7)
        else if (line.startsWith('data: ')) {
          frame.data = JSON.parse(line.slice(6)) as Record<string, unknown>
        }
      }
      return frame
    })
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

let handler: (event: FakeH3Event) => Promise<void>

beforeAll(async () => {
  handler = (await import('~/server/api/admin/reports/optimize-stream.get'))
    .default as unknown as typeof handler
})

const successResult: OptimizeResult = {
  originalSize: 100,
  optimizedSize: 60,
  savedBytes: 40,
  skippedCompression: false,
  nativePages: 2,
  scannedPages: 1,
  pageCount: 3
}

describe('GET /api/admin/reports/optimize-stream', () => {
  it('404s for an unknown job', async () => {
    const { event } = makeEvent('no-such-job')
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('replays existing events then delivers live ones without duplicates', async () => {
    const job = createJob('/pdf/reports/live.pdf', 1)
    updateJob(job.id, { status: 'running' })
    pushEvent(job.id, { phase: 'inspect', pageCount: 3, hasBookmarks: false })
    pushEvent(job.id, { phase: 'split' })

    const { event, res } = makeEvent(job.id)
    const done = handler(event)
    await nextTick()

    pushEvent(job.id, { phase: 'compress' })
    updateJob(job.id, { status: 'success', result: successResult })
    pushEvent(job.id, {
      phase: 'done',
      originalSize: 100,
      optimizedSize: 60,
      savedBytes: 40,
      skippedCompression: false,
      nativePages: 2,
      scannedPages: 1
    })
    await done

    const frames = parseFrames(res.chunks)
    const progress = frames.filter((f) => f.event === 'progress')
    // 2 replayed + 2 live (compress + done), each exactly once, in seq order.
    expect(progress.map((f) => f.id)).toEqual([1, 2, 3, 4])
    expect(progress.map((f) => f.data?.phase)).toEqual(['inspect', 'split', 'compress', 'done'])
    const terminal = frames.filter((f) => f.event === 'done')
    expect(terminal).toHaveLength(1)
    expect(terminal[0].data).toMatchObject({ savedBytes: 40 })
    expect(res.ended).toBe(true)
  })

  it('survives ring-buffer trimming without skipping or duplicating', async () => {
    const job = createJob('/pdf/reports/huge.pdf', 2)
    updateJob(job.id, { status: 'running' })
    for (let i = 0; i < 510; i++) {
      pushEvent(job.id, { phase: 'classify', page: i + 1, totalPages: 510, kind: 'native' })
    }

    const { event, res } = makeEvent(job.id)
    const done = handler(event)
    await nextTick()

    updateJob(job.id, { status: 'error', error: 'boom' })
    pushEvent(job.id, {
      phase: 'done',
      originalSize: 0,
      optimizedSize: 0,
      savedBytes: 0,
      skippedCompression: true,
      nativePages: 0,
      scannedPages: 0
    })
    await done

    const progress = parseFrames(res.chunks).filter((f) => f.event === 'progress')
    // The buffer keeps the newest 500 of 510; the replay starts at seq 11 and
    // the live terminal push is seq 511 — strictly increasing throughout.
    expect(progress[0].id).toBe(11)
    expect(progress[progress.length - 1].id).toBe(511)
    const ids = progress.map((f) => f.id!)
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBe(ids[i - 1] + 1)
    }
  })

  it('sends the terminal frame immediately for an already-finished job', async () => {
    const job = createJob('/pdf/reports/finished.pdf', 3)
    pushEvent(job.id, { phase: 'inspect', pageCount: 1, hasBookmarks: false })
    updateJob(job.id, { status: 'success', result: successResult })

    const { event, res } = makeEvent(job.id)
    await handler(event)

    const frames = parseFrames(res.chunks)
    expect(frames.filter((f) => f.event === 'progress')).toHaveLength(1)
    expect(frames.filter((f) => f.event === 'done')).toHaveLength(1)
    expect(res.ended).toBe(true)
  })

  it('resumes from Last-Event-ID without re-replaying seen events', async () => {
    const job = createJob('/pdf/reports/resume.pdf', 4)
    updateJob(job.id, { status: 'running' })
    for (let i = 0; i < 5; i++) {
      pushEvent(job.id, { phase: 'classify', page: i + 1, totalPages: 5, kind: 'native' })
    }
    updateJob(job.id, { status: 'error', error: 'gone' })

    const { event, res } = makeEvent(job.id, { 'last-event-id': '3' })
    await handler(event)

    const frames = parseFrames(res.chunks)
    const progress = frames.filter((f) => f.event === 'progress')
    expect(progress.map((f) => f.id)).toEqual([4, 5])
    expect(frames.filter((f) => f.event === 'error')).toHaveLength(1)
  })
})
