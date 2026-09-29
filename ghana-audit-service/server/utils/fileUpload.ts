import { randomUUID } from 'crypto'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { copyFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import type { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import Busboy from 'busboy'
import { createError, type H3Error, type H3Event } from 'h3'
import { blobKeyFromFileUrl, getContainerClient, uploadBlobFromFile } from './blobStorage'

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

/**
 * A multipart file part that has been streamed to a temporary file on disk.
 * The caller owns `tempPath` and must remove it when done.
 */
export interface ReceivedFile {
  tempPath: string
  originalName: string
  mimeType: string
  size: number
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
 * Directory that in-flight uploads are spooled to before they are persisted.
 * Defaults to the OS temp dir; override with UPLOAD_TMP_DIR (e.g. to point at a
 * dedicated volume when the container root filesystem is read-only).
 */
function getUploadTempDir(): string {
  return process.env.UPLOAD_TMP_DIR || tmpdir()
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

async function removeQuietly(path: string): Promise<void> {
  try {
    await unlink(path)
  } catch {
    // Already gone (never created, or cleaned up on the error path).
  }
}

/**
 * Stream the `file` part of a multipart/form-data request to a temporary file,
 * enforcing the config's size and MIME limits as the bytes arrive.
 *
 * This deliberately does NOT use h3's readMultipartFormData(): that helper
 * buffers the whole body and then parses it byte-by-byte into a plain JS
 * array (roughly 8 bytes of heap per byte of upload, plus copies), which
 * exhausts the pod's memory on large report PDFs and crashes the server —
 * surfacing to the browser as a 502 from the ingress. Streaming keeps memory
 * flat regardless of file size.
 *
 * `request` is the raw Node request (or any Readable emitting the multipart
 * body); `headers` must carry the multipart content-type with its boundary.
 * Resolves with the spooled file; rejects with a client-facing 400 H3 error for
 * missing/oversize/disallowed files or a malformed body, and a 500 when the
 * spool file itself cannot be written.
 */
export async function receiveMultipartFile(
  request: Readable,
  headers: Record<string, string | string[] | undefined>,
  config: UploadConfig
): Promise<ReceivedFile> {
  const contentType = headers['content-type']
  if (typeof contentType !== 'string' || !contentType.startsWith('multipart/form-data')) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  let parser: ReturnType<typeof Busboy>
  try {
    parser = Busboy({
      headers,
      // Browsers send filenames as UTF-8; busboy's default (latin1) mangles
      // non-ASCII names, which h3 previously re-decoded for us.
      defParamCharset: 'utf8',
      limits: { files: 1, fileSize: config.maxSize, fields: 20, fieldSize: 64 * 1024 }
    })
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Malformed upload',
      data: { error: error instanceof Error ? error.message : String(error) }
    })
  }

  const tempDir = getUploadTempDir()
  ensureDirectoryExists(tempDir)
  const tempPath = join(tempDir, `gas-upload-${randomUUID()}`)

  // Mutable holder rather than bare `let`s: TS narrows closure-assigned lets
  // to their initialiser at the read sites below.
  const state = {
    received: null as ReceivedFile | null,
    rejection: null as H3Error | null,
    spool: null as Promise<void> | null
  }

  parser.on('file', (name, stream, info) => {
    if (name !== 'file' || state.received) {
      // Not the field we want (or a second file): drain so busboy can proceed.
      stream.resume()
      return
    }

    const mimeType = info.mimeType || 'application/octet-stream'
    if (!config.allowedTypes.includes(mimeType)) {
      state.rejection = createError({
        statusCode: 400,
        statusMessage: `File type ${mimeType} is not allowed. Allowed types: ${config.allowedTypes.join(', ')}`
      })
      stream.resume()
      return
    }

    const received: ReceivedFile = {
      tempPath,
      originalName: info.filename || `upload${getExtensionFromMime(mimeType)}`,
      mimeType,
      size: 0
    }
    state.received = received

    stream.on('data', (chunk: Buffer) => {
      received.size += chunk.length
    })
    stream.on('limit', () => {
      const maxMB = config.maxSize / (1024 * 1024)
      state.rejection = createError({
        statusCode: 400,
        statusMessage: `File exceeds maximum size of ${maxMB}MB`
      })
    })

    state.spool = pipeline(stream, createWriteStream(tempPath))
  })

  try {
    await pipeline(request, parser)
  } catch (error) {
    // The spool pipeline is torn down with the request; swallow its rejection
    // so it doesn't surface as an unhandled promise.
    await state.spool?.catch(() => undefined)
    await removeQuietly(tempPath)
    throw createError({
      statusCode: 400,
      statusMessage: 'Malformed upload',
      data: { error: error instanceof Error ? error.message : String(error) }
    })
  }

  try {
    await state.spool
  } catch (error) {
    await removeQuietly(tempPath)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save file',
      data: { error: error instanceof Error ? error.message : String(error) }
    })
  }

  if (state.rejection) {
    await removeQuietly(tempPath)
    throw state.rejection
  }

  if (!state.received) {
    await removeQuietly(tempPath)
    throw createError({ statusCode: 400, statusMessage: 'No file found in request' })
  }

  if (state.received.size === 0) {
    await removeQuietly(tempPath)
    throw createError({ statusCode: 400, statusMessage: 'File is empty' })
  }

  return state.received
}

/**
 * Persist a spooled upload from `sourcePath` and return the public-facing URL.
 *
 * For `backend: 'blob'` configs the file is streamed to Azure Blob Storage when
 * a container client is available; otherwise (no Azure config, or 'disk'
 * backend) it is copied into the local upload directory. The returned URL is
 * identical either way, so the DB `fileUrl` contract and the `/api/downloads/**`
 * indirection are unchanged regardless of backend.
 *
 * The source file is left in place; the caller removes it.
 */
export async function persistUpload(
  config: UploadConfig,
  filename: string,
  sourcePath: string,
  mimeType: string
): Promise<string> {
  const urlBase = config.urlBase || '/uploads'
  const urlPath = `${urlBase}/${config.directory}/${filename}`

  if (config.backend === 'blob' && getContainerClient()) {
    const key = blobKeyFromFileUrl(urlPath)
    if (!key) {
      throw new Error(`Could not derive a blob key from "${urlPath}"`)
    }
    await uploadBlobFromFile(key, sourcePath, mimeType)
    return urlPath
  }

  const baseDir = config.baseDir || getUploadBaseDir()
  const uploadDir = join(baseDir, config.directory)
  ensureDirectoryExists(uploadDir)
  // copyFile rather than rename: the spool dir and the upload dir are usually
  // different filesystems (tmpfs / Azure Files mount), where rename fails.
  await copyFile(sourcePath, join(uploadDir, filename))
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

  const req = event.node.req
  const received = await receiveMultipartFile(req, req.headers, config)

  try {
    const filename = generateFilename(received.originalName)

    // Persist to the configured backend (Blob for reports, disk otherwise)
    let url: string
    try {
      url = await persistUpload(config, filename, received.tempPath, received.mimeType)
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
      originalName: received.originalName,
      size: received.size,
      mimeType: received.mimeType
    }
  } finally {
    await removeQuietly(received.tempPath)
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
