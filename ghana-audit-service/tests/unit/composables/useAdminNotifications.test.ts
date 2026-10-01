import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import {
  useAdminNotifications,
  __resetAdminNotificationsForTests
} from '~/composables/useAdminNotifications'
import { UPLOAD_JOB_ACTIVE_POLL_MS } from '~/composables/useReportUploadJobs'
import type { OptimizationStatusResponse } from '~/composables/useReportOptimization'
import type { ReportUploadJob } from '~/types/admin'

// Auto-imported composables the store calls — stubbed as globals.
const apiGet = vi.fn()
const apiPost = vi.fn()
vi.stubGlobal('useAdminApi', () => ({ get: apiGet, post: apiPost }))

const currentUser = ref<{ id: number } | null>({ id: 7 })
const modules = ref<string[]>(['reports'])
vi.stubGlobal('useAdminAuth', () => ({
  user: currentUser,
  hasModule: (m: string) => modules.value.includes(m)
}))

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
vi.stubGlobal('useToast', () => toast)

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
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
    originalName: 'AG Report.pdf',
    filename: 'x.pdf',
    fileUrl: '/pdf/reports/x.pdf',
    mimeType: 'application/pdf',
    size: 1000,
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
    user: { id: 7, name: 'Ama' },
    dismissedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides
  }
}

const completed = (overrides: Partial<ReportUploadJob> = {}) =>
  job({
    status: 'completed',
    active: false,
    progress: 100,
    optimizationStatus: 'success',
    completedAt: new Date().toISOString(),
    ...overrides
  })

function optStatus(
  overrides: Partial<OptimizationStatusResponse> = {}
): OptimizationStatusResponse {
  return {
    active: true,
    jobId: 'opt-1',
    status: 'running',
    fileUrl: '/pdf/reports/x.pdf',
    reportId: 42,
    error: null,
    errorCode: null,
    result: null,
    lastEvent: { phase: 'classify', page: 1, totalPages: 4 },
    lastSeq: 1,
    startedAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

/** Route the stubbed GETs: upload feed and optimization status. */
let feed: ReportUploadJob[] = []
let optimization: () => Promise<OptimizationStatusResponse> = async () => optStatus()

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  localStorage.clear()
  currentUser.value = { id: 7 }
  modules.value = ['reports']
  feed = []
  optimization = async () => optStatus()
  apiGet.mockReset()
  apiPost.mockReset()
  apiGet.mockImplementation(async (endpoint: string) => {
    if (endpoint === 'reports/upload-jobs') {
      return { data: feed, activeCount: feed.filter((j) => j.active).length }
    }
    if (endpoint === 'reports/optimize-status') return optimization()
    throw new Error(`unexpected GET ${endpoint}`)
  })
  apiPost.mockResolvedValue({ success: true })
  for (const fn of Object.values(toast)) fn.mockReset()
  __resetAdminNotificationsForTests()
})

afterEach(() => {
  __resetAdminNotificationsForTests()
  vi.useRealTimers()
})

const uploadCalls = () => apiGet.mock.calls.filter(([e]) => e === 'reports/upload-jobs')

