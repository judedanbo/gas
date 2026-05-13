import { requirePermission } from '../../../utils/adminHelpers'
import { resolvePublicAsset } from '../../../utils/publicFiles'
import { generateThumbnailFromPdf } from '../../../utils/generateThumbnail'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')

  const body = await readBody<{ fileUrl?: string }>(event)
  const fileUrl = body?.fileUrl

  if (!fileUrl || typeof fileUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'fileUrl is required' })
  }

  if (!fileUrl.startsWith('/pdf/reports/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
  }

  const pdfPath = resolvePublicAsset(fileUrl)
  if (!pdfPath) {
    throw createError({ statusCode: 422, statusMessage: 'PDF file not found' })
  }

  const thumbnailUrl = generateThumbnailFromPdf(pdfPath)
  if (!thumbnailUrl) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
    })
  }

  return { success: true, thumbnailUrl }
})
