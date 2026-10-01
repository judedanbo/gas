import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { copyFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { isBlobStorageConfigured, uploadBlobFromFile } from './blobStorage'

const execFileAsync = promisify(execFile)

const THUMBNAIL_WIDTH = 600
const THUMBNAIL_DIR = 'public/uploads/thumbnails'

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Render page 1 of a PDF to a JPEG thumbnail and persist it.
 *
 * The JPEG is rendered into tmpdir, then stored in Azure Blob under
 * `uploads/thumbnails/<name>` when Blob is configured, else moved into
 * `<cwd>/public/uploads/thumbnails` (dev/legacy layout). The returned URL is
 * `/uploads/thumbnails/<name>.jpg` either way: on disk it is served as a
 * static asset; blob-backed thumbnails are streamed by the
 * server/routes/uploads/thumbnails/[name].get.ts fallback route. Writing to
 * cwd `public/` in production would be invisible — the container serves only
 * `.output/public` — which is why Blob is the production path.
 *
 * pdftoppm runs as an async child process: a slow render (up to the 30s
 * timeout) must not block the event loop, which would stall every other
 * request on the pod. Aborting `signal` kills the render; like a timeout or a
 * crash, that resolves null rather than throwing.
 */
export async function generateThumbnailFromPdf(
  pdfPath: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<string | null> {
  if (signal?.aborted || !existsSync(pdfPath)) return null

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const uuid = randomUUID()
  const finalName = `${date}-${uuid}.jpg`
  const outputPrefix = join(tmpdir(), `gas-thumb-${date}-${uuid}`)
  const tempJpg = `${outputPrefix}.jpg`

  try {
    await execFileAsync(
      'pdftoppm',
      [
        '-jpeg',
        '-singlefile',
        '-f',
        '1',
        '-scale-to',
        String(THUMBNAIL_WIDTH),
        '-jpegopt',
        'quality=85',
        pdfPath,
        outputPrefix
      ],
      { timeout: 30_000, signal }
    )

    if (!existsSync(tempJpg)) return null

    if (isBlobStorageConfigured()) {
      await uploadBlobFromFile(`uploads/thumbnails/${finalName}`, tempJpg, 'image/jpeg')
    } else {
      const uploadDir = join(process.cwd(), THUMBNAIL_DIR)
      ensureDir(uploadDir)
      // copy + unlink instead of rename: tmpdir may be a different filesystem
      await copyFile(tempJpg, join(uploadDir, finalName))
    }
    return `/uploads/thumbnails/${finalName}`
  } catch {
    return null
  } finally {
    // Also covers a render that failed or was killed part-way through writing.
    await unlink(tempJpg).catch(() => {})
  }
}

export function removeThumbnail(thumbnailUrl: string): void {
  if (!thumbnailUrl || !thumbnailUrl.startsWith('/uploads/thumbnails/')) return
  const filePath = join(process.cwd(), 'public', thumbnailUrl)
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch {
    /* best-effort cleanup */
  }
}
