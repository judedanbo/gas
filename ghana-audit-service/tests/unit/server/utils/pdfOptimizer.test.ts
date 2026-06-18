import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  optimizeReportPdf,
  PdfOptimizerError,
  __setExecRunnerForTests,
  type ExecResult
} from '~/server/utils/pdfOptimizer'

// Each matcher consumes one execFile call in order. Handlers can throw, are
// responsible for writing any files the real binary would have produced, and
// can return either an ExecResult or a Promise<ExecResult>.
type Matcher = (bin: string, args: string[]) => ExecResult | Promise<ExecResult>

let queue: Matcher[] = []
let workDirs: string[] = []

function programExec(matchers: Matcher[]) {
  queue = matchers
}

function trackTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gas-pdftest-'))
  workDirs.push(dir)
  return dir
}

beforeEach(() => {
  queue = []
  workDirs = []
  __setExecRunnerForTests(async (bin, args) => {
    const handler = queue.shift()
    if (!handler) {
      throw new Error(`Unexpected execFile call: ${bin} ${args.join(' ')}`)
    }
    const res = await handler(bin, args)
    return { stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
  })
})

afterEach(() => {
  __setExecRunnerForTests(null)
  for (const d of workDirs) {
    rmSync(d, { recursive: true, force: true })
  }
})

function makeInputPdf(size = 1024): string {
  const dir = trackTmp()
  const file = join(dir, 'in.pdf')
  // Bytes don't matter — we never call the real toolchain.
  writeFileSync(file, Buffer.alloc(size, 0x25))
  return file
}

function pdfinfoResult(pages: number): string {
  return [
    'Creator:        test',
    'Producer:       test',
    `Pages:          ${pages}`,
    'Page size:      612 x 792 pts'
  ].join('\n')
}

// qpdf --json=2 --json-key=outlines output. A non-empty `outlines` array means
// the document has bookmarks.
function qpdfOutlines(count = 0): string {
  return JSON.stringify({
    version: 2,
    outlines: Array.from({ length: count }, (_, i) => ({ title: `Item ${i + 1}` }))
  })
}

function writeSplitPages(outDir: string, pages: number) {
  mkdirSync(outDir, { recursive: true })
  for (let i = 1; i <= pages; i++) {
    writeFileSync(join(outDir, `page-${i}.pdf`), `PAGE-${i}`)
  }
}

describe('optimizeReportPdf', () => {
  it('rejects when the input file does not exist', async () => {
    await expect(optimizeReportPdf('/tmp/does-not-exist-12345.pdf')).rejects.toBeInstanceOf(
      PdfOptimizerError
    )
  })

  it('rejects with HAS_BOOKMARKS when the source PDF has bookmarks (default)', async () => {
    const input = makeInputPdf()
    programExec([
      () => ({ stdout: pdfinfoResult(3), stderr: '' }),
      // qpdf outlines → 2 bookmarks present
      () => ({ stdout: qpdfOutlines(2), stderr: '' })
    ])
    await expect(optimizeReportPdf(input)).rejects.toMatchObject({
      code: 'HAS_BOOKMARKS'
    })
  })

  it('reports MISSING_BINARY when qpdf is not installed', async () => {
    const input = makeInputPdf()
    programExec([
      () => ({ stdout: pdfinfoResult(2), stderr: '' }),
      // qpdf outlines (first qpdf call) → ENOENT
      () => {
        const err = Object.assign(new Error('spawn qpdf ENOENT'), {
          code: 'ENOENT',
          path: 'qpdf'
        })
        throw err
      }
    ])
    await expect(optimizeReportPdf(input)).rejects.toMatchObject({
      code: 'MISSING_BINARY'
    })
  })

  it('treats a fully-native PDF as native and skips OCR', async () => {
    const input = makeInputPdf(2048)

    programExec([
      // 1. pdfinfo (2 pages)
      () => ({ stdout: pdfinfoResult(2), stderr: '' }),
      // 2. qpdf outlines → none
      () => ({ stdout: qpdfOutlines(0), stderr: '' }),
      // 3. qpdf split -> emulate by writing both pages
      (_bin, args) => {
        const outPattern = args[args.length - 1]
        const outDir = outPattern.replace(/[\\/]page-%d\.pdf$/, '')
        writeSplitPages(outDir, 2)
        return { stdout: '', stderr: '' }
      },
      // 4. classify page 2: pdftotext returns plenty of text → native
      () => ({
        stdout: 'Lorem ipsum dolor sit amet consectetur adipiscing elit.',
        stderr: ''
      }),
      // 5. qpdf concat -> emulate writing combined.pdf
      (_b, args) => {
        const out = args[args.length - 1]
        writeFileSync(out, Buffer.alloc(1500, 0x21))
        return { stdout: '', stderr: '' }
      },
      // 6. gs -> write a smaller optimized.pdf
      (_b, args) => {
        const outArg = args.find((a) => a.startsWith('-sOutputFile='))!
        const out = outArg.replace('-sOutputFile=', '')
        writeFileSync(out, Buffer.alloc(800, 0x21))
        return { stdout: '', stderr: '' }
      },
      // 7. pdfinfo sanity check on optimized.pdf
      () => ({ stdout: pdfinfoResult(2), stderr: '' })
    ])

    const events: string[] = []
    const result = await optimizeReportPdf(input, {
      onProgress: (e) => events.push(`${e.phase}:${'kind' in e ? e.kind : ''}`)
    })

    expect(result.pageCount).toBe(2)
    expect(result.scannedPages).toBe(0)
    expect(result.nativePages).toBe(2) // cover + 1 body page
    expect(result.nativePages + result.scannedPages).toBe(result.pageCount)
    expect(result.optimizedSize).toBeLessThan(result.originalSize)
    expect(result.skippedCompression).toBe(false)
    expect(events).toContain('classify:native')
    expect(events.some((e) => e.startsWith('ocr:'))).toBe(false)
  })

  it('OCRs a scanned page (no text, no fonts, has images)', async () => {
    const input = makeInputPdf(4096)

    programExec([
      () => ({ stdout: pdfinfoResult(2), stderr: '' }),
      () => ({ stdout: qpdfOutlines(0), stderr: '' }),
      (_b, args) => {
        const outDir = args[args.length - 1].replace(/[\\/]page-%d\.pdf$/, '')
        writeSplitPages(outDir, 2)
        return { stdout: '', stderr: '' }
      },
      // classify page 2: pdftotext → empty
      () => ({ stdout: '', stderr: '' }),
      // classify page 2: pdffonts → header only
      () => ({
        stdout: 'name type encoding emb sub uni object ID\n--- --- --- --- --- --- ---',
        stderr: ''
      }),
      // classify page 2: pdfimages → 1 image row
      () => ({
        stdout:
          'page num  type  width height\n--- ---  ---  ----- ------\n   2   0 image  2480  3508',
        stderr: ''
      }),
      // ocr page 2: pdftoppm → write .pgm
      (_b, args) => {
        const prefix = args[args.length - 1]
        const renderDir = prefix.substring(0, prefix.lastIndexOf('/'))
        const base = prefix.substring(prefix.lastIndexOf('/') + 1)
        mkdirSync(renderDir, { recursive: true })
        writeFileSync(join(renderDir, `${base}-1.pgm`), 'P5\n')
        return { stdout: '', stderr: '' }
      },
      // ocr page 2: tesseract → write {prefix}.pdf
      (_b, args) => {
        const prefix = args[1]
        writeFileSync(`${prefix}.pdf`, Buffer.alloc(256, 0xff))
        return { stdout: '', stderr: '' }
      },
      // qpdf merge
      (_b, args) => {
        writeFileSync(args[args.length - 1], Buffer.alloc(2000, 0x22))
        return { stdout: '', stderr: '' }
      },
      // gs → smaller
      (_b, args) => {
        const out = args.find((a) => a.startsWith('-sOutputFile='))!.replace('-sOutputFile=', '')
        writeFileSync(out, Buffer.alloc(1024, 0x22))
        return { stdout: '', stderr: '' }
      },
      () => ({ stdout: pdfinfoResult(2), stderr: '' })
    ])

    const result = await optimizeReportPdf(input)

    expect(result.scannedPages).toBe(1)
    expect(result.nativePages).toBe(1) // cover page (preserved) counts as native
    expect(result.nativePages + result.scannedPages).toBe(result.pageCount)
    expect(result.optimizedSize).toBeLessThan(result.originalSize)
  })

  it('keeps the original when Ghostscript output grows the file', async () => {
    const input = makeInputPdf(1024)

    programExec([
      () => ({ stdout: pdfinfoResult(2), stderr: '' }),
      () => ({ stdout: qpdfOutlines(0), stderr: '' }),
      (_b, args) => {
        const outDir = args[args.length - 1].replace(/[\\/]page-%d\.pdf$/, '')
        writeSplitPages(outDir, 2)
        return { stdout: '', stderr: '' }
      },
      () => ({
        stdout: 'Plenty of vector text here for the classifier to call native.',
        stderr: ''
      }),
      (_b, args) => {
        writeFileSync(args[args.length - 1], Buffer.alloc(900, 0x21))
        return { stdout: '', stderr: '' }
      },
      (_b, args) => {
        const out = args.find((a) => a.startsWith('-sOutputFile='))!.replace('-sOutputFile=', '')
        writeFileSync(out, Buffer.alloc(2048, 0x21))
        return { stdout: '', stderr: '' }
      },
      () => ({ stdout: pdfinfoResult(2), stderr: '' })
    ])

    const result = await optimizeReportPdf(input)
    expect(result.skippedCompression).toBe(true)
    expect(result.optimizedSize).toBe(result.originalSize)
    expect(result.savedBytes).toBe(0)
    // Original file should still be on disk untouched.
    expect(existsSync(input)).toBe(true)
    const stat = await fs.stat(input)
    expect(stat.size).toBe(1024)
  })

  it('aborts when gs returns a different page count (sanity check)', async () => {
    const input = makeInputPdf(2048)
    programExec([
      () => ({ stdout: pdfinfoResult(3), stderr: '' }),
      () => ({ stdout: qpdfOutlines(0), stderr: '' }),
      (_b, args) => {
        const outDir = args[args.length - 1].replace(/[\\/]page-%d\.pdf$/, '')
        writeSplitPages(outDir, 3)
        return { stdout: '', stderr: '' }
      },
      () => ({ stdout: 'Long enough text to call native.', stderr: '' }),
      () => ({ stdout: 'Long enough text to call native.', stderr: '' }),
      (_b, args) => {
        writeFileSync(args[args.length - 1], Buffer.alloc(900, 0x21))
        return { stdout: '', stderr: '' }
      },
      (_b, args) => {
        const out = args.find((a) => a.startsWith('-sOutputFile='))!.replace('-sOutputFile=', '')
        writeFileSync(out, Buffer.alloc(800, 0x22))
        return { stdout: '', stderr: '' }
      },
      // pdfinfo sanity → wrong page count (2 instead of 3)
      () => ({ stdout: pdfinfoResult(2), stderr: '' })
    ])

    await expect(optimizeReportPdf(input)).rejects.toMatchObject({
      code: 'PAGE_COUNT_MISMATCH'
    })
  })

  it('allows optimization to proceed when allowDropBookmarks is set', async () => {
    const input = makeInputPdf(1024)

    programExec([
      () => ({ stdout: pdfinfoResult(2), stderr: '' }),
      // qpdf outlines → bookmarks present, but allowDropBookmarks overrides
      () => ({ stdout: qpdfOutlines(2), stderr: '' }),
      (_b, args) => {
        const outDir = args[args.length - 1].replace(/[\\/]page-%d\.pdf$/, '')
        writeSplitPages(outDir, 2)
        return { stdout: '', stderr: '' }
      },
      () => ({ stdout: 'enough text to call native here.', stderr: '' }),
      (_b, args) => {
        writeFileSync(args[args.length - 1], Buffer.alloc(800, 0x21))
        return { stdout: '', stderr: '' }
      },
      (_b, args) => {
        const out = args.find((a) => a.startsWith('-sOutputFile='))!.replace('-sOutputFile=', '')
        writeFileSync(out, Buffer.alloc(500, 0x21))
        return { stdout: '', stderr: '' }
      },
      () => ({ stdout: pdfinfoResult(2), stderr: '' })
    ])

    const result = await optimizeReportPdf(input, { allowDropBookmarks: true })
    expect(result.optimizedSize).toBeLessThan(result.originalSize)
  })
})
