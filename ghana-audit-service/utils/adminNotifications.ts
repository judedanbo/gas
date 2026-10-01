import type {
  AdminNotification,
  AdminNotificationAction,
  AdminNotificationNote,
  AdminNotificationStatus,
  ReportUploadJob
} from '~/types/admin'
import type { OptimizationStatusResponse } from '~/composables/useReportOptimization'
import { formatBytes } from '~/utils/formatBytes'
import {
  optimizationErrorMessage,
  optimizationPageLabel,
  optimizationPhaseLabel,
  optimizationProgressPercent
} from '~/utils/reportOptimizationUi'
import {
  uploadJobErrorMessage,
  uploadJobPageLabel,
  uploadJobResultSummary,
  uploadJobStageLabel
} from '~/utils/reportUploadJobUi'

// Admin-facing copy and shaping for the notification center. Like the rest of
// the admin surface this is intentionally English-only; the server only ever
// sends codes and raw job state.

const UPLOAD_ID_PREFIX = 'upload:'

export function uploadJobNotificationId(jobId: string): string {
  return `${UPLOAD_ID_PREFIX}${jobId}`
}

export function isUploadNotificationId(id: string): boolean {
  return id.startsWith(UPLOAD_ID_PREFIX) && id.length > UPLOAD_ID_PREFIX.length
}

export function uploadJobIdFromNotificationId(id: string): string {
  return id.startsWith(UPLOAD_ID_PREFIX) ? id.slice(UPLOAD_ID_PREFIX.length) : id
}

export function optimizationNotificationId(jobId: string): string {
  return `optimize:${jobId}`
}

export function isFinished(notification: Pick<AdminNotification, 'status'>): boolean {
  return notification.status !== 'running'
}

export function reportEditAction(reportId: number): AdminNotificationAction {
  return { label: 'Open report', to: `/admin/reports/${reportId}/edit` }
}

function ocrFailedNote(pages: number | undefined): AdminNotificationNote[] {
  return pages && pages > 0
    ? [
        {
          text: `${pages} page(s) could not be OCR-processed and were kept as scans.`,
          tone: 'warning'
        }
      ]
    : []
}

const UPLOAD_TITLES: Record<AdminNotificationStatus, string> = {
  running: 'Uploading report',
  success: 'Report upload complete',
  warning: 'Report uploaded — optimization skipped',
  error: 'Report upload failed',
  info: 'Report upload'
}

/** A background A-G report upload (server job row) as a notification. */
export function uploadJobToNotification(job: ReportUploadJob): AdminNotification {
  const status: AdminNotificationStatus = job.active
    ? 'running'
    : job.status === 'failed'
      ? 'error'
      : job.optimizationStatus === 'error'
        ? 'warning'
        : 'success'

  const notes: AdminNotificationNote[] = []
  const summary = uploadJobResultSummary(job)
  if (summary) {
    const kept = job.optimizationResult?.skippedCompression
    notes.push({ text: summary, tone: kept ? 'muted' : 'success' })
  }
  if (job.status === 'completed') {
    notes.push(...ocrFailedNote(job.optimizationResult?.ocrFailedPages))
  }
  const problem = uploadJobErrorMessage(job)
  if (problem) notes.push({ text: problem, tone: status === 'error' ? 'error' : 'warning' })

  const actions: AdminNotificationAction[] = []
  if (job.reportId) {
    actions.push(reportEditAction(job.reportId))
  } else if (job.status === 'completed') {
    actions.push({
      label: 'Create report from this file',
      to: { path: '/admin/reports/create', query: { uploadJobId: job.id } }
    })
  }

  const size = formatBytes(job.finalSize ?? job.size)
  const running = status === 'running'
  return {
    id: uploadJobNotificationId(job.id),
    source: 'report-upload',
    category: 'upload',
    status,
    title: UPLOAD_TITLES[status],
    subject: job.reportTitle || job.originalName,
    meta: job.reportTitle ? `${job.originalName} · ${size}` : size,
    progress: running ? job.progress : null,
    progressLabel: running ? uploadJobStageLabel(job) : null,
    progressDetail: running ? uploadJobPageLabel(job) : null,
    thumbnailUrl: job.thumbnailUrl,
    notes,
    actions,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: running ? null : (job.completedAt ?? job.updatedAt)
  }
}

/**
 * The parts of an explicit PDF optimization's notification that follow from
 * the server's status response (`reports/optimize-status`).
 */
export function optimizationStatusToPatch(
  s: OptimizationStatusResponse,
  reportId: number | null
): Pick<
  AdminNotification,
  'status' | 'title' | 'progress' | 'progressLabel' | 'progressDetail' | 'notes' | 'actions'
