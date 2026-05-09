import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, basename } from 'node:path'
import { and, eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { resolvePublicAsset } from '../../../utils/publicFiles'

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

  const filePath = resolvePublicAsset(report.fileUrl)
  if (!filePath) {
    throw createError({ statusCode: 404, statusMessage: 'Report file not available' })
  }

  const fileStat = await stat(filePath)
  const ext = extname(filePath) || '.pdf'
  const downloadName = `${report.slug || basename(filePath, ext)}${ext}`

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Length', fileStat.size)
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${downloadName.replace(/"/g, '')}"`
  )
  // Don't let intermediaries cache rate-limited responses.
  setHeader(event, 'Cache-Control', 'private, no-store, must-revalidate')

  return sendStream(event, createReadStream(filePath))
})
