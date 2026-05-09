import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const THUMBNAIL_WIDTH = 600
const THUMBNAIL_DIR = 'public/uploads/thumbnails'

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function generateThumbnailFromPdf(pdfPath: string): string | null {
  if (!existsSync(pdfPath)) return null

  const uploadDir = join(process.cwd(), THUMBNAIL_DIR)
  ensureDir(uploadDir)

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const uuid = randomUUID()
  const finalName = `${date}-${uuid}.jpg`
  const outputPrefix = join(uploadDir, `${date}-${uuid}`)

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

  if (!existsSync(`${outputPrefix}.jpg`)) return null

  return `/uploads/thumbnails/${finalName}`
}

export function removeThumbnail(thumbnailUrl: string): void {
  if (!thumbnailUrl || !thumbnailUrl.startsWith('/uploads/thumbnails/')) return
  const filePath = join(process.cwd(), 'public', thumbnailUrl)
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch { /* best-effort cleanup */ }
}