> {
  const actions = reportId ? [reportEditAction(reportId)] : []

  if (s.status === 'success') {
    const r = s.result
    const notes: AdminNotificationNote[] = []
    if (r?.skippedCompression) {
      notes.push({ text: 'File was already well-compressed; original kept.', tone: 'muted' })
    } else if (r) {
      notes.push({
        text: `Reduced ${formatBytes(r.originalSize)} → ${formatBytes(r.optimizedSize)} (saved ${formatBytes(r.savedBytes)})`,
        tone: 'success'
      })
    }
    notes.push(...ocrFailedNote(r?.ocrFailedPages))
    return {
      status: 'success',
      title: 'PDF optimized',
      progress: null,
      progressLabel: null,
      progressDetail: null,
      notes,
      actions
    }
  }

  if (s.status === 'error') {
    return {
      status: 'error',
      title: 'Optimization failed',
      progress: null,
      progressLabel: null,
      progressDetail: null,
      notes: [{ text: optimizationErrorMessage(s.errorCode), tone: 'error' }],
      actions
    }
  }

  // Queued (or running but no progress event yet): waiting for a slot.
  const event = s.status === 'queued' ? null : s.lastEvent
  if (!event) {
    return {
      status: 'running',
      title: 'Optimizing PDF',
      progress: 0,
      progressLabel: 'Waiting for a free optimizer slot…',
      progressDetail: null,
      notes: [],
      actions
    }
  }
  return {
    status: 'running',
    title: 'Optimizing PDF',
    progress: optimizationProgressPercent(event.phase, event.page, event.totalPages),
    progressLabel: optimizationPhaseLabel(event.phase),
    progressDetail: optimizationPageLabel(event.phase, event.page, event.totalPages),
    notes: [],
    actions
  }
}

/**
 * Display order: running first (newest started on top), then outcomes,
 * most recent first.
 */
export function sortNotifications(items: AdminNotification[]): AdminNotification[] {
  const time = (n: AdminNotification) => Date.parse(n.finishedAt ?? n.createdAt) || 0
  return [...items].sort((a, b) => {
    const aRunning = a.status === 'running'
    const bRunning = b.status === 'running'
    if (aRunning !== bRunning) return aRunning ? -1 : 1
    if (aRunning) return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    return time(b) - time(a)
  })
}

/** One-line toast for a notification that just reached its outcome. */
export function notificationToastMessage(n: AdminNotification): string {
  return n.subject ? `${n.title}: ${n.subject}` : n.title
}

/** Accessible name for the bell button. */
export function notificationBellLabel(activeCount: number, unreadCount: number): string {
  const parts: string[] = []
  if (activeCount > 0) parts.push(`${activeCount} in progress`)
  if (unreadCount > 0) parts.push(`${unreadCount} unread`)
  return parts.length > 0 ? `Notifications (${parts.join(', ')})` : 'Notifications'
}

// ── Notification pages ──────────────────────────────────────────────────────

/** The notification's own page (ids contain ':', so they are encoded). */
export function notificationPath(id: string): string {
  return `/admin/notifications/${encodeURIComponent(id)}`
}

export type NotificationFilter = 'all' | 'running' | 'unread' | 'problems'

export const NOTIFICATION_FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'In progress' },
  { value: 'unread', label: 'Unread' },
  { value: 'problems', label: 'Needs attention' }
]

export function filterNotifications(
  items: AdminNotification[],
  filter: NotificationFilter,
  unreadIds: readonly string[] = []
): AdminNotification[] {
  switch (filter) {
    case 'running':
      return items.filter((n) => n.status === 'running')
    case 'unread':
      return items.filter((n) => unreadIds.includes(n.id))
    case 'problems':
      return items.filter((n) => n.status === 'warning' || n.status === 'error')
    default:
      return items
  }
}

export interface NotificationDetail {
  label: string
  value: string
}

const PRESET_LABELS: Record<ReportUploadJob['preset'], string> = {
  ebook: 'Balanced (150 DPI)',
  screen: 'Aggressive (72 DPI)',
  printer: 'Conservative (300 DPI)'
}

const STATUS_LABELS: Record<AdminNotificationStatus, string> = {
  running: 'In progress',
  success: 'Completed',
  warning: 'Completed with warnings',
  error: 'Failed',
  info: 'Information'
}

export function notificationStatusLabel(status: AdminNotificationStatus): string {
  return STATUS_LABELS[status]
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
}

/**
 * Fact rows for a notification's page. A report upload adds its file,
 * compression and optimization facts from the job behind it.
 */
export function notificationDetails(
  n: AdminNotification,
  job?: ReportUploadJob | null
): NotificationDetail[] {
  const rows: NotificationDetail[] = [{ label: 'Status', value: notificationStatusLabel(n.status) }]
  const push = (label: string, value: string | null | undefined) => {
    if (value) rows.push({ label, value })
  }

  if (job) {
    push('File', job.originalName)
    push('Report', job.reportTitle)
    push('Uploaded size', formatBytes(job.size))
    if (job.finalSize && job.finalSize !== job.size) push('Stored size', formatBytes(job.finalSize))
    push('Compression', PRESET_LABELS[job.preset])
    const r = job.optimizationResult
    if (r) {
      push('Pages', `${r.pageCount} (${r.nativePages} native, ${r.scannedPages} scanned)`)
      if (r.ocrFailedPages > 0) push('OCR failures', `${r.ocrFailedPages} page(s)`)
      push(
        'Space saved',
        r.skippedCompression ? 'None — already well-compressed' : formatBytes(r.savedBytes)
      )
    }
    push('Error code', job.errorCode)
    push('Started', formatDateTime(job.createdAt))
    push('Finished', formatDateTime(job.completedAt))
    return rows
  }

  push('About', n.subject)
  push('Details', n.meta)
  push('Started', formatDateTime(n.createdAt))
  push('Finished', formatDateTime(n.finishedAt))
  return rows
}
