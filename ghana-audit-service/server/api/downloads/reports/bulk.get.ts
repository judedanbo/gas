import { performance } from 'node:perf_hooks'
import { pipeline } from 'node:stream/promises'
import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  bulkArchiveFileName,
  resolveBulkReportFiles,
  type BulkReportFile
} from '../../../utils/bulkReportArchive'
import { createZipStream, zipArchiveSize } from '../../../utils/zipStream'
import { recordBulkDownload, type DeliveredDownload } from '../../../utils/analytics/recordDownload'
import { internalError } from '../../../utils/errors'
import { logError } from '../../../utils/logger'
import {
  BULK_REPORT_MAX_BYTES,
  BULK_REPORT_MAX_FILES,
  isBulkCheck,
  parseBulkReportIds,
  type BulkReportDownloadSummary
} from '~/utils/bulkReportDownload'

/**
 * GET /api/downloads/reports/bulk?ids=3,7,12[&check=1]
 *
 * Streams the chosen published reports as one ZIP. Nothing is buffered or
 * written to disk: each PDF is piped from storage straight into the response,
 * one at a time (see utils/zipStream.ts), so memory stays flat however large
 * the selection is.
 *
 * With `check=1` the same validation runs but the answer is a JSON summary of
 * the download. The /reports page asks first so it can explain a problem (too
 * large, limit reached, files missing) in the page, then hands the real URL to
 * the browser as an ordinary download.
 *
 * Rate limiting happens in server/middleware/rateLimit.ts before this runs: a
 * ZIP costs one unit of the hourly download allowance per report requested.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const ids = parseBulkReportIds(query.ids)
  if (!ids) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Choose between 1 and ${BULK_REPORT_MAX_FILES} reports to download together.`,
      data: { code: 'BULK_INVALID_SELECTION', maxFiles: BULK_REPORT_MAX_FILES }
    })
  }

  let files: BulkReportFile[]
  try {
    const rows = await getDatabase()
      .select({
        id: schema.auditReports.id,
        slug: schema.auditReports.slug,
        fileUrl: schema.auditReports.fileUrl,
        updatedAt: schema.auditReports.updatedAt
      })
      .from(schema.auditReports)
      .where(
        and(
          inArray(schema.auditReports.id, ids),
          eq(schema.auditReports.isPublished, true),
          isNull(schema.auditReports.deletedAt)
        )
      )
      .orderBy(desc(schema.auditReports.publishedAt), desc(schema.auditReports.id))

    files = await resolveBulkReportFiles(rows)
  } catch (err) {
    throw internalError('downloads:reports:bulk', err)
  }

  if (files.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'None of the selected reports is available to download.',
      data: { code: 'BULK_NONE_AVAILABLE' }
    })
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  if (totalBytes > BULK_REPORT_MAX_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Payload Too Large',
      message: 'The selected reports are too large to download together. Choose fewer reports.',
      data: { code: 'BULK_TOO_LARGE', totalBytes, maxBytes: BULK_REPORT_MAX_BYTES }
    })
  }

  const zipBytes = zipArchiveSize(files)
  const fileName = bulkArchiveFileName()
  const included = new Set(files.map((file) => file.id))

  // Either answer describes this visitor's request at this moment.
  setHeader(event, 'Cache-Control', 'private, no-store, must-revalidate')

  if (isBulkCheck(query.check)) {
    const summary: BulkReportDownloadSummary = {
      count: files.length,
      totalBytes,
      zipBytes,
      fileName,
      unavailable: ids.filter((id) => !included.has(id))
    }
    return summary
  }

  // One download_events row per report actually sent, so a report's download
  // count is the same whether it was fetched alone or inside an archive.
  const delivered: DeliveredDownload[] = []
  let entryStartedAt = performance.now()
  recordBulkDownload(event, { kind: 'report', delivered: () => delivered })

  const archive = createZipStream(files, {
    onEntryComplete: (index) => {
      const now = performance.now()
      const file = files[index]
      delivered.push({
        targetId: file.id,
        slug: file.slug,
        bytes: file.size,
        durationMs: now - entryStartedAt
      })
      entryStartedAt = now
    }
  })

  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Length', zipBytes)
  setHeader(event, 'Content-Disposition', `attachment; filename="${fileName}"`)

  try {
    // pipeline() ties the two together in both directions: if the visitor
    // cancels, the archive and the storage read behind it are torn down; if
    // storage fails part-way, the connection is cut. Content-Length is already
    // out, so the browser reports a failed download rather than keeping a
    // truncated archive.
    await pipeline(archive, event.node.res)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      logError('downloads:reports:bulk', err)
    }
  }

  // The response was written (or abandoned) above; nothing left for h3 to send.
  event._handled = true
  return undefined
})
