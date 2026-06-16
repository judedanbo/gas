import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, basename } from 'node:path'
import { and, eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { resolvePublicAsset } from '../../../utils/publicFiles'
import { tryBlobSource } from '../../../utils/blobStorage'
import { recordDownload } from '../../../utils/analytics/recordDownload'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Report ID or slug is required' })
  }

  const isNumericId = /^\d+$/.test(id)
  const idCondition = isNumericId
    ? eq(schema.auditReports.id, Number(id))
    : eq(schema.auditReports.slug, id)

  const db = getDatabase()
  const [report] = await db
    .select({
      id: schema.auditReports.id,
      slug: schema.auditReports.slug,
      fileUrl: schema.auditReports.fileUrl
    })
    .from(schema.auditReports)
    .where(
      and(
        idCondition,
        eq(schema.auditReports.isPublished, true),
        isNull(schema.auditReports.deletedAt)
      )
    )
    .limit(1)

  if (!report || !report.fileUrl) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  const ext = extname(report.fileUrl) || '.pdf'
  const downloadName = `${report.slug || basename(report.fileUrl, ext)}${ext}`
  const query = getQuery(event)
  const isInlineView = query.view === '1' || query.view === 'true'

  const setDownloadHeaders = (contentLength: number) => {
    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'Content-Length', contentLength)
    setHeader(
      event,
      'Content-Disposition',
      `${isInlineView ? 'inline' : 'attachment'}; filename="${downloadName.replace(/"/g, '')}"`
    )
    setHeader(
      event,
      'Cache-Control',
      isInlineView ? 'private, max-age=300' : 'private, no-store, must-revalidate'
    )
  }

  // Prefer Blob storage; fall back to the on-disk asset when Blob is
  // unconfigured or the object is missing (e.g. legacy files not yet migrated).
  const blob = await tryBlobSource(report.fileUrl)
  if (blob) {
    setDownloadHeaders(blob.contentLength)
    recordDownload(event, { kind: 'report', targetId: report.id, slug: report.slug })
    return sendStream(event, blob.stream)
  }

  const filePath = resolvePublicAsset(report.fileUrl)
  if (!filePath) {
    throw createError({ statusCode: 404, statusMessage: 'Report file not available' })
  }

  const fileStat = await stat(filePath)
  setDownloadHeaders(fileStat.size)
  recordDownload(event, { kind: 'report', targetId: report.id, slug: report.slug })
  return sendStream(event, createReadStream(filePath))
})
