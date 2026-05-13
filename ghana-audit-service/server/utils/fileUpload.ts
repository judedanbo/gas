import { randomUUID } from 'crypto'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join, extname } from 'path'
import type { H3Event, MultiPartData } from 'h3'

export interface UploadConfig {
  allowedTypes: string[]
  maxSize: number
  directory: string
  baseDir?: string
  urlBase?: string
}

export interface UploadResult {
  url: string
  filename: string
  originalName: string
  size: number
  mimeType: string
}

const uploadConfigs: Record<string, UploadConfig> = {
  report: {
    allowedTypes: ['application/pdf'],
    maxSize: 100 * 1024 * 1024, // 100MB
    directory: 'reports',
    baseDir: 'public/pdf',
    urlBase: '/pdf'
  },
  publication: {
    allowedTypes: ['application/pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
    directory: 'publications'
  },
  image: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxSize: 5 * 1024 * 1024, // 5MB
    directory: 'images'
  },
  thumbnail: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 2 * 1024 * 1024, // 2MB
    directory: 'thumbnails'
  }
}

/**
 * Get upload base directory from environment or default
 */
function getUploadBaseDir(): string {
  return process.env.UPLOAD_DIRECTORY || 'public/uploads'
}

/**
 * Ensure upload directory exists
 */
function ensureDirectoryExists(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Generate a unique filename
 */
function generateFilename(originalName: string): string {
  const ext = extname(originalName).toLowerCase()
  const uuid = randomUUID()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${date}-${uuid}${ext}`
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  }
  return mimeToExt[mimeType] || ''
}

/**
 * Validate file against config
 */
function validateFile(
  file: MultiPartData,
  config: UploadConfig
): { valid: boolean; error?: string } {
  if (!file.data || file.data.length === 0) {
    return { valid: false, error: 'File is empty' }
  }

  if (file.data.length > config.maxSize) {
    const maxMB = config.maxSize / (1024 * 1024)
    return { valid: false, error: `File exceeds maximum size of ${maxMB}MB` }
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!config.allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type ${mimeType} is not allowed. Allowed types: ${config.allowedTypes.join(', ')}`
    }
  }

  return { valid: true }
}

/**
 * Handle file upload
 */
export async function handleFileUpload(
  event: H3Event,
  type: 'report' | 'publication' | 'image' | 'thumbnail'
): Promise<UploadResult> {
  const config = uploadConfigs[type]
  if (!config) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid upload type'
    })
  }

  // Parse multipart form data
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded'
    })
  }

  // Find the file field
  const file = formData.find((part) => part.name === 'file')
  if (!file || !file.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file found in request'
    })
  }

  // Validate file
  const validation = validateFile(file, config)
  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: validation.error
    })
  }

  // Generate filename and path
  const originalName = file.filename || `upload${getExtensionFromMime(file.type || '')}`
  const filename = generateFilename(originalName)
  const baseDir = config.baseDir || getUploadBaseDir()
  const uploadDir = join(baseDir, config.directory)
  const filePath = join(uploadDir, filename)

  // Ensure directory exists
  ensureDirectoryExists(uploadDir)

  // Write file
  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(filePath)

    writeStream.on('finish', () => {
      const urlBase = config.urlBase || '/uploads'
      const urlPath = `${urlBase}/${config.directory}/${filename}`

      resolve({
        url: urlPath,
        filename,
        originalName,
        size: file.data!.length,
        mimeType: file.type || 'application/octet-stream'
      })
    })

    writeStream.on('error', (error) => {
      reject(
        createError({
          statusCode: 500,
          statusMessage: 'Failed to save file',
          data: { error: error.message }
        })
      )
    })

    writeStream.write(file.data)
    writeStream.end()
  })
}

/**
 * Get allowed file types for a category
 */
export function getAllowedTypes(type: string): string[] {
  return uploadConfigs[type]?.allowedTypes || []
}

/**
 * Get max file size for a category
 */
export function getMaxFileSize(type: string): number {
  return uploadConfigs[type]?.maxSize || 0
}
