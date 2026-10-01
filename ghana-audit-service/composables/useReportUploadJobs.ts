import { ref, computed, getCurrentScope, onScopeDispose, type Ref } from 'vue'
import type { ReportUploadJob } from '~/types/admin'
import { BACKGROUND_REQUEST_HEADERS } from '~/composables/useAdminApi'

/**
 * Polling clients for background A-G report uploads.
 *
 * The server keeps the job in MySQL, so these composables only ever *read*
 * — nothing here is lost on logout, tab close or session expiry; the next
 * poll (from any tab, any session) picks the job up where it is.
 */

export const UPLOAD_JOB_ACTIVE_POLL_MS = 2_500
export const UPLOAD_JOB_IDLE_POLL_MS = 20_000
const MAX_CONSECUTIVE_FAILURES = 5

export function isUploadJobActive(job: ReportUploadJob | null | undefined): boolean {
  return Boolean(job && job.active)
}

interface JobsListResponse {
  data: ReportUploadJob[]
  activeCount: number
}

export interface UseReportUploadJobsOptions {
  limit?: number
  sinceHours?: number
  /** Only in-flight jobs (no recent history). */
  activeOnly?: boolean
  /** Only jobs the signed-in admin started. */
  mine?: boolean
  /**
   * Send the polls as background requests, which the server does not count
   * as user activity (for pollers that run on every page).
   */
  background?: boolean
  /** Poll interval while nothing is running (default UPLOAD_JOB_IDLE_POLL_MS). */
  idlePollMs?: number
  /** Begin polling immediately (default true). */
  autoStart?: boolean
}

function pageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

/**
 * List of uploads: every in-flight one plus recent finished ones. Polls
 * fast while something is running, slowly otherwise (to notice jobs
 * started elsewhere), and pauses while the tab is hidden. The admin
 * notification center runs one of these (mine + background) on every page.
 */
export function useReportUploadJobs(options: UseReportUploadJobsOptions = {}) {
  const jobs = ref<ReportUploadJob[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const activeJobs = computed(() => jobs.value.filter((j) => j.active))
  const hasActive = computed(() => activeJobs.value.length > 0)
  const idlePollMs = options.idlePollMs ?? UPLOAD_JOB_IDLE_POLL_MS

  let timer: ReturnType<typeof setTimeout> | null = null
  let polling = false
  let failures = 0
  let visibilityHandler: (() => void) | null = null
  // Responses can land out of order, and a local change (upsert, dismiss)
  // must not be undone by a poll that left before it. Only a response to a
  // request issued after everything already applied may replace the list.
  let lastRequest = 0
  let appliedUpTo = 0

  async function fetchJobs(): Promise<void> {
    const api = useAdminApi()
    const request = ++lastRequest
    loading.value = !loaded.value
    try {
      const res = await api.get<JobsListResponse>(
        'reports/upload-jobs',
        {
          limit: options.limit,
          sinceHours: options.sinceHours,
          active: options.activeOnly ? 'true' : undefined,
          mine: options.mine ? 'true' : undefined
        },
        options.background ? { headers: { ...BACKGROUND_REQUEST_HEADERS } } : undefined
      )
      if (request > appliedUpTo) {
        appliedUpTo = request
        jobs.value = res.data
      }
      error.value = null
      failures = 0
      loaded.value = true
    } catch (err) {
      failures++
      const e = err as { statusCode?: number; data?: { message?: string }; message?: string }
      error.value = e.data?.message || e.message || 'Could not load uploads'
      // No permission (e.g. no access to the reports module) will not fix
      // itself by retrying.
      if (e.statusCode === 403) stopPolling()
    } finally {
      loading.value = false
    }
  }

  function schedule(): void {
    if (!polling) return
    if (timer) clearTimeout(timer)
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      // Back off hard rather than hammer a broken endpoint; a visibility
      // change or manual refresh resumes the normal cadence.
      failures = 0
      timer = setTimeout(tick, idlePollMs * 3)
      return
    }
    const delay = hasActive.value ? UPLOAD_JOB_ACTIVE_POLL_MS : idlePollMs
    timer = setTimeout(tick, delay)
  }

  async function tick(): Promise<void> {
    timer = null
    if (!polling) return
    if (!pageVisible()) {
      // Resume on visibilitychange instead of burning requests in a
      // background tab.
      return
    }
    await fetchJobs()
    schedule()
  }

  function startPolling(): void {
    if (polling) return
    polling = true
    if (typeof document !== 'undefined' && !visibilityHandler) {
      visibilityHandler = () => {
        if (pageVisible() && polling && !timer) void tick()
      }
      document.addEventListener('visibilitychange', visibilityHandler)
    }
    void tick()
  }

  function stopPolling(): void {
    polling = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }
  }

  /** Re-fetch now (e.g. right after starting an upload) without waiting. */
  async function refresh(): Promise<void> {
    await fetchJobs()
    schedule()
  }

  /**
   * Insert or replace a job already in hand (the upload response) so it
   * shows before the next poll; polls already in flight can't drop it.
   */
  function upsert(job: ReportUploadJob): void {
    appliedUpTo = lastRequest
    const index = jobs.value.findIndex((j) => j.id === job.id)
    jobs.value =
      index === -1
        ? [job, ...jobs.value]
        : jobs.value.map((existing, i) => (i === index ? job : existing))
    if (job.active && polling) schedule()
  }

  async function dismiss(id: string): Promise<boolean> {
    const api = useAdminApi()
    try {
      await api.post(`reports/upload-jobs/${id}/dismiss`)
      appliedUpTo = lastRequest
      jobs.value = jobs.value.filter((j) => j.id !== id)
      return true
    } catch {
      return false
    }
  }

  /** Forget the list (e.g. another admin signed in on this tab). */
  function reset(): void {
    appliedUpTo = lastRequest
    jobs.value = []
    loaded.value = false
    error.value = null
  }

  /** Dismiss every finished upload the signed-in admin started. */
  async function dismissFinished(): Promise<boolean> {
    const api = useAdminApi()
    try {
      await api.post('reports/upload-jobs/dismiss-finished')
      appliedUpTo = lastRequest
      jobs.value = jobs.value.filter((j) => j.active)
      return true
    } catch {
      return false
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(stopPolling)
  }

  if (options.autoStart !== false && import.meta.client) {
    startPolling()
  }

  return {
    jobs,
    activeJobs,
    hasActive,
    loading,
    loaded,
    error,
    fetchJobs,
    refresh,
    startPolling,
    stopPolling,
    upsert,
    reset,
    dismiss,
    dismissFinished
  }
}

