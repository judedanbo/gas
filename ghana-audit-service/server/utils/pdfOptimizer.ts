import { execFile } from 'node:child_process'
import { existsSync, statSync, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'

// External-process runner. Injectable so unit tests can swap in a fake
// without trying to mock the node:child_process module (which is unreliable
// for transitive imports under vitest).
export interface ExecResult {
  stdout: string
  stderr: string
}

export type ExecRunner = (
  bin: string,
  args: string[],
  options?: { timeout?: number; maxBuffer?: number }
) => Promise<ExecResult>

const defaultExecRunner: ExecRunner = (bin, args, options = {}) =>
  new Promise<ExecResult>((resolve, reject) => {
    execFile(bin, args, options, (err, stdout, stderr) => {
      if (err) {
        reject(err)
        return
      }
      resolve({
        stdout: typeof stdout === 'string' ? stdout : String(stdout ?? ''),
        stderr: typeof stderr === 'string' ? stderr : String(stderr ?? '')
      })
    })
  })

let currentExecRunner: ExecRunner = defaultExecRunner

/**
 * Test helper. Swap the underlying execFile runner with a fake. Always call
 * with `null` (or the default) in afterEach to restore production behaviour.
 */
export function __setExecRunnerForTests(runner: ExecRunner | null): void {
  currentExecRunner = runner ?? defaultExecRunner
}

const execFileAsync: ExecRunner = (bin, args, options) => currentExecRunner(bin, args, options)

// External binaries the pipeline depends on. Resolved at runtime via execFile
// so missing tools surface as a clear error instead of a child-process crash.
const BIN = {
  qpdf: 'qpdf',
  pdfinfo: 'pdfinfo',
  pdftotext: 'pdftotext',
  pdffonts: 'pdffonts',
  pdfimages: 'pdfimages',
  pdftoppm: 'pdftoppm',
  tesseract: 'tesseract',
  gs: 'gs'
} as const

// Hard timeouts per child invocation. Tesseract can be slow on dense pages;
// Ghostscript on a 100 MB book is the longest-tail call.
const TIMEOUT = {
  pdfinfo: 30_000,
  qpdfSplit: 5 * 60_000,
  qpdfMerge: 5 * 60_000,
  pdftotext: 60_000,
  pdffonts: 30_000,
  pdfimages: 30_000,
  pdftoppm: 90_000,
  tesseract: 90_000,
  gs: 10 * 60_000
} as const

// At most this many scanned pages OCR in parallel — Tesseract is single-thread
// per page but CPU-hungry, so we cap to keep dev hosts responsive.
const OCR_CONCURRENCY = 2

// pdftotext output threshold (printable chars) that classifies a page as
// "native" — anything below and we look for embedded fonts / images.
const NATIVE_TEXT_THRESHOLD = 20

export type CompressionPreset = 'screen' | 'ebook' | 'printer'
export type PageKind = 'native' | 'scanned'

export interface OptimizeOptions {
  preset?: CompressionPreset
  ocrLanguage?: string
  onProgress?: (event: ProgressEvent) => void
  // Allow optimization to run even when the source PDF has bookmarks (which
  // qpdf --pages does not preserve). Off by default.
  allowDropBookmarks?: boolean
}

export type ProgressEvent =
  | { phase: 'inspect'; pageCount: number; hasBookmarks: boolean }
  | { phase: 'split' }
  | { phase: 'classify'; page: number; totalPages: number; kind: PageKind; reason: string }
  | { phase: 'ocr'; page: number; totalPages: number }
  | { phase: 'merge' }
  | { phase: 'compress' }
  | {
      phase: 'done'
      originalSize: number
      optimizedSize: number
      savedBytes: number
      skippedCompression: boolean
      nativePages: number
      scannedPages: number
    }

export interface OptimizeResult {
  originalSize: number
  optimizedSize: number
  savedBytes: number
  skippedCompression: boolean
  nativePages: number
  scannedPages: number
  pageCount: number
}

export class PdfOptimizerError extends Error {
  code:
    | 'MISSING_BINARY'
    | 'HAS_BOOKMARKS'
    | 'INSPECT_FAILED'
    | 'SPLIT_FAILED'
    | 'MERGE_FAILED'
    | 'COMPRESS_FAILED'
    | 'PAGE_COUNT_MISMATCH'
    | 'NO_INPUT'
  constructor(code: PdfOptimizerError['code'], message: string) {
    super(message)
    this.code = code
    this.name = 'PdfOptimizerError'
  }
}

interface PdfInfo {
  pageCount: number
  hasBookmarks: boolean
}

// Map our public preset names to Ghostscript /PDFSETTINGS and DPI choices.
// Note: gs only downsamples raster images — vector text/lines/shapes are
// always preserved at full fidelity regardless of preset.
const PRESET_TO_GS: Record<
  CompressionPreset,
  { pdfsettings: string; colorDpi: number; grayDpi: number; monoDpi: number }
> = {
  screen: { pdfsettings: '/screen', colorDpi: 72, grayDpi: 72, monoDpi: 300 },
  ebook: { pdfsettings: '/ebook', colorDpi: 150, grayDpi: 150, monoDpi: 300 },
  printer: { pdfsettings: '/printer', colorDpi: 300, grayDpi: 300, monoDpi: 1200 }
}

/**
 * Optimize an audit-report PDF in place:
 *  - page 1 (cover) is preserved byte-for-byte
 *  - pages 2..N are classified per-page; only flat scans are rasterized + OCRed
 *  - vector pages (tables, charts, native text) pass through structurally intact
 *  - the merged result is recompressed by Ghostscript with image-only downsampling
 *
 * Replaces the input file when the output is strictly smaller; otherwise leaves
 * the original alone and reports skippedCompression: true.
 */
export async function optimizeReportPdf(
  pdfPath: string,
  opts: OptimizeOptions = {}
): Promise<OptimizeResult> {
  if (!existsSync(pdfPath)) {
    throw new PdfOptimizerError('NO_INPUT', `Input PDF not found: ${pdfPath}`)
  }

  const preset = opts.preset ?? 'ebook'
  const ocrLanguage = opts.ocrLanguage ?? 'eng'
  const emit = opts.onProgress ?? (() => {})

  // Per-job temp dir keeps concurrent optimizations isolated and lets us nuke
  // everything in one rmrf at the end.
  const workDir = join(tmpdir(), `gas-pdf-${randomUUID()}`)
  await fs.mkdir(workDir, { recursive: true })

  const originalSize = statSync(pdfPath).size

  try {
    // 1. Inspect ---------------------------------------------------------
    const info = await readPdfInfo(pdfPath)
    emit({ phase: 'inspect', pageCount: info.pageCount, hasBookmarks: info.hasBookmarks })

    if (info.hasBookmarks && !opts.allowDropBookmarks) {
      throw new PdfOptimizerError(
        'HAS_BOOKMARKS',
        'Source PDF has bookmarks; optimization would drop them. Pass allowDropBookmarks=true to proceed.'
      )
    }

    if (info.pageCount <= 0) {
      throw new PdfOptimizerError('INSPECT_FAILED', 'PDF has no pages')
    }

    // 2. Split -----------------------------------------------------------
    emit({ phase: 'split' })
    const splitDir = join(workDir, 'pages')
    await fs.mkdir(splitDir, { recursive: true })
    await splitByPage(pdfPath, splitDir)

    // qpdf names files with zero-padded indices to keep lexical ordering
    // matching numeric ordering ("page-001.pdf"). Read them back in order.
    const pageFiles = await listSplitPages(splitDir)
    if (pageFiles.length !== info.pageCount) {
      throw new PdfOptimizerError(
        'SPLIT_FAILED',
        `qpdf produced ${pageFiles.length} pages but pdfinfo expected ${info.pageCount}`
      )
    }

    // Cover (page 1) is always preserved untouched. The pipeline only acts
    // on pages 2..N.
    let nativePages = 0
    let scannedPages = 0

    // 3. Classify + 4. OCR scanned pages --------------------------------
    const finalPagePaths: string[] = [pageFiles[0]]
    const bodyClassifications: Array<{ idx: number; kind: PageKind; reason: string; src: string }> =
      []

    for (let i = 1; i < pageFiles.length; i++) {
      const src = pageFiles[i]
      const { kind, reason } = await classifyPage(src)
      bodyClassifications.push({ idx: i, kind, reason, src })
      emit({
        phase: 'classify',
        page: i + 1,
        totalPages: pageFiles.length,
        kind,
        reason
      })
    }

    // OCR scanned pages with bounded concurrency. Native pages don't need any
    // work — their split file IS the final page file.
    const scannedJobs = bodyClassifications.filter((c) => c.kind === 'scanned')
    const ocrOutputs = new Map<number, string>()

    await runWithConcurrency(scannedJobs, OCR_CONCURRENCY, async (job) => {
      const out = await ocrPage(job.src, workDir, job.idx, ocrLanguage)
      ocrOutputs.set(job.idx, out)
      emit({
        phase: 'ocr',
        page: job.idx + 1,
        totalPages: pageFiles.length
      })
    })

    for (const c of bodyClassifications) {
      if (c.kind === 'scanned') {
        const ocrPath = ocrOutputs.get(c.idx)
        if (!ocrPath) {
          // Fall back to the original page if OCR mysteriously produced nothing.
          finalPagePaths.push(c.src)
          nativePages++
        } else {
          finalPagePaths.push(ocrPath)
          scannedPages++
        }
      } else {
        finalPagePaths.push(c.src)
        nativePages++
      }
    }

    // 5. Concatenate -----------------------------------------------------
    emit({ phase: 'merge' })
    const combinedPath = join(workDir, 'combined.pdf')
    await concatenatePages(finalPagePaths, combinedPath)

    // 6. Compress --------------------------------------------------------
    emit({ phase: 'compress' })
    const optimizedPath = join(workDir, 'optimized.pdf')
    await runGhostscript(combinedPath, optimizedPath, preset)

    // 7. Sanity check ----------------------------------------------------
    const finalInfo = await readPdfInfo(optimizedPath)
    if (finalInfo.pageCount !== info.pageCount) {
      throw new PdfOptimizerError(
        'PAGE_COUNT_MISMATCH',
        `Ghostscript output has ${finalInfo.pageCount} pages, expected ${info.pageCount}`
      )
    }

    const optimizedSize = statSync(optimizedPath).size

    // 8. Replace ---------------------------------------------------------
    let skippedCompression = false
    let finalSize = originalSize
    if (optimizedSize < originalSize) {
      await fs.rename(optimizedPath, pdfPath)
      finalSize = optimizedSize
    } else {
      // gs grew the file (already-tight native PDF). Keep the original.
      skippedCompression = true
      finalSize = originalSize
    }

    const result: OptimizeResult = {
      originalSize,
      optimizedSize: finalSize,
      savedBytes: originalSize - finalSize,
      skippedCompression,
      nativePages,
      scannedPages,
      pageCount: info.pageCount
    }

    emit({
      phase: 'done',
      originalSize,
      optimizedSize: finalSize,
      savedBytes: result.savedBytes,
      skippedCompression,
      nativePages,
      scannedPages
    })

    return result
  } finally {
    // 9. Cleanup ---------------------------------------------------------
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {
      /* best-effort */
    })
  }
}

