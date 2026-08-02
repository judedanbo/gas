import { randomUUID } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join, extname } from 'path'
import type { H3Event, MultiPartData } from 'h3'
import { blobKeyFromFileUrl, getContainerClient, uploadBlob } from './blobStorage'

export interface UploadConfig {
  allowedTypes: string[]
  maxSize: number
  directory: string
  baseDir?: string
  urlBase?: string
  /**
   * Where persisted bytes go. 'blob' uploads to Azure Blob Storage when
   * configured (falling back to disk otherwise); omitted/'disk' always writes
   * to the local filesystem.
   */
  backend?: 'blob' | 'disk'
}

export interface UploadResult {
  url: string
  filename: string
  originalName: string
  size: number
  mimeType: string
}

export const uploadConfigs: Record<string, UploadConfig> = {
  report: {
    allowedTypes: ['application/pdf'],
    maxSize: 100 * 1024 * 1024, // 100MB
    directory: 'reports',
    baseDir: 'public/pdf',
    urlBase: '/pdf',
    backend: 'blob'
  },
  publication: {
    allowedTypes: ['application/pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
    directory: 'publications',
    // Like reports: served via /api/downloads/publications/{id} (blob-first),
    // and direct /uploads/publications/*.pdf access is blocked (staticAssets),
    // so nothing depends on the file being on disk. Writing to cwd public/
    // would be invisible in production anyway (only .output/public is served).
    backend: 'blob'
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
 * Get upload base directory from environment or default.
 *
 * Exported so the /uploads/** serving routes resolve reads against exactly the
 * directory writes went to, including a non-default UPLOAD_DIRECTORY.
 */
export function getUploadBaseDir(): string {
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
 * Persist validated file bytes and return the public-facing URL.
 *
 * For `backend: 'blob'` configs the bytes go to Azure Blob Storage when a
 * container client is available; otherwise (no Azure config, or 'disk' backend)
 * they are written to the local filesystem. The returned URL is identical
 * either way, so the DB `fileUrl` contract and the `/api/downloads/**`
 * indirection are unchanged regardless of backend.
 */
export async function persistUpload(
  config: UploadConfig,
  filename: string,
  data: Buffer,
  mimeType: string
): Promise<string> {
  const urlBase = config.urlBase || '/uploads'
  const urlPath = `${urlBase}/${config.directory}/${filename}`

  if (config.backend === 'blob' && getContainerClient()) {
    const key = blobKeyFromFileUrl(urlPath)
    if (!key) {
      throw new Error(`Could not derive a blob key from "${urlPath}"`)
    }
    await uploadBlob(key, data, mimeType)
    return urlPath
  }

  const baseDir = config.baseDir || getUploadBaseDir()
  const uploadDir = join(baseDir, config.directory)
  ensureDirectoryExists(uploadDir)
  await writeFile(join(uploadDir, filename), data)
  return urlPath
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

  // Generate filename
  const originalName = file.filename || `upload${getExtensionFromMime(file.type || '')}`
  const filename = generateFilename(originalName)
  const mimeType = file.type || 'application/octet-stream'

  // Persist to the configured backend (Blob for reports, disk otherwise)
  let url: string
  try {
    url = await persistUpload(config, filename, file.data, mimeType)
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save file',
      data: { error: error instanceof Error ? error.message : String(error) }
    })
  }

  return {
    url,
    filename,
    originalName,
    size: file.data.length,
    mimeType
  }
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