describe('useAdminNotifications — report uploads', () => {
  it("polls the signed-in admin's uploads as background requests", async () => {
    feed = [job()]
    const store = useAdminNotifications()
    store.start()
    await flush()

    const [, params, options] = uploadCalls()[0]
    expect(params).toMatchObject({ mine: 'true' })
    expect(options).toEqual({ headers: { 'X-Admin-Background': '1' } })
    expect(store.notifications.value.map((n) => n.id)).toEqual(['upload:job-1'])
    expect(store.activeCount.value).toBe(1)
    expect(store.unreadCount.value).toBe(0)
  })

  it('does not poll uploads for admins without the reports module', async () => {
    modules.value = ['content']
    useAdminNotifications().start()
    await flush()
    expect(uploadCalls()).toHaveLength(0)
  })

  it('announces an upload that finishes while watched, then counts it unread', async () => {
    feed = [job()]
    const store = useAdminNotifications()
    store.start()
    await flush()

    feed = [completed()]
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS)
    await flush()

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success.mock.calls[0][0]).toBe('Report upload complete: AG Report.pdf')
    expect(store.activeCount.value).toBe(0)
    expect(store.unreadCount.value).toBe(1)

    // Opening the panel marks it seen — for this tab and the admin's others.
    expect(store.openPanel()).toEqual(['upload:job-1'])
    expect(store.unreadCount.value).toBe(0)
    expect(JSON.parse(localStorage.getItem('gas:admin-notifications-seen:v1:7')!)).toEqual([
      'upload:job-1'
    ])
  })

  it('only badges (never toasts) uploads that were already finished', async () => {
    feed = [completed(), job({ id: 'job-2', status: 'failed', active: false })]
    const store = useAdminNotifications()
    store.start()
    await flush()

    expect(store.unreadCount.value).toBe(2)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('stays quiet while the panel is open', async () => {
    feed = [job()]
    const store = useAdminNotifications()
    store.start()
    await flush()
    store.openPanel()

    feed = [completed()]
    await vi.advanceTimersByTimeAsync(UPLOAD_JOB_ACTIVE_POLL_MS)
    await flush()

    expect(toast.success).not.toHaveBeenCalled()
    // Seen as it landed, since the admin is looking at it.
    expect(store.unreadCount.value).toBe(0)
  })

  it('shows a just-uploaded job immediately', async () => {
    const store = useAdminNotifications()
    store.start()
    await flush()
    store.trackUploadJob(job({ id: 'new' }))
    expect(store.notifications.value[0].id).toBe('upload:new')
  })

  it('dismisses finished uploads one at a time or all at once', async () => {
    feed = [completed(), completed({ id: 'job-2' }), job({ id: 'job-3' })]
    const store = useAdminNotifications()
    store.start()
    await flush()

    expect(await store.dismiss('upload:job-1')).toBe(true)
    expect(apiPost).toHaveBeenCalledWith('reports/upload-jobs/job-1/dismiss')

    // Running entries can't be dismissed.
    expect(await store.dismiss('upload:job-3')).toBe(false)

    expect(await store.clearFinished()).toBe(true)
    expect(apiPost).toHaveBeenCalledWith('reports/upload-jobs/dismiss-finished')
    expect(store.notifications.value.map((n) => n.id)).toEqual(['upload:job-3'])
  })

  it('tells the admin when a dismissal fails', async () => {
    feed = [completed()]
    const store = useAdminNotifications()
    store.start()
    await flush()
    apiPost.mockRejectedValueOnce({ statusCode: 409 })

    expect(await store.dismiss('upload:job-1')).toBe(false)
    expect(toast.error).toHaveBeenCalled()
    expect(store.notifications.value).toHaveLength(1)
  })
})

describe('useAdminNotifications — local entries', () => {
  it('runs a task through progress to an announced outcome', () => {
    const store = useAdminNotifications()
    store.start()
    const task = store.startTask({
      category: 'upload',
      title: 'Uploading 3 images',
      progress: 0
    })
    expect(store.activeCount.value).toBe(1)

    task.update({ progress: 66, progressDetail: '2 of 3' })
    expect(store.notifications.value[0]).toMatchObject({ progress: 66, progressDetail: '2 of 3' })

    task.succeed({ title: 'Images uploaded', notes: [{ text: 'Saved 3 images', tone: 'success' }] })
    const [done] = store.notifications.value
    expect(done).toMatchObject({ status: 'success', title: 'Images uploaded', progress: null })
    expect(done.finishedAt).not.toBeNull()
    expect(toast.success).toHaveBeenCalledWith('Images uploaded', expect.any(Number))

    // Outcomes are final: later updates are ignored.
    task.update({ progress: 10 })
    task.fail()
    expect(store.notifications.value[0].status).toBe('success')
  })

  it('posts one-off messages, optionally without a toast', () => {
    const store = useAdminNotifications()
    store.start()
    store.notify({ status: 'warning', title: 'Heads up', toast: false })
    expect(store.notifications.value[0]).toMatchObject({ status: 'warning', title: 'Heads up' })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(store.unreadCount.value).toBe(1)
  })

  it('restores entries after a reload, marking orphaned tasks interrupted', async () => {
    modules.value = []
    const store = useAdminNotifications()
    store.start()
    store.startTask({ title: 'Uploading report', subject: 'big.pdf', progress: 50 })
    store.notify({ status: 'success', title: 'Saved', toast: false })

    // Simulate a reload: module state is gone, sessionStorage survives.
    __resetAdminNotificationsForTests()
    const reloaded = useAdminNotifications()
    reloaded.start()

    const titles = reloaded.notifications.value.map((n) => [n.status, n.title])
    expect(titles).toContainEqual(['error', 'Uploading report (interrupted)'])
    expect(titles).toContainEqual(['success', 'Saved'])
    expect(reloaded.activeCount.value).toBe(0)
  })

  it("keeps each admin's entries apart on a shared tab", () => {
    const store = useAdminNotifications()
    store.start()
    store.notify({ title: 'For admin 7', toast: false })
    store.stop()

    currentUser.value = { id: 8 }
    store.start()
    expect(store.notifications.value).toHaveLength(0)

    store.stop()
    currentUser.value = { id: 7 }
    store.start()
    expect(store.notifications.value.map((n) => n.title)).toEqual(['For admin 7'])
  })

  it('removes a dismissed local entry', async () => {
    const store = useAdminNotifications()
    store.start()
    const id = store.notify({ title: 'Done', toast: false })
    expect(await store.dismiss(id)).toBe(true)
    expect(store.notifications.value).toHaveLength(0)
  })
})

