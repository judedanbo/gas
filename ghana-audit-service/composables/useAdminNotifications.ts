import { computed, ref, watch } from 'vue'
import type {
  AdminNotification,
  AdminNotificationAction,
  AdminNotificationCategory,
  AdminNotificationNote,
  AdminNotificationStatus,
  ReportUploadJob
} from '~/types/admin'
import { BACKGROUND_REQUEST_HEADERS } from '~/composables/useAdminApi'
import type { OptimizationStatusResponse } from '~/composables/useReportOptimization'
import { useReportUploadJobs } from '~/composables/useReportUploadJobs'
import {
  isFinished,
  notificationToastMessage,
  optimizationNotificationId,
  optimizationStatusToPatch,
  reportEditAction,
  sortNotifications,
  uploadJobIdFromNotificationId,
  uploadJobToNotification
} from '~/utils/adminNotifications'

/**
 * Store behind the admin notification center (the bell in the admin header).
 *
 * One feed merges two kinds of entries:
 *  - **Report uploads** — the signed-in admin's background A-G uploads, read
 *    from the persistent `report_upload_jobs` table. They survive reloads,
 *    sign-outs and other tabs because the server owns them.
 *  - **Local entries** — anything the browser starts and wants to report on:
 *    one-off messages (`notify`), tasks with progress (`startTask`), and
 *    explicit PDF optimizations (`trackOptimization`, followed by polling the
 *    server). They are kept in sessionStorage, so a reload keeps them; a task
 *    whose work died with the page comes back marked as interrupted.
 *
 * Read state is a set of "seen" ids in localStorage (shared by the admin's
 * tabs). Opening the panel marks every finished entry seen. A toast
 * announces each entry that finishes while the admin is elsewhere.
 *
 * Singleton module state, like useToast: the header starts it once per
 * admin session and every page reports into the same feed.
 */

const FEED_SINCE_HOURS = 7 * 24
const FEED_LIMIT = 25
/** Report uploads are polled every 2.5s while one runs, else this often. */
const FEED_IDLE_POLL_MS = 30_000
const OPTIMIZATION_POLL_MS = 2_000
const OPTIMIZATION_MAX_FAILURES = 5
const MAX_LOCAL_FINISHED = 30
const LOCAL_TTL_MS = 7 * 24 * 60 * 60_000
const MAX_SEEN_IDS = 200
const PERSIST_DELAY_MS = 500
const TOAST_DURATION_MS = 6_000

const localKey = (userId: number) => `gas:admin-notifications:v1:${userId}`
const seenKey = (userId: number) => `gas:admin-notifications-seen:v1:${userId}`

/** Server-side work behind a local entry, so it can be resumed after a reload. */
interface TrackedWork {
  kind: 'optimization'
  jobId: string
  reportId: number | null
}

interface LocalNotification extends AdminNotification {
  source: 'local'
  track?: TrackedWork
}

export interface NotifyInput {
  status?: Exclude<AdminNotificationStatus, 'running'>
  category?: AdminNotificationCategory
  title: string
  subject?: string | null
  meta?: string | null
  notes?: AdminNotificationNote[]
  actions?: AdminNotificationAction[]
  /** Also flash a toast (default true). */
  toast?: boolean
}

export interface TaskInput {
  category?: AdminNotificationCategory
  title: string
  subject?: string | null
  meta?: string | null
  /** 0–100; omit or null for an indeterminate bar. */
  progress?: number | null
  progressLabel?: string | null
  actions?: AdminNotificationAction[]
}

export type TaskUpdate = Partial<
  Pick<
    AdminNotification,
    'title' | 'subject' | 'meta' | 'progress' | 'progressLabel' | 'progressDetail' | 'actions'
  >
>

export interface TaskOutcome {
  /** Headline for the outcome; defaults to the task's title. */
  title?: string
  subject?: string | null
  meta?: string | null
  notes?: AdminNotificationNote[]
  actions?: AdminNotificationAction[]
  /** Flash a toast (default true). */
  toast?: boolean
}