// ---------------------------------------------------------------------------
// Pipeline helpers
// ---------------------------------------------------------------------------

async function readPdfInfo(path: string): Promise<PdfInfo> {
  let stdout: string
  try {
    ;({ stdout } = await execFileAsync(BIN.pdfinfo, [path], {
      timeout: TIMEOUT.pdfinfo
    }))
  } catch (err) {
    throw wrapMissingBinaryError(err, BIN.pdfinfo, 'INSPECT_FAILED')
  }

  const pages = matchKey(stdout, 'Pages')
  const pageCount = pages ? parseInt(pages, 10) : NaN
  if (!Number.isFinite(pageCount)) {
    throw new PdfOptimizerError('INSPECT_FAILED', 'Could not read page count from pdfinfo')
  }

  // pdfinfo emits a "Bookmarks: yes" line only when an outline is present.
  // Some builds use "Outline:" instead; check both.
  const bookmarks = matchKey(stdout, 'Bookmarks') || matchKey(stdout, 'Outline')
  const hasBookmarks = bookmarks?.toLowerCase().startsWith('yes') ?? false

  return { pageCount, hasBookmarks }
}

async function splitByPage(input: string, outDir: string): Promise<void> {
  try {
    await execFileAsync(BIN.qpdf, [input, '--split-pages=1', join(outDir, 'page-%d.pdf')], {
      timeout: TIMEOUT.qpdfSplit
    })
  } catch (err) {
    throw wrapMissingBinaryError(err, BIN.qpdf, 'SPLIT_FAILED')
  }
}

