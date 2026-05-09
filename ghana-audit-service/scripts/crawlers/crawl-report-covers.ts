import { delay, sanitizeFilename, writeJson } from './utils'
import { join } from 'node:path'
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { createWriteStream } from 'node:fs'

const IMG_DIR = join(process.cwd(), 'public/img/reports')
const SEED_PATH = join(process.cwd(), 'server/database/seeds/data/reports.json')
const TMP_DIR = join(process.cwd(), '.tmp-pdf')
const DELAY_MS = 1500

interface SeedReport {
  slug: string
  category: string
  year: number
  publishedAt: string
  fileUrl: string
  fileSize: string
  thumbnail: string | null
  isPublished: boolean
  translations: {
    en: { title: string; summary: string | null }
  }
}

interface DownloadResult {
  ok: boolean
  sizeBytes: number
}

async function downloadPdf(url: string, destPath: string): Promise<DownloadResult> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GAS-Website-Builder/1.0' },
      signal: AbortSignal.timeout(60_000)
    })
    if (!res.ok || !res.body) {
      console.warn(`  ✗ HTTP ${res.status}: ${url.slice(-80)}`)
      return { ok: false, sizeBytes: 0 }
    }
    const fileStream = createWriteStream(destPath)
    await pipeline(Readable.fromWeb(res.body as any), fileStream)
    const sizeBytes = statSync(destPath).size
    return { ok: true, sizeBytes }
  } catch (err) {
    console.warn(`  ✗ Download failed: ${(err as Error).message}`)
    return { ok: false, sizeBytes: 0 }
  }
}

function pdfToJpeg(pdfPath: string, outputPrefix: string): string | null {
  try {
    execFileSync('pdftoppm', [
      '-f', '1', '-l', '1',
      '-jpeg',
      '-scale-to', '800',
      '-jpegopt', 'quality=85',
      pdfPath,
      outputPrefix
    ], { timeout: 30_000, stdio: 'pipe' })

    const candidates = ['-1.jpg', '-01.jpg', '-001.jpg']
    for (const suffix of candidates) {
      const path = `${outputPrefix}${suffix}`
      if (existsSync(path)) return path
    }
    return null
  } catch (err) {
    console.warn(`  ✗ pdftoppm failed: ${(err as Error).message.split('\n')[0]}`)
    return null
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

async function crawlReportCovers() {
  mkdirSync(IMG_DIR, { recursive: true })
  mkdirSync(TMP_DIR, { recursive: true })

  const reports: SeedReport[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'))
  console.log(`Processing ${reports.length} reports...\n`)

  let success = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i]
    const imgFilename = `${sanitizeFilename(report.slug)}.jpg`
    const imgPath = join(IMG_DIR, imgFilename)

    process.stdout.write(`[${i + 1}/${reports.length}] ${report.slug.slice(0, 60)}... `)

    const alreadyHasThumbnail = existsSync(imgPath)
    const alreadyHasSize = report.fileSize !== '0'

    if (alreadyHasThumbnail && alreadyHasSize) {
      report.thumbnail = `/img/reports/${imgFilename}`
      skipped++
      console.log('SKIP (exists)')
      continue
    }

    const pdfPath = join(TMP_DIR, `${report.slug.slice(0, 100)}.pdf`)
    const { ok, sizeBytes } = await downloadPdf(report.fileUrl, pdfPath)
    if (!ok) {
      failed++
      console.log('FAIL (download)')
      continue
    }

    if (sizeBytes > 0) {
      report.fileSize = String(sizeBytes)
    }

    if (!alreadyHasThumbnail) {
      const outputPrefix = join(TMP_DIR, 'cover')
      const jpegPath = pdfToJpeg(pdfPath, outputPrefix)

      try { unlinkSync(pdfPath) } catch {}

      if (!jpegPath) {
        failed++
        console.log(`FAIL (convert) [${formatBytes(sizeBytes)}]`)
        continue
      }

      const data = readFileSync(jpegPath)
      writeFileSync(imgPath, data)
      try { unlinkSync(jpegPath) } catch {}
    } else {
      try { unlinkSync(pdfPath) } catch {}
    }

    report.thumbnail = `/img/reports/${imgFilename}`
    success++
    console.log(`OK [${formatBytes(sizeBytes)}]`)

    if ((i + 1) % 25 === 0) {
      writeFileSync(SEED_PATH, JSON.stringify(reports, null, 2), 'utf-8')
      console.log(`  [checkpoint: saved progress at ${i + 1}/${reports.length}]`)
    }

    if (i < reports.length - 1) {
      await delay(DELAY_MS)
    }
  }

  writeJson(SEED_PATH, reports)

  try {
    if (readdirSync(TMP_DIR).length === 0) rmdirSync(TMP_DIR)
  } catch {}

  const totalBytes = reports.reduce((sum, r) => sum + (parseInt(r.fileSize) || 0), 0)
  const withSize = reports.filter(r => r.fileSize !== '0').length

  console.log(`\nDone!`)
  console.log(`  ✓ ${success} covers extracted`)
  console.log(`  ⊘ ${skipped} already existed`)
  console.log(`  ✗ ${failed} failed`)
  console.log(`  📦 ${withSize}/${reports.length} reports have file sizes (total: ${formatBytes(totalBytes)})`)
}

crawlReportCovers().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
