import { requirePermission } from '../../../utils/adminHelpers'
import { handleFileUpload, getAllowedTypes, getMaxFileSize } from '../../../utils/fileUpload'
import { logAuditAction } from '../../../utils/auditLogger'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')

  const query = getQuery(event)
  const type = (query.type as string) || 'image'

  // Validate upload type
  const validTypes = ['report', 'publication', 'image', 'thumbnail']
  if (!validTypes.includes(type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid upload type',
      message: `Type must be one of: ${validTypes.join(', ')}`
    })
  }

  try {
    const result = await handleFileUpload(
      event,
      type as 'report' | 'publication' | 'image' | 'thumbnail'
    )

    // Log upload action
    await logAuditAction(event, 'create', 'file_upload', null, {
      after: {
        type,
        filename: result.filename,
        originalName: result.originalName,
        size: result.size,
        mimeType: result.mimeType,
        url: result.url
      }
    })

    return {
      success: true,
      ...result
    }
  } catch (error: unknown) {
    // Re-throw if it's already an H3Error
    const err = error as { statusCode?: number; message?: string }
    if (err.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Upload failed',
      message: err.message || 'Unknown error'
    })
  }
})

// Also export GET for getting upload info
export const get = defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  return {
    uploadTypes: {
      report: {
        allowedTypes: getAllowedTypes('report'),
        maxSize: getMaxFileSize('report'),
        maxSizeMB: getMaxFileSize('report') / (1024 * 1024)
      },
      publication: {
        allowedTypes: getAllowedTypes('publication'),
        maxSize: getMaxFileSize('publication'),
        maxSizeMB: getMaxFileSize('publication') / (1024 * 1024)
      },
      image: {
        allowedTypes: getAllowedTypes('image'),
        maxSize: getMaxFileSize('image'),
        maxSizeMB: getMaxFileSize('image') / (1024 * 1024)
      },
      thumbnail: {
        allowedTypes: getAllowedTypes('thumbnail'),
        maxSize: getMaxFileSize('thumbnail'),
        maxSizeMB: getMaxFileSize('thumbnail') / (1024 * 1024)
      }
    }
  }
})
