import * as cheerio from 'cheerio'
import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { join, basename } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const BASE_URL = 'https://audit.gov.gh'

export function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path
  const cleaned = path.replace(/^(\.\.\/)+/, '/')
  return `${BASE_URL}${cleaned}`
}

export async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  console.log(`  Fetching: ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const html = await res.text()
  return cheerio.load(html)
}

export async function downloadImage(
  imageUrl: string,
  destDir: string
): Promise<string | null> {
  try {
    const resolved = resolveUrl(imageUrl)
    const filename = sanitizeFilename(basename(new URL(resolved).pathname))
    const destPath = join(destDir, filename)

    if (existsSync(destPath)) {
      return filename
    }

    mkdirSync(destDir, { recursive: true })

    const res = await fetch(resolved)
    if (!res.ok || !res.body) {
      console.warn(`  Warning: Failed to download: ${resolved} (${res.status})`)
      return null
    }

    const fileStream = createWriteStream(destPath)
    await pipeline(Readable.fromWeb(res.body as any), fileStream)
    return filename
  } catch (err) {
    console.warn(`  Warning: Download error for ${imageUrl}: ${(err as Error).message}`)
    return null
  }
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

export function writeJson(filePath: string, data: unknown): void {
  mkdirSync(join(filePath, '..'), { recursive: true })
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Done: Wrote ${filePath}`)
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
