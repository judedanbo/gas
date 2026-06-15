/**
 * Azure Blob Storage backend for report/publication PDFs.
 *
 * PDFs used to live in `public/pdf/` and ship inside the container image
 * (2.6 GB). They now live in a private Blob container; the download endpoints
 * stream them through the API (preserving rate-limiting + download analytics)
 * and uploads write straight to Blob.
 *
 * Configured via AZURE_STORAGE_CONNECTION_STRING + AZURE_BLOB_CONTAINER. When
 * unset, isBlobStorageConfigured() is false and callers fall back to the legacy
 * on-disk path — mirroring the graceful-degradation pattern in utils/redis.ts so
 * local dev / tests / CI stay green without Azure credentials.
 */

import type { Readable } from 'node:stream'
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob'

let container: ContainerClient | null = null
let initialised = false

/**
 * True when both the connection string and target container are configured.
 * Callers use this to decide between the Blob backend and the legacy on-disk
 * fallback.
 */
export function isBlobStorageConfigured(): boolean {
  return Boolean(
    process.env.AZURE_STORAGE_CONNECTION_STRING?.trim() &&
      process.env.AZURE_BLOB_CONTAINER?.trim()
  )
}

/**
 * Get the shared ContainerClient, or null if Blob storage is not configured.
 * Lazily constructed on first call. fromConnectionString() does not open a
 * network connection, so construction is cheap and offline-safe.
 */
export function getContainerClient(): ContainerClient | null {
  if (initialised) return container

  initialised = true
  if (!isBlobStorageConfigured()) return null

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!.trim()
  const name = process.env.AZURE_BLOB_CONTAINER!.trim()
  const service = BlobServiceClient.fromConnectionString(conn)
  container = service.getContainerClient(name)
  return container
}

/**
 * Test helper: drop the cached client so a subsequent getContainerClient()
 * re-reads the env. Internal use only.
 */
export function __resetBlobForTests(): void {
  container = null
  initialised = false
}

/**
 * Test helper: inject a fake ContainerClient (or null to simulate the
 * unconfigured state) so the wrappers below can be exercised without Azure.
 */
export function __setContainerClientForTests(client: ContainerClient | null): void {
  container = client
  initialised = true
}

export interface BlobDownload {
  stream: Readable
  contentLength: number
  contentType: string
}

/**
 * Upload bytes to `key` with the given content type. Throws if Blob storage is
 * unconfigured — callers gate on isBlobStorageConfigured() to choose the
 * backend, so reaching here without a client is a programming error.
 */
export async function uploadBlob(key: string, data: Buffer, contentType: string): Promise<void> {
  const client = getContainerClient()
  if (!client) {
    throw new Error('Blob storage is not configured (AZURE_STORAGE_CONNECTION_STRING / AZURE_BLOB_CONTAINER)')
  }
  await client.getBlockBlobClient(key).uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType }
  })
}

/**
 * Open a readable stream for `key`. Returns null when Blob storage is
 * unconfigured (caller falls back to disk) or the blob does not exist (404).
 */
export async function downloadBlob(key: string): Promise<BlobDownload | null> {
  const client = getContainerClient()
  if (!client) return null

  try {
    const res = await client.getBlobClient(key).download()
    if (!res.readableStreamBody) return null
    return {
      // In Node, readableStreamBody is a stream.Readable; the SDK types it as
      // the broader NodeJS.ReadableStream.
      stream: res.readableStreamBody as Readable,
      contentLength: res.contentLength ?? 0,
      contentType: res.contentType ?? 'application/octet-stream'
    }
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) return null
    throw err
  }
}

/**
 * Resolve a stored public-facing fileUrl (e.g. `/pdf/reports/x.pdf`) to a
 * streamable Blob source, or null when Blob storage is unconfigured, the URL is
 * unsafe (traversal), or the blob is missing. Download endpoints call this
 * first and fall back to the on-disk asset when it returns null.
 */
export async function tryBlobSource(fileUrl: string | null | undefined): Promise<BlobDownload | null> {
  const key = blobKeyFromFileUrl(fileUrl)
  if (!key) return null
  return downloadBlob(key)
}

/**
 * Whether `key` exists in the container. False when unconfigured.
 */
export async function blobExists(key: string): Promise<boolean> {
  const client = getContainerClient()
  if (!client) return false
  return client.getBlobClient(key).exists()
}

/**
 * Convert a stored public-facing fileUrl (e.g. `/pdf/reports/x.pdf`) to a blob
 * key (`pdf/reports/x.pdf`). Returns null for empty input or any path that
 * could escape the container (traversal) — the security boundary for blob
 * access, mirroring resolvePublicAsset()'s cleaning of on-disk paths.
 */
export function blobKeyFromFileUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null

  const cleaned = fileUrl.split('?')[0].split('#')[0].replace(/^\/+/, '')
  if (!cleaned || cleaned.includes('..')) return null

  return cleaned
}
