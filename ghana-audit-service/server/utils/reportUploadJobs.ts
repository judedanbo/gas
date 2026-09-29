import { randomUUID } from 'node:crypto'
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import type { ReportUploadJob, ReportUploadJobStatus } from '../database/schema/report-upload-jobs'
import type { ReportOptimizationMeta } from '../database/schema/audit-reports'
import type { CompressionPreset } from './pdfOptimizer'
import { logError } from './logger'

/**
 * Persistent store for background A-G report uploads (see the schema file for
 * the rationale). This module owns the row lifecycle and the DTO shape the
 * admin API returns; the pipeline (reportUploadPipeline.ts) drives it.
 */

export type { ReportUploadJob, ReportUploadJobStatus }

export const ACTIVE_UPLOAD_STATUSES: readonly ReportUploadJobStatus[] = [
  'queued',
  'storing',
  'thumbnail',
  'optimizing'
]

export function isActiveUploadStatus(status: ReportUploadJobStatus): boolean {
  return ACTIVE_UPLOAD_STATUSES.includes(status)
}

/**
 * The pipeline touches updatedAt this often while alive; a row silent for
 * longer than STALL_TIMEOUT_MS belongs to a producer that died (pod restart,
 * OOM) and is flipped to failed by the watchdog so the dashboard never shows
 * a spinner forever. The optimizer's own queue wait can be long, but the
 * heartbeat keeps ticking through it.
 */
export const HEARTBEAT_INTERVAL_MS = 30_000
export const STALL_TIMEOUT_MS = 5 * 60_000

/** Terminal rows are kept this long for the dashboard's history, then pruned. */
export const TERMINAL_RETENTION_MS = 14 * 24 * 60 * 60_000

/**
 * Progress budget per pipeline stage. Optimization gets most of the bar
 * because it is the long part; the optimizer's phase/page cadence refines
 * it (uploadProgressPercent).
 */
export const STAGE_PROGRESS = {
  queued: 2,
  storing: 8,
  thumbnail: 18,
  optimizingStart: 22,
  optimizingEnd: 98,
  completed: 100
} as const

// Fraction of the optimization span reached at the *end* of each optimizer
// phase. Mirrors the client composable's PHASE_PROGRESS ordering.
const OPTIMIZER_PHASE_FRACTION: Record<string, number> = {
  waiting: 0,
  inspect: 0.05,
  split: 0.1,
  classify: 0.3,
  ocr: 0.75,
  merge: 0.85,
  compress: 0.97,
  done: 1
}

/**
 * Overall 0–100 progress for an optimizing job, refined by page-of-N while
 * inside the per-page phases.
 */
export function uploadProgressPercent(
  phase: string | null | undefined,
  page = 0,
  totalPages = 0
): number {
  const span = STAGE_PROGRESS.optimizingEnd - STAGE_PROGRESS.optimizingStart
  if (!phase) return STAGE_PROGRESS.optimizingStart
  let fraction = OPTIMIZER_PHASE_FRACTION[phase] ?? 0
  if ((phase === 'classify' || phase === 'ocr') && totalPages > 0) {
    const prev =
      phase === 'classify' ? OPTIMIZER_PHASE_FRACTION.split : OPTIMIZER_PHASE_FRACTION.classify
    const pageFrac = Math.min(1, Math.max(0, page / totalPages))
    fraction = prev + (fraction - prev) * pageFrac
  }
  return Math.round(STAGE_PROGRESS.optimizingStart + span * fraction)
}

/**
 * Apply the stall rule without mutating the row. Readers use this so a job
 * whose pod died reads as failed immediately, before the watchdog's next
 * sweep has persisted that.
 */
export function effectiveUploadJob(
  row: ReportUploadJob,
  now: number = Date.now()
): ReportUploadJob {
  if (!isActiveUploadStatus(row.status)) return row
  if (now - row.updatedAt.getTime() <= STALL_TIMEOUT_MS) return row
  return {
    ...row,
    status: 'failed',
    error: 'The upload stopped responding and was abandoned',
    errorCode: 'STALLED'
  }
}

