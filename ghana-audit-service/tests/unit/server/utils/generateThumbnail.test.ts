import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { isBlobStorageConfigured, uploadBlob } from '~/server/utils/blobStorage'
import { generateThumbnailFromPdf } from '~/server/utils/generateThumbnail'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  const execFileSyncMock = vi.fn()
  // Register the mock on both the named export and default-interop shape so it
  // is hit regardless of how the transpiled import reads the CJS builtin.
  return {
    ...actual,
    execFileSync: execFileSyncMock,
    default: { ...actual, execFileSync: execFileSyncMock }
  }
})

vi.mock('~/server/utils/blobStorage', () => ({
  isBlobStorageConfigured: vi.fn(() => false),
  uploadBlob: vi.fn(async () => undefined)
}))

// The pdftoppm mock writes the expected output file next to the prefix it is
// given, imitating the real renderer.
function mockPdftoppmSuccess(): void {
  vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
    const list = args as string[]
    writeFileSync(`${list[list.length - 1]}.jpg`, 'jpeg-bytes')
    return Buffer.from('')
  })
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
    rmSync(workDir, { recursive: true, force: true })
  })

  it('returns null when the source PDF does not exist', async () => {
    await expect(generateThumbnailFromPdf(join(workDir, 'missing.pdf'))).resolves.toBeNull()
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
  })

  it('returns null when pdftoppm fails', async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('pdftoppm not installed')
    })
    await expect(generateThumbnailFromPdf(pdfPath)).resolves.toBeNull()
  })

  it('uploads to Blob and removes the temp render when Blob is configured', async () => {
    vi.mocked(isBlobStorageConfigured).mockReturnValue(true)
    mockPdftoppmSuccess()

    const url = await generateThumbnailFromPdf(pdfPath)

    expect(url).toMatch(/^\/uploads\/thumbnails\/\d{8}-[0-9a-f-]+\.jpg$/)
    expect(vi.mocked(uploadBlob)).toHaveBeenCalledWith(
      `uploads/thumbnails/${url!.split('/').pop()}`,
      expect.anything(),
      'image/jpeg'
    )
    // The tmpdir render must not linger after upload.
    const leftovers = readdirSync(tmpdir()).filter((f) => url!.includes(f.replace('.jpg', '')))
    expect(leftovers).toEqual([])
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
    expect(vi.mocked(uploadBlob)).not.toHaveBeenCalled()
  })

  it('returns null when the Blob upload fails', async () => {
    vi.mocked(isBlobStorageConfigured).mockReturnValue(true)
    vi.mocked(uploadBlob).mockRejectedValue(new Error('azure down'))
    mockPdftoppmSuccess()

    await expect(generateThumbnailFromPdf(pdfPath)).resolves.toBeNull()
  })
})