async function listSplitPages(dir: string): Promise<string[]> {
  const all = await fs.readdir(dir)
  const matches = all
    .filter((n) => /^page-\d+\.pdf$/.test(n))
    .map((n) => ({
      name: n,
      idx: parseInt(n.replace(/^page-/, '').replace(/\.pdf$/, ''), 10)
    }))
    .sort((a, b) => a.idx - b.idx)
  return matches.map((m) => join(dir, m.name))
}

async function classifyPage(pagePath: string): Promise<{ kind: PageKind; reason: string }> {
  // 1) Real extractable text → native. Cheap and conclusive.
  try {
    const { stdout } = await execFileAsync(BIN.pdftotext, ['-layout', pagePath, '-'], {
      timeout: TIMEOUT.pdftotext
    })
    const printable = stdout.replace(/\s+/g, '').trim()
    if (printable.length >= NATIVE_TEXT_THRESHOLD) {
      return { kind: 'native', reason: `pdftotext returned ${printable.length} chars` }
    }
  } catch (err) {
    // pdftotext can fail on damaged streams — fall through and try fonts.
    if (isMissingBinaryError(err, BIN.pdftotext)) {
      throw wrapMissingBinaryError(err, BIN.pdftotext, 'INSPECT_FAILED')
    }
  }

  // 2) Embedded fonts exist but no extractable text → likely text encoded with
  //    a non-standard CMap (still native; OCR would just add noise).
  try {
    const { stdout } = await execFileAsync(BIN.pdffonts, [pagePath], {
      timeout: TIMEOUT.pdffonts
    })
    // pdffonts prints a two-line header then one row per font.
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)
    if (lines.length > 2) {
      return { kind: 'native', reason: `pdffonts lists ${lines.length - 2} font(s)` }
    }
  } catch (err) {
    if (isMissingBinaryError(err, BIN.pdffonts)) {
      throw wrapMissingBinaryError(err, BIN.pdffonts, 'INSPECT_FAILED')
    }
  }

  // 3) Page has at least one image and no fonts → treat as a scanned page.
  //    A page with no images and no text and no fonts is most likely an empty
  //    or vector-art page — default to native so we never rasterize unknown
  //    vector content away.
  try {
    const { stdout } = await execFileAsync(BIN.pdfimages, ['-list', pagePath], {
      timeout: TIMEOUT.pdfimages
    })
    // pdfimages -list prints a header (2 lines) then one row per image.
    const dataLines = stdout.split('\n').filter((l) => /^\s*\d/.test(l))
    if (dataLines.length >= 1) {
      return { kind: 'scanned', reason: `pdfimages found ${dataLines.length} image(s), no text` }
    }
  } catch (err) {
    if (isMissingBinaryError(err, BIN.pdfimages)) {
      throw wrapMissingBinaryError(err, BIN.pdfimages, 'INSPECT_FAILED')
    }
  }

  return { kind: 'native', reason: 'no text, no fonts, no images — defaulting to native' }
}

