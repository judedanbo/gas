import { createWriteStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { resolvePublicAsset } from './publicFiles'
import { tryBlobSource, blobKeyFromFileUrl } from './blobStorage'

export interface LocalPdfSource {
  /** Absolute path to a readable copy of the PDF. */
  path: string
  /** Blob key when the bytes came from Azure Blob (path is then a temp file). */
  blobKey: string | null
  /** Remove the temp copy (no-op for on-disk sources). Never throws. */
  cleanup: () => Promise<void>
}

/**
 * Resolve a stored fileUrl (e.g. `/pdf/reports/x.pdf`) to a local, readable
 * PDF path for tools that need a filesystem file (pdftoppm, Ghostscript).
 *
 * Tries Azure Blob first (backend: 'blob' uploads), streaming the blob to a
 * temp file, then falls back to the on-disk public asset (dev/legacy layout) —
 * the same resolution order as the /api/downloads/** endpoints. Keeping the
 * orders identical matters: if a file exists in both backends, a consumer that
 * mutates the disk copy while downloads serve the blob would silently diverge.
 * Returns null when the file exists in neither backend. Callers must await
 * cleanup() when done.
 */
export async function materializePdfSource(fileUrl: string): Promise<LocalPdfSource | null> {
  const blob = await tryBlobSource(fileUrl)
  if (blob) {
    const tempPath = join(tmpdir(), `gas-pdf-src-${randomUUID()}.pdf`)
    await pipeline(blob.stream, createWriteStream(tempPath))
    return {
      path: tempPath,
      blobKey: blobKeyFromFileUrl(fileUrl),
      cleanup: async () => {
        await unlink(tempPath).catch(() => {})
      }
    }
  }

  const diskPath = resolvePublicAsset(fileUrl)
  if (!diskPath) return null

  return { path: diskPath, blobKey: null, cleanup: async () => {} }
}
