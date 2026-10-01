import type { ReportUploadJob } from '~/types/admin'
import type { OptimizationPhase } from '~/composables/useReportOptimization'
import {
  optimizationErrorMessage,
  optimizationPageLabel,
  optimizationPhaseLabel
} from '~/utils/reportOptimizationUi'
import { formatBytes } from '~/utils/formatBytes'

// Admin-facing copy for background report uploads. Like the optimization
// copy, the server only sends fixed codes; wording lives here. The admin
// surface is intentionally English-only.

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  STALLED:
    'The upload stopped responding and was abandoned (the server may have restarted). Please upload the file again.',
  STORE_FAILED: 'The file could not be saved to storage. Please try again.',
  PIPELINE_FAILED: 'The upload could not be processed. Please try again.'
}

/** Short status line for the current stage. */
export function uploadJobStageLabel(job: ReportUploadJob): string {
  switch (job.status) {
    case 'queued':
      return 'Queued…'
    case 'storing':
      return 'Saving to storage…'
    case 'thumbnail':
      return 'Generating thumbnail…'
    case 'optimizing':
      if (!job.phase || job.phase === 'waiting') return 'Waiting for a free optimizer slot…'
      return optimizationPhaseLabel(job.phase as OptimizationPhase)
    case 'completed':
      return job.optimizationStatus === 'error'
        ? 'Uploaded — optimization skipped'
        : 'Upload complete'
    case 'failed':
      return 'Upload failed'
    default:
      return 'Processing…'
  }
}

/** Page x of N while inside the per-page optimizer phases, else null. */
export function uploadJobPageLabel(job: ReportUploadJob): string | null {
  if (job.status !== 'optimizing') return null
  return optimizationPageLabel(job.phase as OptimizationPhase | null, job.page, job.totalPages)
}

/**
 * Friendly explanation for a failed upload or a completed upload whose
 * optimization failed; null when there is nothing to explain.
 */
export function uploadJobErrorMessage(job: ReportUploadJob): string | null {
  if (job.status === 'failed') {
    return (
      (job.errorCode ? UPLOAD_ERROR_MESSAGES[job.errorCode] : undefined) ??
      job.error ??
      'Upload failed.'
    )
  }
  if (job.status === 'completed' && job.optimizationStatus === 'error') {
    return optimizationErrorMessage(job.errorCode)
  }
  return null
}

/** One-line outcome for a completed upload with a successful optimization. */
export function uploadJobResultSummary(job: ReportUploadJob): string | null {
  if (job.status !== 'completed' || job.optimizationStatus !== 'success') return null
  const r = job.optimizationResult
  if (!r) return null
  if (r.skippedCompression) return 'File was already well-compressed; original kept.'
  return `Reduced ${formatBytes(r.originalSize)} → ${formatBytes(r.optimizedSize)} (saved ${formatBytes(r.savedBytes)})`
}

/** "5 minutes ago" style stamp for notification lists. */
export function formatRelativeTime(dateStr: string, now: number = Date.now()): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = now - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}
