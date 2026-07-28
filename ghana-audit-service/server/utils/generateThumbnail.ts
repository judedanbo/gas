import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { readFile, copyFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { isBlobStorageConfigured, uploadBlob } from './blobStorage'

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
 */
export async function generateThumbnailFromPdf(pdfPath: string): Promise<string | null> {
  if (!existsSync(pdfPath)) return null

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const uuid = randomUUID()
  const finalName = `${date}-${uuid}.jpg`
  const outputPrefix = join(tmpdir(), `gas-thumb-${date}-${uuid}`)
  const tempJpg = `${outputPrefix}.jpg`

  try {
    execFileSync('pdftoppm', [
      '-jpeg',
      '-singlefile',
      '-f', '1',
      '-scale-to', String(THUMBNAIL_WIDTH),
      '-jpegopt', 'quality=85',
      pdfPath,
      outputPrefix
    ], { timeout: 30_000, stdio: 'pipe' })
  } catch {
    return null
  }

  if (!existsSync(tempJpg)) return null

  try {
    if (isBlobStorageConfigured()) {
      await uploadBlob(`uploads/thumbnails/${finalName}`, await readFile(tempJpg), 'image/jpeg')
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
    await unlink(tempJpg).catch(() => {})
  }
}

export function removeThumbnail(thumbnailUrl: string): void {
  if (!thumbnailUrl || !thumbnailUrl.startsWith('/uploads/thumbnails/')) return
  const filePath = join(process.cwd(), 'public', thumbnailUrl)
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch { /* best-effort cleanup */ }
}