/** Handle for a task started with `startTask`. */
export interface NotificationTask {
  readonly id: string
  update(patch: TaskUpdate): void
  succeed(outcome?: TaskOutcome): void
  /** Finished, but with something the admin should look at. */
  warn(outcome?: TaskOutcome): void
  fail(outcome?: TaskOutcome): void
  /** Drop the entry without an outcome (e.g. handed over to a server job). */
  remove(): void
}

export interface TrackOptimizationInput {
  jobId: string
  /** What is being optimized — the report title or file name. */
  subject: string
  reportId?: number | null
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function pageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function readStorage(storage: Storage | undefined, key: string): unknown {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: unknown): void {
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: the feed keeps working in memory.
  }
}

const session = (): Storage | undefined =>
  typeof sessionStorage === 'undefined' ? undefined : sessionStorage
const local = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage

function isLocalNotification(value: unknown): value is LocalNotification {
  if (!value || typeof value !== 'object') return false
  const n = value as Partial<LocalNotification>
  return (
    typeof n.id === 'string' &&
    n.source === 'local' &&
    typeof n.title === 'string' &&
    typeof n.status === 'string' &&
    typeof n.createdAt === 'string' &&
    Array.isArray(n.notes) &&
    Array.isArray(n.actions)
  )
}

/** A running entry whose work lived in a page that is gone. */
function interrupted(n: LocalNotification): LocalNotification {
  const now = nowIso()
  return {
    ...n,
    status: 'error',
    title: `${n.title} (interrupted)`,
    progress: null,
    progressLabel: null,
    progressDetail: null,
    notes: [{ text: 'The page was reloaded or closed before this finished.', tone: 'error' }],
    updatedAt: now,
    finishedAt: now
  }
}

