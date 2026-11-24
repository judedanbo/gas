import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import { blobKeyFromFileUrl, downloadBlob, getBlobSize } from './blobStorage'
import { resolvePublicAsset } from './publicFiles'

export interface DownloadSource {
  /** Exact size of the file in bytes. */
  size: number
  /** Open the file for reading. Each call returns a fresh stream. */
  open: () => Promise<Readable>
}

/**
 * Locate the file behind a stored `fileUrl` (e.g. `/pdf/reports/x.pdf`) and
 * report its size without opening it, so callers can plan a response (total
 * size, what to include) before streaming anything.
 *
 * Same resolution order as the single-file endpoints under /api/downloads:
 * Azure Blob first, then the on-disk public asset. Returns null when the file
 * is in neither place. A storage outage throws rather than returning null, so
 * it is not mistaken for a missing file.
 */
export async function resolveDownloadSource(
  fileUrl: string | null | undefined
): Promise<DownloadSource | null> {
  const key = blobKeyFromFileUrl(fileUrl)
  if (key) {
    const size = await getBlobSize(key)
    if (size !== null) {
      return {
        size,
        open: async () => {
          const blob = await downloadBlob(key)
          if (!blob) throw new Error(`Blob disappeared before it could be read: ${key}`)
          return blob.stream
        }
      }
    }
  }

  const filePath = resolvePublicAsset(fileUrl)
  if (!filePath) return null

  const info = await stat(filePath).catch(() => null)
  if (!info?.isFile()) return null

  return { size: info.size, open: async () => createReadStream(filePath) }
}