async function ocrPage(
  pagePath: string,
  workDir: string,
  idx: number,
  language: string
): Promise<string> {
  const renderDir = join(workDir, 'render')
  await fs.mkdir(renderDir, { recursive: true })
  const ppmPrefix = join(renderDir, `page-${idx}`)

  try {
    await execFileAsync(BIN.pdftoppm, ['-r', '300', '-gray', pagePath, ppmPrefix], {
      timeout: TIMEOUT.pdftoppm
    })
  } catch (err) {
    throw wrapMissingBinaryError(err, BIN.pdftoppm, 'SPLIT_FAILED')
  }

  // pdftoppm produces page-N-1.pgm for a single-page input.
  const candidates = (await fs.readdir(renderDir)).filter((n) =>
    n.startsWith(`${basename(ppmPrefix)}-`)
  )
  if (candidates.length === 0) {
    throw new PdfOptimizerError('SPLIT_FAILED', `pdftoppm produced no output for page ${idx + 1}`)
  }
  const renderedPath = join(renderDir, candidates[0])

  const ocrOutPrefix = join(workDir, `ocr-${idx}`)
  try {
    await execFileAsync(BIN.tesseract, [renderedPath, ocrOutPrefix, '-l', language, 'pdf'], {
      timeout: TIMEOUT.tesseract
    })
  } catch (err) {
    throw wrapMissingBinaryError(err, BIN.tesseract, 'SPLIT_FAILED')
  }

  // Tesseract appends ".pdf" to the prefix.
  const ocrPath = `${ocrOutPrefix}.pdf`
  if (!existsSync(ocrPath)) {
    throw new PdfOptimizerError('SPLIT_FAILED', `Tesseract did not write ${ocrPath}`)
  }
  return ocrPath
}