function createStore() {
  const uploads = useReportUploadJobs({
    autoStart: false,
    mine: true,
    background: true,
    limit: FEED_LIMIT,
    sinceHours: FEED_SINCE_HOURS,
    idlePollMs: FEED_IDLE_POLL_MS
  })
  const localItems = ref<LocalNotification[]>([])
  const seenIds = ref<string[]>([])
  const panelOpen = ref(false)

  let ownerId: number | null = null
  let started = false
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  let storageHandler: ((e: StorageEvent) => void) | null = null
  const optimizationTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const optimizationInFlight = new Set<string>()
  const optimizationFailures = new Map<string, number>()
  const lastUploadStatus = new Map<string, AdminNotificationStatus>()

  const uploadNotifications = computed(() => uploads.jobs.value.map(uploadJobToNotification))
  const notifications = computed<AdminNotification[]>(() =>
    sortNotifications([...uploadNotifications.value, ...localItems.value])
  )
  const seen = computed(() => new Set(seenIds.value))
  const activeCount = computed(() => notifications.value.filter((n) => !isFinished(n)).length)
  const unreadIds = computed(() =>
    notifications.value.filter((n) => isFinished(n) && !seen.value.has(n.id)).map((n) => n.id)
  )
  const unreadCount = computed(() => unreadIds.value.length)

  // ── Announcements ────────────────────────────────────────────────────────

  function announce(n: AdminNotification): void {
    // The admin is looking at the feed already.
    if (panelOpen.value) return
    const toast = useToast()
    const message = notificationToastMessage(n)
    if (n.status === 'success') toast.success(message, TOAST_DURATION_MS)
    else if (n.status === 'warning') toast.warning(message, TOAST_DURATION_MS)
    else if (n.status === 'error') toast.error(message, TOAST_DURATION_MS)
    else toast.info(message, TOAST_DURATION_MS)
  }

  // Announce uploads that finish while we watch. Entries first seen already
  // finished (e.g. after signing back in) only raise the unread badge.
  watch(uploadNotifications, (items) => {
    const present = new Set<string>()
    for (const n of items) {
      present.add(n.id)
      if (lastUploadStatus.get(n.id) === 'running' && isFinished(n)) announce(n)
      lastUploadStatus.set(n.id, n.status)
    }
    for (const id of [...lastUploadStatus.keys()]) {
      if (!present.has(id)) lastUploadStatus.delete(id)
    }
  })

  // Entries that finish while the panel is open are seen as they land.
  watch(unreadIds, (ids) => {
    if (panelOpen.value && ids.length > 0) markAllSeen()
  })

  // ── Persistence ──────────────────────────────────────────────────────────

  function persistLocal(): void {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    if (ownerId !== null) writeStorage(session(), localKey(ownerId), localItems.value)
  }

  /** Coalesce progress-only writes (uploads report progress many times a second). */
  function schedulePersist(): void {
    if (persistTimer) return
    persistTimer = setTimeout(persistLocal, PERSIST_DELAY_MS)
  }

  function loadLocal(userId: number): LocalNotification[] {
    const stored = readStorage(session(), localKey(userId))
    if (!Array.isArray(stored)) return []
    const cutoff = Date.now() - LOCAL_TTL_MS
    return stored
      .filter(isLocalNotification)
      .filter((n) => (Date.parse(n.finishedAt ?? n.createdAt) || 0) >= cutoff)
      .map((n) => (n.status === 'running' && !n.track ? interrupted(n) : n))
  }

  function loadSeen(userId: number): string[] {
    const stored = readStorage(local(), seenKey(userId))
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
  }

  function markAllSeen(): void {
    if (unreadIds.value.length === 0) return
    const next = [
      ...seenIds.value.filter((id) => !unreadIds.value.includes(id)),
      ...unreadIds.value
    ]
    seenIds.value = next.slice(-MAX_SEEN_IDS)
    if (ownerId !== null) writeStorage(local(), seenKey(ownerId), seenIds.value)
  }

  // ── Local entries ────────────────────────────────────────────────────────

  function findLocal(id: string): LocalNotification | undefined {
    return localItems.value.find((n) => n.id === id)
  }

  /** Newest first; running entries are never pruned. */
  function addLocal(item: LocalNotification): void {
    const others = localItems.value.filter((n) => n.id !== item.id)
    const running = others.filter((n) => n.status === 'running')
    const finished = others.filter((n) => n.status !== 'running')
    const keep = MAX_LOCAL_FINISHED - (item.status === 'running' ? 0 : 1)
    localItems.value = [item, ...running, ...finished.slice(0, Math.max(0, keep))]
    persistLocal()
  }

  function patchLocal(id: string, patch: Partial<LocalNotification>): LocalNotification | null {
    let updated: LocalNotification | null = null
    localItems.value = localItems.value.map((n) => {
      if (n.id !== id) return n
      updated = { ...n, ...patch, updatedAt: nowIso() }
      return updated
    })
    return updated
  }

  function updateRunning(id: string, patch: TaskUpdate): void {
    const current = findLocal(id)
    if (!current || current.status !== 'running') return
    patchLocal(id, patch)
    schedulePersist()
  }

  function finishLocal(
    id: string,
    status: Exclude<AdminNotificationStatus, 'running'>,
    outcome: TaskOutcome = {}
  ): void {
    const current = findLocal(id)
    if (!current || current.status !== 'running') return
    const done = patchLocal(id, {
      status,
      title: outcome.title ?? current.title,
      subject: outcome.subject === undefined ? current.subject : outcome.subject,
      meta: outcome.meta === undefined ? current.meta : outcome.meta,
      notes: outcome.notes ?? [],
      actions: outcome.actions ?? current.actions,
      progress: null,
      progressLabel: null,
      progressDetail: null,
      finishedAt: nowIso()
    })
    stopOptimizationPolling(id)
    persistLocal()
    if (done && outcome.toast !== false) announce(done)
  }

  function removeLocal(id: string): void {
    stopOptimizationPolling(id)
    localItems.value = localItems.value.filter((n) => n.id !== id)
    persistLocal()
  }

  function notify(input: NotifyInput): string {
    const now = nowIso()
    const item: LocalNotification = {
      id: `local:${newId()}`,
      source: 'local',
      category: input.category ?? 'general',
      status: input.status ?? 'info',
      title: input.title,
      subject: input.subject ?? null,
      meta: input.meta ?? null,
      progress: null,
      progressLabel: null,
      progressDetail: null,
      thumbnailUrl: null,
      notes: input.notes ?? [],
      actions: input.actions ?? [],
      createdAt: now,
      updatedAt: now,
      finishedAt: now
    }
    addLocal(item)
    if (input.toast !== false) announce(item)
    return item.id
  }

  function startTask(input: TaskInput): NotificationTask {
    const now = nowIso()
    const id = `local:${newId()}`
    addLocal({
      id,
      source: 'local',
      category: input.category ?? 'general',
      status: 'running',
      title: input.title,
      subject: input.subject ?? null,
      meta: input.meta ?? null,
      progress: input.progress ?? null,
      progressLabel: input.progressLabel ?? null,
      progressDetail: null,
      thumbnailUrl: null,
      notes: [],
      actions: input.actions ?? [],
      createdAt: now,
      updatedAt: now,
      finishedAt: null
    })
    return {
      id,
      update: (patch) => updateRunning(id, patch),
      succeed: (outcome) => finishLocal(id, 'success', outcome),
      warn: (outcome) => finishLocal(id, 'warning', outcome),
      fail: (outcome) => finishLocal(id, 'error', outcome),
      remove: () => removeLocal(id)
    }
  }

  // ── Report uploads ───────────────────────────────────────────────────────

  /** Show a just-started background upload before the next poll lands. */
  function trackUploadJob(job: ReportUploadJob): void {
    uploads.upsert(job)
    if (started) uploads.startPolling()
  }

  // ── Explicit PDF optimizations ───────────────────────────────────────────

  function stopOptimizationPolling(id: string): void {
    const timer = optimizationTimers.get(id)
    if (timer) clearTimeout(timer)
    optimizationTimers.delete(id)
  }

  function scheduleOptimizationPoll(id: string, delay: number): void {
    stopOptimizationPolling(id)
    if (!started) return
    optimizationTimers.set(
      id,
      setTimeout(() => void pollOptimization(id), delay)
    )
  }

  async function pollOptimization(id: string): Promise<void> {
    stopOptimizationPolling(id)
    const item = findLocal(id)
    if (!started || !item?.track || item.status !== 'running') return
    if (optimizationInFlight.has(id)) return
    if (!pageVisible()) {
      scheduleOptimizationPoll(id, OPTIMIZATION_POLL_MS)
      return
    }
    const { jobId, reportId } = item.track
    optimizationInFlight.add(id)
    try {
      const status = await useAdminApi().get<OptimizationStatusResponse>(
        'reports/optimize-status',
        { jobId },
        { headers: { ...BACKGROUND_REQUEST_HEADERS } }
      )
      optimizationFailures.delete(id)
      const patch = optimizationStatusToPatch(status, reportId)
      if (patch.status === 'running') {
        updateRunning(id, patch)
        scheduleOptimizationPoll(id, OPTIMIZATION_POLL_MS)
      } else {
        finishLocal(id, patch.status, {
          title: patch.title,
          notes: patch.notes,
          actions: patch.actions
        })
      }
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      const failures = (optimizationFailures.get(id) ?? 0) + 1
      optimizationFailures.set(id, failures)
      // 404: the server no longer knows the job (restarted, or finished
      // long ago). Either way this entry can't learn the outcome.
      if (statusCode === 404 || statusCode === 403 || failures >= OPTIMIZATION_MAX_FAILURES) {
        optimizationFailures.delete(id)
        finishLocal(id, 'warning', {
          title: 'Optimization status unavailable',
          notes: [
            {
              text: 'Lost contact with the optimization job. Open the report to check whether the file was optimized.',
              tone: 'warning'
            }
          ]
        })
        return
      }
      scheduleOptimizationPoll(id, OPTIMIZATION_POLL_MS * 2)
    } finally {
      optimizationInFlight.delete(id)
    }
  }

  /**
   * Follow an explicit optimization (edit page, upload modal retry) in the
   * feed. Safe to call again for the same job — e.g. when a page re-attaches.
   */
  function trackOptimization(input: TrackOptimizationInput): string {
    const id = optimizationNotificationId(input.jobId)
    const existing = findLocal(id)
    if (!existing) {
      const now = nowIso()
      const reportId = input.reportId ?? null
      addLocal({
        id,
        source: 'local',
        category: 'optimization',
        status: 'running',
        title: 'Optimizing PDF',
        subject: input.subject,
        meta: null,
        progress: 0,
        progressLabel: 'Starting…',
        progressDetail: null,
        thumbnailUrl: null,
        notes: [],
        actions: reportId ? [reportEditAction(reportId)] : [],
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
        track: { kind: 'optimization', jobId: input.jobId, reportId }
      })
    }
    // Already being followed (or finished): nothing more to start.
    if (existing && (existing.status !== 'running' || optimizationTimers.has(id))) return id
    void pollOptimization(id)
    return id
  }

  // ── Dismissal ────────────────────────────────────────────────────────────

  async function dismiss(id: string): Promise<boolean> {
    const n = notifications.value.find((item) => item.id === id)
    if (!n || !isFinished(n)) return false
    if (n.source === 'report-upload') {
      const ok = await uploads.dismiss(uploadJobIdFromNotificationId(id))
      if (!ok) useToast().error('Could not dismiss the notification. Please try again.')
      return ok
    }
    removeLocal(id)
    return true
  }

  /** Remove every finished entry; running ones stay. */
  async function clearFinished(): Promise<boolean> {
    localItems.value = localItems.value.filter((n) => !isFinished(n))
    persistLocal()
    if (!uploadNotifications.value.some(isFinished)) return true
    const ok = await uploads.dismissFinished()
    if (!ok) useToast().error('Could not clear the notifications. Please try again.')
    return ok
  }

  // ── Panel ────────────────────────────────────────────────────────────────

  /** Open the panel; returns the ids that were unread, to highlight them. */
  function openPanel(): string[] {
    const fresh = [...unreadIds.value]
    panelOpen.value = true
    markAllSeen()
    return fresh
  }

  function closePanel(): void {
    panelOpen.value = false
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  function switchOwner(userId: number): void {
    for (const id of [...optimizationTimers.keys()]) stopOptimizationPolling(id)
    optimizationFailures.clear()
    lastUploadStatus.clear()
    uploads.reset()
    ownerId = userId
    localItems.value = loadLocal(userId)
    seenIds.value = loadSeen(userId)
    persistLocal()
  }

  /** Begin feeding the bell for the signed-in admin (idempotent). */
  function start(): void {
    // Client-only (admin pages are never server-rendered).
    if (typeof window === 'undefined') return
    const { user, hasModule } = useAdminAuth()
    const userId = user.value?.id
    if (!userId) return
    if (ownerId !== userId) {
      stop()
      switchOwner(userId)
    }
    if (started) return
    started = true

    // Uploads live under the reports module; others would only get 403s.
    if (hasModule('reports')) uploads.startPolling()
    for (const n of localItems.value) {
      if (n.status === 'running' && n.track) void pollOptimization(n.id)
    }

    if (typeof window !== 'undefined') {
      storageHandler = (e: StorageEvent) => {
        if (ownerId !== null && e.key === seenKey(ownerId)) seenIds.value = loadSeen(ownerId)
      }
      window.addEventListener('storage', storageHandler)
    }
  }

  /** Stop all polling (the admin layout unmounted, e.g. on sign-out). */
  function stop(): void {
    started = false
    uploads.stopPolling()
    for (const id of [...optimizationTimers.keys()]) stopOptimizationPolling(id)
    if (persistTimer) persistLocal()
    if (storageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler)
    }
    storageHandler = null
    panelOpen.value = false
  }

  return {
    notifications,
    activeCount,
    unreadCount,
    unreadIds,
    panelOpen,
    start,
    stop,
    refresh: uploads.refresh,
    openPanel,
    closePanel,
    markAllSeen,
    dismiss,
    clearFinished,
    notify,
    startTask,
    trackUploadJob,
    trackOptimization
  }
}

type AdminNotificationsStore = ReturnType<typeof createStore>

let store: AdminNotificationsStore | null = null

export function useAdminNotifications(): AdminNotificationsStore {
  if (!store) store = createStore()
  return store
}

/** Test helper: drop the singleton (and its timers) between test cases. */
export function __resetAdminNotificationsForTests(): void {
  store?.stop()
  store = null
}
