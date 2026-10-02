import {
  mysqlTable,
  int,
  bigint,
  boolean,
  varchar,
  datetime,
  json,
  mysqlEnum,
  index
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { auditReports, type ReportOptimizationMeta } from './audit-reports'

/**
 * Lifecycle of a background A-G report upload. The browser only transfers
 * the bytes; everything after that (storing to Blob, thumbnailing,
 * optimizing, patching the report row) runs server-side and is tracked here.
 *
 * Rows live in MySQL rather than the in-process/Redis optimization job
 * mirror so progress survives admin logouts, session expiry, other tabs,
 * and pod restarts — the admin notification center polls this table.
 *
 * The pipeline itself runs in one pod's process. A status past 'storing'
 * means the original is durable in storage, so if that process goes away
 * (deploy, scale-down, OOM) the job can be resumed by another one; before
 * that the bytes only existed in the dead pod's spool and the job fails.
 */
export const REPORT_UPLOAD_JOB_STATUSES = [
  'queued',
  'storing',
  'thumbnail',
  'optimizing',
  'completed',
  'failed'
] as const

export type ReportUploadJobStatus = (typeof REPORT_UPLOAD_JOB_STATUSES)[number]

export const reportUploadJobs = mysqlTable(
  'report_upload_jobs',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
    reportId: int('report_id').references(() => auditReports.id, { onDelete: 'set null' }),
    status: mysqlEnum('status', REPORT_UPLOAD_JOB_STATUSES).notNull().default('queued'),
    /** Coarse 0–100 across the whole pipeline (see reportUploadJobs.ts). */
    progress: int('progress').notNull().default(0),
    /** Optimizer phase while status = optimizing ('waiting' before a slot frees). */
    phase: varchar('phase', { length: 32 }),
    page: int('page').notNull().default(0),
    totalPages: int('total_pages').notNull().default(0),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    fileUrl: varchar('file_url', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    /** Bytes received from the browser. */
    size: bigint('size', { mode: 'number', unsigned: true }).notNull(),
    /** Bytes in storage once the pipeline finished (post-optimization). */
    finalSize: bigint('final_size', { mode: 'number', unsigned: true }),
    preset: mysqlEnum('preset', ['screen', 'ebook', 'printer']).notNull().default('ebook'),
    /** Kept so a resumed run optimizes exactly as the upload asked. */
    allowDropBookmarks: boolean('allow_drop_bookmarks').notNull().default(false),
    /**
     * Fencing token of the pipeline run that owns the job. Every pipeline
     * write is conditional on it, so a run that lost the job (handed off at
     * shutdown, or presumed dead and resumed elsewhere) can no longer touch
     * the row. NULL once released.
     */
    runId: varchar('run_id', { length: 36 }),
    /** Host (pod name) of that run, so a restarted container can reclaim its predecessor's jobs. */
    worker: varchar('worker', { length: 255 }),
    /** Pipeline runs started so far — the original plus resumes. Caps resumes. */
    attempts: int('attempts').notNull().default(1),
    /** Set while a stored job waits for another run to resume it; cleared when one claims it. */
    interruptedAt: datetime('interrupted_at'),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
    /** In-process optimization job id (pdfOptimizationJobs) for SSE attach. */
    optimizationJobId: varchar('optimization_job_id', { length: 36 }),
    optimizationStatus: mysqlEnum('optimization_status', ['pending', 'success', 'error'])
      .notNull()
      .default('pending'),
    optimizationResult: json('optimization_result').$type<ReportOptimizationMeta>(),
    /** Safe, admin-facing summary — never internals or file paths. */
    error: varchar('error', { length: 255 }),
    errorCode: varchar('error_code', { length: 50 }),
    dismissedAt: datetime('dismissed_at'),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    /** Written explicitly on every mutation and by the pipeline heartbeat. */
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    completedAt: datetime('completed_at')
  },
  (table) => [
    index('idx_report_upload_jobs_status').on(table.status),
    index('idx_report_upload_jobs_user').on(table.userId),
    index('idx_report_upload_jobs_report').on(table.reportId),
    index('idx_report_upload_jobs_file_url').on(table.fileUrl),
    index('idx_report_upload_jobs_created').on(table.createdAt),
    index('idx_report_upload_jobs_interrupted').on(table.interruptedAt)
  ]
)

export type ReportUploadJob = typeof reportUploadJobs.$inferSelect
export type NewReportUploadJob = typeof reportUploadJobs.$inferInsert