/**
 * Follow a single upload job (the modal, the create/edit page). Seeds from
 * the upload response when available, then polls until the job is terminal.
 */
export function useReportUploadJob() {
  const job: Ref<ReportUploadJob | null> = ref(null)
  const error = ref<string | null>(null)
  const isActive = computed(() => isUploadJobActive(job.value))

  let timer: ReturnType<typeof setTimeout> | null = null
  let following: string | null = null
  let failures = 0

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function refresh(): Promise<ReportUploadJob | null> {
    const id = following
    if (!id) return null
    const api = useAdminApi()
    try {
      const fresh = await api.get<ReportUploadJob>(`reports/upload-jobs/${id}`)
      // A follow() to a different job may have happened while awaiting.
      if (following !== id) return job.value
      job.value = fresh
      error.value = null
      failures = 0
      return fresh
    } catch (err) {
      failures++
      const e = err as { statusCode?: number; data?: { message?: string }; message?: string }
      if (e.statusCode === 404 || failures >= MAX_CONSECUTIVE_FAILURES) {
        error.value = e.data?.message || 'Lost contact with the upload job'
        stop()
      }
      return job.value
    }
  }

  async function tick(): Promise<void> {
    timer = null
    if (!following) return
    if (!pageVisible()) {
      timer = setTimeout(tick, UPLOAD_JOB_ACTIVE_POLL_MS)
      return
    }
    const fresh = await refresh()
    if (following && fresh && fresh.active) {
      timer = setTimeout(tick, UPLOAD_JOB_ACTIVE_POLL_MS)
    }
  }

  /** Start following by id or from a job object already in hand. */
  function follow(target: string | ReportUploadJob): void {
    clearTimer()
    failures = 0
    error.value = null
    if (typeof target === 'string') {
      following = target
      if (job.value?.id !== target) job.value = null
      void tick()
      return
    }
    following = target.id
    job.value = target
    if (target.active) timer = setTimeout(tick, UPLOAD_JOB_ACTIVE_POLL_MS)
  }

  function stop(): void {
    clearTimer()
    following = null
  }

  function reset(): void {
    stop()
    job.value = null
    error.value = null
  }

  if (getCurrentScope()) {
    onScopeDispose(stop)
  }

  return { job, error, isActive, follow, refresh, stop, reset }
}
