import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useReportUploadJobs,
  useReportUploadJob,
  UPLOAD_JOB_ACTIVE_POLL_MS,
  UPLOAD_JOB_IDLE_POLL_MS
} from '~/composables/useReportUploadJobs'
import type { ReportUploadJob } from '~/types/admin'

// The composables use the auto-imported useAdminApi; stub it globally.
const apiGet = vi.fn()
const apiPost = vi.fn()
vi.stubGlobal('useAdminApi', () => ({ get: apiGet, post: apiPost }))

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function job(overrides: Partial<ReportUploadJob> = {}): ReportUploadJob {
  return {
    id: 'job-1',
    status: 'optimizing',
    active: true,
    progress: 40,
    phase: 'classify',
    page: 2,
    totalPages: 10,
    originalName: 'a.pdf',
    filename: 'x.pdf',
    fileUrl: '/pdf/reports/x.pdf',
    mimeType: 'application/pdf',
    size: 100,
    finalSize: null,
    preset: 'ebook',
    thumbnailUrl: null,
    optimizationJobId: null,
    optimizationStatus: 'pending',
    optimizationResult: null,
    error: null,
    errorCode: null,
    reportId: null,
    reportTitle: null,
    user: null,
    dismissedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  apiGet.mockReset()
  apiPost.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useReportUploadJobs (list polling)', () => {
  it('polls fast while a job is active and slowly once everything is done', async () => {
    apiGet.mockResolvedValueOnce({ data: [job()], activeCount: 1 })
    const list = useReportUploadJobs({ autoStart: false })
    list.startPolling()
    await flush()

    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet.mock.calls[0][0]).toBe('reports/upload-jobs')
    expect(list.jobs.value).toHaveLength(1)
    expect(list.hasActive.value).toBe(true)
    expect(list.loaded.value).toBe(true)

    // Active → next poll after the fast interval.
    apiGet.mockResolvedValueOnce({
      data: [job({ status: 'completed', active: false })],
      activeCount: 0
    })
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS)
    await flush()
    expect(apiGet).toHaveBeenCalledTimes(2)
    expect(list.hasActive.value).toBe(false)

    // Idle → nothing until the slow interval elapses.
    apiGet.mockResolvedValueOnce({ data: [], activeCount: 0 })
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS)
    expect(apiGet).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_IDLE_POLL_MS)
    await flush()
    expect(apiGet).toHaveBeenCalledTimes(3)

    list.stopPolling()
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_IDLE_POLL_MS * 2)
    expect(apiGet).toHaveBeenCalledTimes(3)
  })

  it('surfaces a fetch error without dropping the last good list', async () => {
    apiGet.mockResolvedValueOnce({ data: [job()], activeCount: 1 })
    const list = useReportUploadJobs({ autoStart: false })
    list.startPolling()
    await flush()

    apiGet.mockRejectedValueOnce({ statusCode: 500, message: 'boom' })
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS)
    await flush()
    expect(list.error.value).toBe('boom')
    expect(list.jobs.value).toHaveLength(1)
    list.stopPolling()
  })

  it("asks for the caller's own jobs as background polls when configured", async () => {
    apiGet.mockResolvedValueOnce({ data: [], activeCount: 0 })
    const list = useReportUploadJobs({
      autoStart: false,
      mine: true,
      background: true,
      idlePollMs: 30_000
    })
    list.startPolling()
    await flush()

    const [endpoint, params, options] = apiGet.mock.calls[0]
    expect(endpoint).toBe('reports/upload-jobs')
    expect(params).toMatchObject({ mine: 'true' })
    expect(options).toEqual({ headers: { 'X-Admin-Background': '1' } })

    // Idle cadence follows the configured interval, not the default.
    apiGet.mockResolvedValue({ data: [], activeCount: 0 })
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_IDLE_POLL_MS)
    expect(apiGet).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000 - UPLOAD_JOB_IDLE_POLL_MS)
    await flush()
    expect(apiGet).toHaveBeenCalledTimes(2)
    list.stopPolling()
  })

  it('stops polling on 403 — retrying cannot grant the permission', async () => {
    apiGet.mockRejectedValueOnce({ statusCode: 403, message: 'Forbidden' })
    const list = useReportUploadJobs({ autoStart: false })
    list.startPolling()
    await flush()
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_IDLE_POLL_MS * 4)
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  it('keeps an upserted job when an older poll lands afterwards', async () => {
    let resolveStale: (v: unknown) => void = () => {}
    apiGet.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve
        })
    )
    const list = useReportUploadJobs({ autoStart: false })
    const pending = list.fetchJobs()

    list.upsert(job({ id: 'fresh' }))
    resolveStale({ data: [], activeCount: 0 })
    await pending

    expect(list.jobs.value.map((j) => j.id)).toEqual(['fresh'])

    // Upserting a known id replaces it in place.
    list.upsert(job({ id: 'fresh', progress: 90 }))
    expect(list.jobs.value).toHaveLength(1)
    expect(list.jobs.value[0].progress).toBe(90)
  })

  it('ignores a response that arrives after a newer one', async () => {
    const resolvers: Array<(v: unknown) => void> = []
    apiGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        })
    )
    const list = useReportUploadJobs({ autoStart: false })
    const first = list.fetchJobs()
    const second = list.fetchJobs()

    resolvers[1]({ data: [job({ id: 'new' })], activeCount: 1 })
    await second
    resolvers[0]({ data: [job({ id: 'old' })], activeCount: 1 })
    await first

    expect(list.jobs.value.map((j) => j.id)).toEqual(['new'])
  })

  it('dismissFinished clears every finished row but keeps running ones', async () => {
    apiGet.mockResolvedValueOnce({
      data: [
        job({ id: 'done', status: 'completed', active: false }),
        job({ id: 'failed', status: 'failed', active: false }),
        job({ id: 'running' })
      ],
      activeCount: 1
    })
    apiPost.mockResolvedValueOnce({ success: true, dismissed: 2 })
    const list = useReportUploadJobs({ autoStart: false })
    await list.fetchJobs()

    expect(await list.dismissFinished()).toBe(true)
    expect(apiPost).toHaveBeenCalledWith('reports/upload-jobs/dismiss-finished')
    expect(list.jobs.value.map((j) => j.id)).toEqual(['running'])
  })

  it('dismiss posts and removes the row locally', async () => {
    apiGet.mockResolvedValueOnce({
      data: [job({ id: 'a', status: 'completed', active: false }), job({ id: 'b' })],
      activeCount: 1
    })
    apiPost.mockResolvedValueOnce({ success: true })
    const list = useReportUploadJobs({ autoStart: false })
    await list.fetchJobs()
    expect(await list.dismiss('a')).toBe(true)
    expect(apiPost).toHaveBeenCalledWith('reports/upload-jobs/a/dismiss')
    expect(list.jobs.value.map((j) => j.id)).toEqual(['b'])
  })
})

