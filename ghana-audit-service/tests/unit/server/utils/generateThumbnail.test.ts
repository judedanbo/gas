import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  execFile,
  type ChildProcess,
  type ExecException,
  type ExecFileOptions
} from 'node:child_process'
import { isBlobStorageConfigured, uploadBlobFromFile } from '~/server/utils/blobStorage'
import { generateThumbnailFromPdf } from '~/server/utils/generateThumbnail'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  const execFileMock = vi.fn()
  // Register the mock on both the named export and default-interop shape so it
  // is hit regardless of how the transpiled import reads the CJS builtin.
  return {
    ...actual,
    execFile: execFileMock,
    default: { ...actual, execFile: execFileMock }
  }
})

vi.mock('~/server/utils/blobStorage', () => ({
  isBlobStorageConfigured: vi.fn(() => false),
  uploadBlobFromFile: vi.fn(async () => undefined)
}))

interface PdftoppmRun {
  args: readonly string[]
  options: ExecFileOptions
  /** Ends the render: null for a clean exit, an error for a failure or kill. */
  exit: (err: Error | null) => void
}

// Fake pdftoppm process. The module promisifies execFile, so the mock gets a
// node-style callback last; `run` decides when and how the render ends.
function mockPdftoppm(run: (render: PdftoppmRun) => void): void {
  vi.mocked(execFile).mockImplementation((_cmd, args, options, callback) => {
    run({
      args: args ?? [],
      options: options ?? {},
      exit: (err) => callback?.(err as ExecException | null, '', '')
    })
    return {} as ChildProcess
  })
}

// Writes the expected output file next to the prefix it is given, imitating
// the real renderer.
function mockPdftoppmSuccess(): void {
  mockPdftoppm(({ args, exit }) => {
    writeFileSync(`${args[args.length - 1]}.jpg`, 'jpeg-bytes')
    exit(null)
  })
}

// The tmpdir JPEG pdftoppm was told to write (its last argument is the prefix).
function renderedTempJpg(): string {
  const args = vi.mocked(execFile).mock.calls[0]?.[1]
  if (!args) throw new Error('pdftoppm was never started')
  return `${args[args.length - 1]}.jpg`
}

describe('generateThumbnailFromPdf', () => {
  let workDir: string
  let pdfPath: string

  beforeEach(() => {
    vi.clearAllMocks()
    workDir = mkdtempSync(join(tmpdir(), 'gas-thumb-test-'))
    pdfPath = join(workDir, 'input.pdf')
    writeFileSync(pdfPath, '%PDF-1.4')
  })

  afterEach(() => {
    // Back to the mock factories' defaults and the real process.cwd.
    vi.restoreAllMocks()
    rmSync(workDir, { recursive: true, force: true })
  })

  it('returns null when the source PDF does not exist', async () => {
    await expect(generateThumbnailFromPdf(join(workDir, 'missing.pdf'))).resolves.toBeNull()
    expect(vi.mocked(execFile)).not.toHaveBeenCalled()
  })

  it('renders page 1 with the async execFile and a 30s timeout', async () => {
    vi.mocked(isBlobStorageConfigured).mockReturnValue(true)
    mockPdftoppmSuccess()

    await expect(generateThumbnailFromPdf(pdfPath)).resolves.toMatch(/^\/uploads\/thumbnails\//)

    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'pdftoppm',
      [
        '-jpeg',
        '-singlefile',
        '-f',
        '1',
        '-scale-to',
        '600',
        '-jpegopt',
        'quality=85',
        pdfPath,
        expect.stringContaining(join(tmpdir(), 'gas-thumb-'))
      ],
      expect.objectContaining({ timeout: 30_000 }),
      expect.any(Function)
    )
  })

  it('returns null when pdftoppm fails, removing any partial render', async () => {
    mockPdftoppm(({ args, exit }) => {
      // Killed by the timeout part-way through writing its output.
      writeFileSync(`${args[args.length - 1]}.jpg`, 'partial')
      exit(Object.assign(new Error('Command failed: pdftoppm'), { killed: true }))
    })

    await expect(generateThumbnailFromPdf(pdfPath)).resolves.toBeNull()
    expect(existsSync(renderedTempJpg())).toBe(false)
    expect(vi.mocked(uploadBlobFromFile)).not.toHaveBeenCalled()
  })

  it('kills the render and resolves null when the signal aborts', async () => {
    const controller = new AbortController()
    mockPdftoppm(({ args, options, exit }) => {
      writeFileSync(`${args[args.length - 1]}.jpg`, 'partial')
      // Like execFile: an abort kills the child and fails with an AbortError.
      options.signal?.addEventListener('abort', () =>
        exit(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
      )
    })

    const pending = generateThumbnailFromPdf(pdfPath, { signal: controller.signal })
    expect(vi.mocked(execFile).mock.calls[0]?.[2]?.signal).toBe(controller.signal)
    controller.abort()

    await expect(pending).resolves.toBeNull()
    expect(existsSync(renderedTempJpg())).toBe(false)
    expect(vi.mocked(uploadBlobFromFile)).not.toHaveBeenCalled()
  })

  it('does not start pdftoppm when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    // Fails fast instead of hanging if the guard ever lets the render start.
    mockPdftoppm(({ exit }) => exit(new Error('pdftoppm should not have started')))

    await expect(
      generateThumbnailFromPdf(pdfPath, { signal: controller.signal })
    ).resolves.toBeNull()
    expect(vi.mocked(execFile)).not.toHaveBeenCalled()
  })

  it('uploads to Blob and removes the temp render when Blob is configured', async () => {
    vi.mocked(isBlobStorageConfigured).mockReturnValue(true)
    mockPdftoppmSuccess()

    const url = await generateThumbnailFromPdf(pdfPath)

    expect(url).toMatch(/^\/uploads\/thumbnails\/\d{8}-[0-9a-f-]+\.jpg$/)
    // Uploaded by temp-file path (streamed), not as an in-memory Buffer.
    expect(vi.mocked(uploadBlobFromFile)).toHaveBeenCalledWith(
      `uploads/thumbnails/${url!.split('/').pop()}`,
      renderedTempJpg(),
      'image/jpeg'
    )
    // The tmpdir render must not linger after upload.
    expect(existsSync(renderedTempJpg())).toBe(false)
  })

  it('writes to <cwd>/public/uploads/thumbnails when Blob is not configured', async () => {
    vi.mocked(isBlobStorageConfigured).mockReturnValue(false)
    vi.spyOn(process, 'cwd').mockReturnValue(workDir)
    mockPdftoppmSuccess()

    const url = await generateThumbnailFromPdf(pdfPath)

    expect(url).toMatch(/^\/uploads\/thumbnails\//)
    expect(existsSync(join(workDir, 'public/uploads/thumbnails', url!.split('/').pop()!))).toBe(
      true
    )
    expect(existsSync(renderedTempJpg())).toBe(false)
    expect(vi.mocked(uploadBlobFromFile)).not.toHaveBeenCalled()
  })

  it('returns null when the Blob upload fails', async () => {
    vi.mocked(isBlobStorageConfigured).mockReturnValue(true)
    vi.mocked(uploadBlobFromFile).mockRejectedValue(new Error('azure down'))
    mockPdftoppmSuccess()

    await expect(generateThumbnailFromPdf(pdfPath)).resolves.toBeNull()
  })
})
