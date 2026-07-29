import { and, eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import type { ReportOptimizationMeta } from '../database/schema/audit-reports'
import type { CompressionPreset, OptimizeResult } from './pdfOptimizer'
import { logError } from './logger'

/**
 * Record a successful optimization run on the report row: new file size
 * (unless compression was skipped), optimizedAt, and the result snapshot.
 *
 * Two targeting modes:
 * - reportId (edit flow): the job was started for a saved report.
 * - fileUrl fallback (create flow): no reportId existed when the job started;
 *   if the admin has saved the report in the meantime, the row is found by
 *   its file URL. If it doesn't exist yet, the create form carries the
 *   metadata instead (AdminFileModal's update:optimization emit).
 *
 * Persistence failures are logged but never fail the job — the optimized
 * file itself is already stored at this point.
 */
export async function persistOptimizationResult(
  fileUrl: string,
  reportId: number | null,
  preset: CompressionPreset,
  result: OptimizeResult
): Promise<void> {
  const meta: ReportOptimizationMeta = {
    preset,
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    savedBytes: result.savedBytes,
    pageCount: result.pageCount,
    nativePages: result.nativePages,
    scannedPages: result.scannedPages,
    ocrFailedPages: result.ocrFailedPages,
    skippedCompression: result.skippedCompression
  }

  const values: {
    optimizedAt: Date
    optimizationMeta: ReportOptimizationMeta
    fileSize?: string
  } = {
    optimizedAt: new Date(),
    optimizationMeta: meta
  }
  if (!result.skippedCompression) {
    values.fileSize = String(result.optimizedSize)
  }

  try {
    const db = getDatabase()
    if (reportId) {
      await db
        .update(schema.auditReports)
        .set(values)
        .where(eq(schema.auditReports.id, reportId))
    } else {
      await db
        .update(schema.auditReports)
        .set(values)
        .where(
          and(eq(schema.auditReports.fileUrl, fileUrl), isNull(schema.auditReports.deletedAt))
        )
    }
  } catch (err) {
    logError('pdfOptimizer', err)
  }
}