export interface ReportUploadJobDTO {
  id: string
  status: ReportUploadJobStatus
  active: boolean
  progress: number
  phase: string | null
  page: number
  totalPages: number
  originalName: string
  filename: string
  fileUrl: string
  mimeType: string
  size: number
  finalSize: number | null
  preset: CompressionPreset
  thumbnailUrl: string | null
  optimizationJobId: string | null
  optimizationStatus: 'pending' | 'success' | 'error'
  optimizationResult: ReportOptimizationMeta | null
  error: string | null
  errorCode: string | null
  reportId: number | null
  reportTitle: string | null
  user: { id: number; name: string } | null
  dismissedAt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface UploadJobExtras {
  reportTitle?: string | null
  userName?: string | null
}

export function toUploadJobDTO(
  raw: ReportUploadJob,
  extras: UploadJobExtras = {},
  now: number = Date.now()
): ReportUploadJobDTO {
  const row = effectiveUploadJob(raw, now)
  return {
    id: row.id,
    status: row.status,
    active: isActiveUploadStatus(row.status),
    progress: row.status === 'completed' ? 100 : row.progress,
    phase: row.phase ?? null,
    page: row.page,
    totalPages: row.totalPages,
    originalName: row.originalName,
    filename: row.filename,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType,
    size: row.size,
    finalSize: row.finalSize ?? null,
    preset: row.preset,
    thumbnailUrl: row.thumbnailUrl ?? null,
    optimizationJobId: row.optimizationJobId ?? null,
    optimizationStatus: row.optimizationStatus,
    optimizationResult: row.optimizationResult ?? null,
    error: row.error ?? null,
    errorCode: row.errorCode ?? null,
    reportId: row.reportId ?? null,
    reportTitle: extras.reportTitle ?? null,
    user: row.userId ? { id: row.userId, name: extras.userName ?? 'Unknown' } : null,
    dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

export interface CreateUploadJobInput {
  userId: number | null
  originalName: string
  filename: string
  fileUrl: string
  mimeType: string
  size: number
  preset: CompressionPreset
}

export async function createUploadJob(input: CreateUploadJobInput): Promise<ReportUploadJob> {
  const now = new Date()
  const row: ReportUploadJob = {
    id: randomUUID(),
    userId: input.userId,
    reportId: null,
    status: 'queued',
    progress: STAGE_PROGRESS.queued,
    phase: null,
    page: 0,
    totalPages: 0,
    originalName: input.originalName.slice(0, 255),
    filename: input.filename,
    fileUrl: input.fileUrl,
    mimeType: input.mimeType,
    size: input.size,
    finalSize: null,
    preset: input.preset,
    thumbnailUrl: null,
    optimizationJobId: null,
    optimizationStatus: 'pending',
    optimizationResult: null,
    error: null,
    errorCode: null,
    dismissedAt: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  }
  await getDatabase().insert(schema.reportUploadJobs).values(row)
  return row
}

export async function getUploadJob(id: string): Promise<ReportUploadJob | undefined> {
  const [row] = await getDatabase()
    .select()
    .from(schema.reportUploadJobs)
    .where(eq(schema.reportUploadJobs.id, id))
    .limit(1)
  return row
}

/** Most recent job for a stored file URL (any status). */
export async function findUploadJobByFileUrl(
  fileUrl: string
): Promise<ReportUploadJob | undefined> {
  const [row] = await getDatabase()
    .select()
    .from(schema.reportUploadJobs)
    .where(eq(schema.reportUploadJobs.fileUrl, fileUrl))
    .orderBy(desc(schema.reportUploadJobs.createdAt))
    .limit(1)
  return row
}

export type UploadJobPatch = Partial<Omit<ReportUploadJob, 'id' | 'createdAt' | 'updatedAt'>>

/**
 * Patch a job. Always bumps updatedAt (the stall clock), so any progress
 * write doubles as a heartbeat. Failures are logged, never thrown — a lost
 * progress write must not abort the pipeline.
 */
export async function updateUploadJob(id: string, patch: UploadJobPatch): Promise<void> {
  try {
    await getDatabase()
      .update(schema.reportUploadJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.reportUploadJobs.id, id))
  } catch (err) {
    logError('reportUploadJobs', err)
  }
}

/** Heartbeat only — keeps an otherwise quiet job (queue wait) from stalling. */
export async function touchUploadJob(id: string): Promise<void> {
  await updateUploadJob(id, {})
}

export interface ListUploadJobsOptions {
  activeOnly?: boolean
  /** Include terminal jobs created after this instant (default: last 24h). */
  since?: Date
  includeDismissed?: boolean
  limit?: number
}

export type UploadJobListRow = ReportUploadJob & {
  reportTitle: string | null
  userName: string | null
}

/**
 * Jobs for the dashboard: every active job, plus recent terminal ones that
 * have not been dismissed. Active first, then newest.
 */
export async function listUploadJobs(
  opts: ListUploadJobsOptions = {}
): Promise<UploadJobListRow[]> {
  const db = getDatabase()
  const since = opts.since ?? new Date(Date.now() - 24 * 60 * 60_000)
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const active = inArray(schema.reportUploadJobs.status, [...ACTIVE_UPLOAD_STATUSES])

  const recentTerminal = opts.includeDismissed
    ? gt(schema.reportUploadJobs.createdAt, since)
    : and(gt(schema.reportUploadJobs.createdAt, since), isNull(schema.reportUploadJobs.dismissedAt))

  const where = opts.activeOnly ? active : or(active, recentTerminal)

  const activeFirst = sql<number>`CASE WHEN ${schema.reportUploadJobs.status} IN ('queued','storing','thumbnail','optimizing') THEN 0 ELSE 1 END`

  const rows = await db
    .select({
      job: schema.reportUploadJobs,
      userName: schema.users.name,
      reportTitle: schema.auditReportTranslations.title
    })
    .from(schema.reportUploadJobs)
    .leftJoin(schema.users, eq(schema.users.id, schema.reportUploadJobs.userId))
    .leftJoin(
      schema.auditReportTranslations,
      and(
        eq(schema.auditReportTranslations.auditReportId, schema.reportUploadJobs.reportId),
        eq(schema.auditReportTranslations.locale, 'en')
      )
    )
    .where(where)
    .orderBy(activeFirst, desc(schema.reportUploadJobs.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    ...r.job,
    reportTitle: r.reportTitle ?? null,
    userName: r.userName ?? null
  }))
}

/**
 * Attach a saved report to the job that uploaded its file. Refuses when the
 * job's file is not the one the report references, so a stale uploadJobId in
 * a form can never link the wrong file. Returns the (fresh) job, or
 * undefined when nothing was linked.
 */
export async function linkUploadJobToReport(
  jobId: string,
  reportId: number,
  expectedFileUrl: string
): Promise<ReportUploadJob | undefined> {
  const job = await getUploadJob(jobId)
  if (!job || job.fileUrl !== expectedFileUrl) return undefined
  if (job.reportId !== reportId) {
    await updateUploadJob(jobId, { reportId })
    job.reportId = reportId
  }
  return job
}

/**
 * Hide a finished job from the dashboard. Active jobs cannot be dismissed
 * (there is nothing to acknowledge yet). Returns false when nothing changed.
 */
export async function dismissUploadJob(id: string): Promise<boolean> {
  const [result] = await getDatabase()
    .update(schema.reportUploadJobs)
    .set({ dismissedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(schema.reportUploadJobs.id, id),
        inArray(schema.reportUploadJobs.status, ['completed', 'failed']),
        isNull(schema.reportUploadJobs.dismissedAt)
      )
    )
  return Boolean((result as { affectedRows?: number }).affectedRows)
}

/**
 * Watchdog: persist the stall rule for rows whose producer went quiet.
 * Returns the number of rows flipped. Exported for the plugin and tests.
 */
export async function sweepStalledUploadJobs(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALL_TIMEOUT_MS)
  const [result] = await getDatabase()
    .update(schema.reportUploadJobs)
    .set({
      status: 'failed',
      error: 'The upload stopped responding and was abandoned',
      errorCode: 'STALLED',
      completedAt: now,
      updatedAt: now
    })
    .where(
      and(
        inArray(schema.reportUploadJobs.status, [...ACTIVE_UPLOAD_STATUSES]),
        lt(schema.reportUploadJobs.updatedAt, cutoff)
      )
    )
  return Number((result as { affectedRows?: number }).affectedRows ?? 0)
}

