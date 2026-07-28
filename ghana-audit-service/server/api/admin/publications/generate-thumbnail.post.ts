import { requirePermission } from '../../../utils/adminHelpers'
import { materializePdfSource } from '../../../utils/pdfSource'
import { generateThumbnailFromPdf } from '../../../utils/generateThumbnail'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')

  const body = await readBody<{ fileUrl?: string }>(event)
  const fileUrl = body?.fileUrl

  if (!fileUrl || typeof fileUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'fileUrl is required' })
  }

  if (!fileUrl.startsWith('/uploads/publications/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
  }

  const source = await materializePdfSource(fileUrl)
  if (!source) {
    throw createError({ statusCode: 422, statusMessage: 'PDF file not found in storage' })
  }

  try {
    const thumbnailUrl = generateThumbnailFromPdf(source.path)
    if (!thumbnailUrl) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
      })
    }

    return { success: true, thumbnailUrl }
  } finally {
    await source.cleanup()
  }
})