describe('useReportUploadJob (single job)', () => {
  it('seeds from a job object and keeps polling until terminal', async () => {
    const follower = useReportUploadJob()
    follower.follow(job())
    expect(follower.job.value?.id).toBe('job-1')
    expect(follower.isActive.value).toBe(true)
    expect(apiGet).not.toHaveBeenCalled()

    apiGet.mockResolvedValueOnce(job({ progress: 70 }))
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS)
    await flush()
    expect(apiGet).toHaveBeenCalledWith('reports/upload-jobs/job-1')
    expect(follower.job.value?.progress).toBe(70)

    apiGet.mockResolvedValueOnce(job({ status: 'completed', active: false, progress: 100 }))
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS)
    await flush()
    expect(follower.isActive.value).toBe(false)

    // Terminal → no more polling.
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS * 3)
    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  it('fetches immediately when following by id and stops on 404', async () => {
    const follower = useReportUploadJob()
    apiGet.mockRejectedValueOnce({ statusCode: 404 })
    follower.follow('gone')
    await flush()
    expect(apiGet).toHaveBeenCalledWith('reports/upload-jobs/gone')
    expect(follower.error.value).toBeTruthy()
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS * 2)
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  it('ignores a stale response after switching to another job', async () => {
    const follower = useReportUploadJob()
    let resolveFirst: (v: unknown) => void = () => {}
    apiGet.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        })
    )
    follower.follow('first')
    await flush()

    apiGet.mockResolvedValueOnce(job({ id: 'second', status: 'completed', active: false }))
    follower.follow('second')
    await flush()
    expect(follower.job.value?.id).toBe('second')

    resolveFirst(job({ id: 'first' }))
    await flush()
    expect(follower.job.value?.id).toBe('second')
  })
})
