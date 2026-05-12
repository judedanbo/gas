import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, basename } from 'node:path'
import { and, eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { resolvePublicAsset } from '../../../utils/publicFiles'
import { recordDownload } from '../../../utils/analytics/recordDownload'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Publication ID or slug is required' })
  }

  const isNumericId = /^\d+$/.test(id)
  const idCondition = isNumericId
    ? eq(schema.publications.id, Number(id))
    : eq(schema.publications.slug, id)

  const db = getDatabase()
  const [publication] = await db
    .select({
      id: schema.publications.id,
      slug: schema.publications.slug,
      fileUrl: schema.publications.fileUrl
    })
    .from(schema.publications)
    .where(
      and(
        idCondition,
        eq(schema.publications.isPublished, true),
        isNull(schema.publications.deletedAt)
      )
    )
    .limit(1)

  if (!publication || !publication.fileUrl) {
    throw createError({ statusCode: 404, statusMessage: 'Publication not found' })
  }

  const filePath = resolvePublicAsset(publication.fileUrl)
  const query = getQuery(event)
  const isInlineView = query.view === '1' || query.view === 'true'

  if (!filePath) {
    if (/^https?:\/\//.test(publication.fileUrl)) {
      return sendRedirect(event, publication.fileUrl, 302)
    }
    throw createError({ statusCode: 404, statusMessage: 'Publication file not available' })
  }

  const fileStat = await stat(filePath)
  const ext = extname(filePath) || '.pdf'
  const downloadName = `${publication.slug || basename(filePath, ext)}${ext}`

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Length', fileStat.size)
  setHeader(
    event,
    'Content-Disposition',
    `${isInlineView ? 'inline' : 'attachment'}; filename="${downloadName.replace(/"/g, '')}"`
  )
  setHeader(event, 'Cache-Control', isInlineView
    ? 'private, max-age=300'
    : 'private, no-store, must-revalidate'
  )

  recordDownload(event, {
    kind: 'publication',
    targetId: publication.id,
    slug: publication.slug
  })

  return sendStream(event, createReadStream(filePath))
})
