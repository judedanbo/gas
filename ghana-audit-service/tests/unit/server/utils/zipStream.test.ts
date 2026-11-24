import { describe, it, expect, vi } from 'vitest'
import { Readable } from 'node:stream'
import { crc32 } from 'node:zlib'
import { createZipStream, zipArchiveSize, type ZipEntry } from '~/server/utils/zipStream'
import { readZip } from '../../../helpers/zip'

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** Deterministic, incompressible-looking bytes. */
function bytes(length: number, seed = 1): Buffer {
  const out = Buffer.alloc(length)
  let state = seed
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    out[i] = state & 0xff
  }
  return out
}

function entry(name: string, data: Buffer, chunkSize = 16_384): ZipEntry {
  return {
    name,
    size: data.length,
    modifiedAt: new Date('2024-03-05T14:07:58Z'),
    open: () =>
      Readable.from(
        (function* () {
          for (let at = 0; at < data.length; at += chunkSize) {
            yield data.subarray(at, at + chunkSize)
          }
        })(),
        { objectMode: false }
      )
  }
}

describe('createZipStream', () => {
  it('writes an archive every entry can be read back from, byte for byte', async () => {
    // Sizes around the 65,535-byte stored-block boundary, where framing bugs live.
    const files = [
      { name: 'empty.pdf', data: Buffer.alloc(0) },
      { name: 'tiny.pdf', data: bytes(13, 2) },
      { name: 'one-block.pdf', data: bytes(65_535, 3) },
      { name: 'one-over.pdf', data: bytes(65_536, 4) },
      { name: 'two-blocks.pdf', data: bytes(131_070, 5) },
      { name: 'nested/amanneɛbɔ.pdf', data: bytes(300_001, 6) }
    ]
    const chunkSizes = [1, 7, 65_535, 100_000, 16_384, 70_001]

    const zip = await collect(
      createZipStream(files.map((f, i) => entry(f.name, f.data, chunkSizes[i])))
    )
    const parsed = readZip(zip)

    expect(parsed.map((e) => e.name)).toEqual(files.map((f) => f.name))
    parsed.forEach((e, i) => {
      expect(e.data.equals(files[i].data)).toBe(true)
      expect(e.size).toBe(files[i].data.length)
      expect(e.crc).toBe(crc32(files[i].data))
      // DEFLATE + data descriptor + UTF-8 names: readable front to back too.
      expect(e.method).toBe(8)
      expect(e.flags).toBe(0x0808)
    })
  })

  it('produces exactly the size zipArchiveSize() predicted', async () => {
    const entries = [
      entry('a.pdf', bytes(0)),
      entry('b.pdf', bytes(65_535)),
      entry('c.pdf', bytes(200_000))
    ]

    const zip = await collect(createZipStream(entries))

    expect(zip.length).toBe(zipArchiveSize(entries))
  })

  it('adds almost nothing to the files it carries', () => {
    const size = 50 * 1024 * 1024
    const overhead = zipArchiveSize([{ name: 'report.pdf', size }]) - size

    expect(overhead).toBeLessThan(size * 0.0002)
  })

  it('opens sources one at a time, each only when its turn comes', async () => {
    let open = 0
    let mostOpenAtOnce = 0
    const tracked = (name: string): ZipEntry => {
      const data = bytes(40_000)
      return {
        name,
        size: data.length,
        open: () => {
          open++
          mostOpenAtOnce = Math.max(mostOpenAtOnce, open)
          const source = Readable.from([data], { objectMode: false })
          source.once('close', () => open--)
          return source
        }
      }
    }

    await collect(createZipStream([tracked('a.pdf'), tracked('b.pdf'), tracked('c.pdf')]))

    expect(mostOpenAtOnce).toBe(1)
    expect(open).toBe(0)
  })

  it('reports each entry as it completes, in order', async () => {
    const done: number[] = []

    await collect(
      createZipStream([entry('a.pdf', bytes(10)), entry('b.pdf', bytes(20))], {
        onEntryComplete: (index) => done.push(index)
      })
    )

    expect(done).toEqual([0, 1])
  })

  it('fails rather than finish an archive whose file came up short', async () => {
    const short = { ...entry('short.pdf', bytes(100)), size: 150 }

    await expect(collect(createZipStream([short]))).rejects.toThrow(/50 bytes short/)
  })

  it('fails when a file yields more than it declared', async () => {
    const long = { ...entry('long.pdf', bytes(100)), size: 60 }

    await expect(collect(createZipStream([long]))).rejects.toThrow(/larger than its declared/)
  })

  it('fails when a source cannot be opened or breaks part-way', async () => {
    const missing: ZipEntry = {
      name: 'missing.pdf',
      size: 10,
      open: async () => {
        throw new Error('blob gone')
      }
    }
    const broken: ZipEntry = {
      name: 'broken.pdf',
      size: 10,
      open: () =>
        new Readable({
          read() {
            this.destroy(new Error('connection reset'))
          }
        })
    }

    await expect(collect(createZipStream([missing]))).rejects.toThrow('blob gone')
    await expect(collect(createZipStream([broken]))).rejects.toThrow('connection reset')
  })

  it('closes the open source at once when the archive is abandoned', async () => {
    // A source that delivers one chunk and then stalls, like storage hanging
    // after the visitor has already cancelled the download.
    const stalled = new Readable({ read() {} })
    stalled.push(bytes(1_000))
    const never = vi.fn(() => Readable.from([bytes(5)], { objectMode: false }))

    const archive = createZipStream([
      { name: 'stalled.pdf', size: 5_000, open: () => stalled },
      { name: 'never.pdf', size: 5, open: never }
    ])
    archive.on('error', () => {})
    await new Promise<void>((resolve) => {
      archive.on('data', () => {
        // The archive is now waiting on the stalled source for more.
        if (stalled.readableLength === 0) resolve()
      })
    })

    archive.destroy()
    await new Promise((resolve) => archive.once('close', resolve))

    expect(stalled.destroyed).toBe(true)
    expect(never).not.toHaveBeenCalled()
  })
})

describe('zipArchiveSize', () => {
  it.each([
    ['an absolute path', '/etc/passwd'],
    ['a parent-directory segment', 'reports/../../secret.pdf'],
    ['a backslash', 'reports\\x.pdf'],
    ['an empty segment', 'reports//x.pdf'],
    ['an empty name', '']
  ])('rejects %s as an entry name', (_label, name) => {
    expect(() => zipArchiveSize([{ name, size: 1 }])).toThrow(RangeError)
  })

  it('rejects duplicate names, which would overwrite each other on extraction', () => {
    expect(() =>
      zipArchiveSize([
        { name: 'report.pdf', size: 1 },
        { name: 'report.pdf', size: 2 }
      ])
    ).toThrow(/Duplicate/)
  })

  it('rejects an archive too large for the plain ZIP format', () => {
    const twoGiB = 2 * 1024 ** 3

    expect(() =>
      zipArchiveSize([
        { name: 'a.pdf', size: twoGiB },
        { name: 'b.pdf', size: twoGiB }
      ])
    ).toThrow(/4 GiB/)
  })

  it('rejects sizes that are not whole, non-negative numbers', () => {
    expect(() => zipArchiveSize([{ name: 'a.pdf', size: -1 }])).toThrow(RangeError)
    expect(() => zipArchiveSize([{ name: 'a.pdf', size: 1.5 }])).toThrow(RangeError)
  })
})