async function concatenatePages(pagePaths: string[], outPath: string): Promise<void> {
  // qpdf --empty --pages a.pdf b.pdf c.pdf -- out.pdf
  const args = ['--empty', '--pages', ...pagePaths, '--', outPath]
  try {
    await execFileAsync(BIN.qpdf, args, { timeout: TIMEOUT.qpdfMerge })
  } catch (err) {
    throw wrapMissingBinaryError(err, BIN.qpdf, 'MERGE_FAILED')
  }
}

async function runGhostscript(
  input: string,
  output: string,
  preset: CompressionPreset
): Promise<void> {
  const conf = PRESET_TO_GS[preset]
  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.6',
    `-dPDFSETTINGS=${conf.pdfsettings}`,
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dDownsampleColorImages=true',
    '-dColorImageDownsampleType=/Bicubic',
    `-dColorImageResolution=${conf.colorDpi}`,
    '-dDownsampleGrayImages=true',
    '-dGrayImageDownsampleType=/Bicubic',
    `-dGrayImageResolution=${conf.grayDpi}`,
    '-dDownsampleMonoImages=true',
    '-dMonoImageDownsampleType=/Subsample',
    `-dMonoImageResolution=${conf.monoDpi}`,
    '-dAutoFilterColorImages=true',
    '-dAutoFilterGrayImages=true',
    '-dPassThroughJPEGImages=true',
    '-dNOPAUSE',
    '-dBATCH',
    `-sOutputFile=${output}`,
    input
  ]
  try {
    await execFileAsync(BIN.gs, args, { timeout: TIMEOUT.gs, maxBuffer: 16 * 1024 * 1024 })
  } catch (err) {
    throw wrapMissingBinaryError(err, BIN.gs, 'COMPRESS_FAILED')
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  let cursor = 0

  async function loop(): Promise<void> {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) return
      await worker(items[idx])
    }
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(loop())
  }
  await Promise.all(workers)
}

function matchKey(blob: string, key: string): string | null {
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'mi')
  const m = blob.match(re)
  return m ? m[1].trim() : null
}

interface ExecError extends Error {
  code?: string | number
  errno?: string | number
  path?: string
}

function isMissingBinaryError(err: unknown, expected: string): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as ExecError
  return e.code === 'ENOENT' && (!e.path || e.path === expected)
}

function wrapMissingBinaryError(
  err: unknown,
  binary: string,
  fallback: PdfOptimizerError['code']
): PdfOptimizerError {
  if (err instanceof PdfOptimizerError) return err
  if (isMissingBinaryError(err, binary)) {
    return new PdfOptimizerError(
      'MISSING_BINARY',
      `Required tool not found: ${binary}. Install it (apk add poppler-utils tesseract-ocr ghostscript qpdf).`
    )
  }
  const message = err instanceof Error ? err.message : String(err)
  return new PdfOptimizerError(fallback, `${binary} failed: ${message}`)
}