/** Drop terminal rows older than the retention window. */
export async function pruneUploadJobs(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - TERMINAL_RETENTION_MS)
  await getDatabase()
    .delete(schema.reportUploadJobs)
    .where(
      and(
        inArray(schema.reportUploadJobs.status, ['completed', 'failed']),
        lt(schema.reportUploadJobs.createdAt, cutoff)
      )
    )
}

/**
 * Copy a finished job's outputs onto the report row that uses its file:
 * thumbnail (only if the report has none), the post-optimization size, and
 * the optimization snapshot (only if none was recorded yet). Targets the
 * linked report when its fileUrl still matches, else any live report that
 * references the file (create flow saved while the job ran). Idempotent —
 * both the pipeline and the create/update handlers call it, so whichever
 * side finishes second still lands the data.
 */
export async function applyUploadJobToReport(job: ReportUploadJob): Promise<void> {
  if (job.status !== 'completed') return
  const db = getDatabase()
  const values: Record<string, unknown> = {}

  if (job.thumbnailUrl) {
    values.thumbnail = sql`COALESCE(${schema.auditReports.thumbnail}, ${job.thumbnailUrl})`
  }
  if (job.finalSize) {
    values.fileSize = String(job.finalSize)
  }
  if (job.optimizationStatus === 'success' && job.optimizationResult) {
    values.optimizedAt = sql`COALESCE(${schema.auditReports.optimizedAt}, ${job.completedAt ?? new Date()})`
    values.optimizationMeta = sql`COALESCE(${schema.auditReports.optimizationMeta}, ${JSON.stringify(job.optimizationResult)})`
  }
  if (Object.keys(values).length === 0) return

  const target = job.reportId
    ? and(eq(schema.auditReports.id, job.reportId), eq(schema.auditReports.fileUrl, job.fileUrl))
    : and(eq(schema.auditReports.fileUrl, job.fileUrl), isNull(schema.auditReports.deletedAt))

  try {
    await db.update(schema.auditReports).set(values).where(target)
  } catch (err) {
    logError('reportUploadJobs', err)
  }
}