describe('useAdminNotifications — PDF optimizations', () => {
  const optimizeCalls = () => apiGet.mock.calls.filter(([e]) => e === 'reports/optimize-status')

  it('follows an optimization to its result and announces it', async () => {
    modules.value = []
    const store = useAdminNotifications()
    store.start()
    store.trackOptimization({ jobId: 'opt-1', subject: 'Annual Report', reportId: 42 })
    await flush()

    const [, params, options] = optimizeCalls()[0]
    expect(params).toEqual({ jobId: 'opt-1' })
    expect(options).toEqual({ headers: { 'X-Admin-Background': '1' } })
    expect(store.notifications.value[0]).toMatchObject({
      id: 'optimize:opt-1',
      status: 'running',
      title: 'Optimizing PDF',
      subject: 'Annual Report',
      progressDetail: 'Page 1 of 4'
    })

    // Tracking the same job again (a page re-attaching) adds nothing.
    store.trackOptimization({ jobId: 'opt-1', subject: 'Annual Report', reportId: 42 })
    expect(store.notifications.value).toHaveLength(1)

    optimization = async () =>
      optStatus({
        status: 'success',
        active: false,
        result: {
          originalSize: 2048,
          optimizedSize: 1024,
          savedBytes: 1024,
          skippedCompression: false,
          nativePages: 4,
          scannedPages: 0
        }
      })
    await vi.advanceTimersByTimeAsync(2_000)
    await flush()

    expect(store.notifications.value[0]).toMatchObject({
      status: 'success',
      title: 'PDF optimized'
    })
    expect(toast.success).toHaveBeenCalledWith('PDF optimized: Annual Report', expect.any(Number))

    // Finished: polling stops.
    const calls = optimizeCalls().length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(optimizeCalls()).toHaveLength(calls)
  })

  it('gives up honestly when the server no longer knows the job', async () => {
    modules.value = []
    optimization = async () => {
      throw { statusCode: 404 }
    }
    const store = useAdminNotifications()
    store.start()
    store.trackOptimization({ jobId: 'gone', subject: 'Old report' })
    await flush()

    expect(store.notifications.value[0]).toMatchObject({
      status: 'warning',
      title: 'Optimization status unavailable'
    })
  })

  it('resumes following an optimization after a reload', async () => {
    modules.value = []
    const store = useAdminNotifications()
    store.start()
    store.trackOptimization({ jobId: 'opt-1', subject: 'Annual Report' })
    await flush()

    __resetAdminNotificationsForTests()
    apiGet.mockClear()
    const reloaded = useAdminNotifications()
    reloaded.start()
    await flush()

    expect(optimizeCalls()).toHaveLength(1)
    expect(reloaded.notifications.value[0]).toMatchObject({
      id: 'optimize:opt-1',
      status: 'running'
    })
  })
})
