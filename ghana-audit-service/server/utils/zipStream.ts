/**
 * Streaming ZIP writer for bulk downloads (server/api/downloads/reports/bulk).
 *
 * Why not a library: this needs exactly one thing, and needs it predictable.
 * Files are copied through untouched (PDFs are already compressed; deflating
 * them again burns CPU the pod shares with PDF optimization for ~0% gain), one
 * at a time, with nothing buffered or spooled to disk. Because nothing is
 * really compressed, the archive's exact size is known before the first byte
 * is sent, so the response can carry a Content-Length: browsers show real
 * progress and treat a cut-off transfer as a failed download instead of
 * saving a truncated archive.
 *
 * Format notes:
 * - Each file's CRC is only known once it has been streamed, so it goes in a
 *   data descriptor after the file (general-purpose flag bit 3).
 * - Entries are written as DEFLATE made only of "stored" blocks (raw bytes
 *   with a 5-byte header per 65,535 bytes) rather than method 0. Readers that
 *   walk the archive front to back (Java's ZipInputStream, used by many
 *   Android apps) reject method 0 combined with a data descriptor, because
 *   they cannot tell where the file ends; a DEFLATE stream marks its own end.
 *   Every unzip tool inflates stored blocks, and the size stays predictable.
 * - No Zip64: archives must stay under 4 GiB and 65,535 entries. Callers cap
 *   far below both (see utils/bulkReportDownload.ts).
 */

import { Readable } from 'node:stream'
import { crc32 } from 'node:zlib'

export interface ZipEntry {
  /** Path inside the archive, forward slashes only, unique per archive. */
  name: string
  /** Exact number of bytes `open()` will yield. A mismatch aborts the archive. */
  size: number
  /** Last-modified time recorded for the entry. Defaults to now. */
  modifiedAt?: Date
  /** Open the content. Called when the entry's turn comes, never earlier. */
  open: () => Promise<Readable> | Readable
}

export interface ZipStreamOptions {
  /** Called after each entry has been written out in full. */
  onEntryComplete?: (index: number) => void
}

const SIG_LOCAL_HEADER = 0x04034b50
const SIG_DATA_DESCRIPTOR = 0x08074b50
const SIG_CENTRAL_HEADER = 0x02014b50
const SIG_END_OF_DIRECTORY = 0x06054b50

const LOCAL_HEADER_BYTES = 30
const DATA_DESCRIPTOR_BYTES = 16
const CENTRAL_HEADER_BYTES = 46
const END_OF_DIRECTORY_BYTES = 22

const VERSION_NEEDED = 20 // 2.0: DEFLATE + data descriptors
const VERSION_MADE_BY = (3 << 8) | VERSION_NEEDED // host 3 = Unix, so the mode below applies
const FLAGS = 0x0008 | 0x0800 // data descriptor follows the data; names are UTF-8
const METHOD_DEFLATE = 8
const FILE_MODE = (0o100644 << 16) >>> 0 // regular file, rw-r--r--

const STORED_BLOCK_HEADER_BYTES = 5
const MAX_STORED_BLOCK = 0xffff
const MAX_ENTRIES = 0xfffe // 0xffff is the "see Zip64" marker
const MAX_ARCHIVE_BYTES = 0xfffffffe // likewise for 0xffffffff

interface PlannedEntry {
  source: ZipEntry
  name: Buffer
  deflatedSize: number
  dosTime: number
  dosDate: number
}

/** Bytes an entry of `size` occupies once framed as stored DEFLATE blocks. */
function deflatedSize(size: number): number {
  const blocks = Math.max(1, Math.ceil(size / MAX_STORED_BLOCK))
  return size + blocks * STORED_BLOCK_HEADER_BYTES
}

/** ZIP timestamps are MS-DOS format: 2-second resolution, years 1980-2107. */
function dosTimestamp(date: Date): { dosTime: number; dosDate: number } {
  const year = date.getUTCFullYear()
  if (Number.isNaN(year) || year < 1980) return { dosTime: 0, dosDate: (1 << 5) | 1 }
  if (year > 2107)
    return { dosTime: (23 << 11) | (59 << 5) | 29, dosDate: (127 << 9) | (12 << 5) | 31 }

  return {
    dosTime: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    dosDate: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()
  }
}

function planArchive(entries: ReadonlyArray<ZipEntry>): {
  plan: PlannedEntry[]
  totalBytes: number
} {
  if (entries.length > MAX_ENTRIES) {
    throw new RangeError(`A ZIP archive holds at most ${MAX_ENTRIES} entries`)
  }

  const seen = new Set<string>()
  const now = new Date()
  let totalBytes = END_OF_DIRECTORY_BYTES

  const plan = entries.map((source) => {
    const { name, size } = source
    if (
      !name ||
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').some((part) => part === '' || part === '.' || part === '..')
    ) {
      throw new RangeError(`Unsafe ZIP entry name: ${JSON.stringify(name)}`)
    }
    if (seen.has(name)) throw new RangeError(`Duplicate ZIP entry name: ${JSON.stringify(name)}`)
    seen.add(name)

    if (!Number.isSafeInteger(size) || size < 0) {
      throw new RangeError(`Invalid size for ZIP entry ${JSON.stringify(name)}`)
    }

    const encodedName = Buffer.from(name, 'utf8')
    if (encodedName.length > 0xffff) {
      throw new RangeError(`ZIP entry name too long: ${JSON.stringify(name)}`)
    }

    const planned: PlannedEntry = {
      source,
      name: encodedName,
      deflatedSize: deflatedSize(size),
      ...dosTimestamp(source.modifiedAt ?? now)
    }
    totalBytes +=
      LOCAL_HEADER_BYTES +
      encodedName.length +
      planned.deflatedSize +
      DATA_DESCRIPTOR_BYTES +
      CENTRAL_HEADER_BYTES +
      encodedName.length
    return planned
  })

  if (totalBytes > MAX_ARCHIVE_BYTES) {
    throw new RangeError('ZIP archive would exceed 4 GiB')
  }
  return { plan, totalBytes }
}

/**
 * Exact byte length of the archive `createZipStream()` produces for these
 * entries. Throws RangeError for unsafe names, duplicates or an archive beyond
 * the plain ZIP limits.
 */
export function zipArchiveSize(entries: ReadonlyArray<Pick<ZipEntry, 'name' | 'size'>>): number {
  return planArchive(entries as ReadonlyArray<ZipEntry>).totalBytes
}

function localHeader(entry: PlannedEntry): Buffer {
  const header = Buffer.alloc(LOCAL_HEADER_BYTES + entry.name.length)
  header.writeUInt32LE(SIG_LOCAL_HEADER, 0)
  header.writeUInt16LE(VERSION_NEEDED, 4)
  header.writeUInt16LE(FLAGS, 6)
  header.writeUInt16LE(METHOD_DEFLATE, 8)
  header.writeUInt16LE(entry.dosTime, 10)
  header.writeUInt16LE(entry.dosDate, 12)
  // CRC and both sizes stay zero here: they follow in the data descriptor.
  header.writeUInt16LE(entry.name.length, 26)
  entry.name.copy(header, LOCAL_HEADER_BYTES)
  return header
}

function storedBlockHeader(length: number, isLast: boolean): Buffer {
  const header = Buffer.alloc(STORED_BLOCK_HEADER_BYTES)
  header.writeUInt8(isLast ? 1 : 0, 0)
  header.writeUInt16LE(length, 1)
  header.writeUInt16LE(~length & 0xffff, 3)
  return header
}

function dataDescriptor(crc: number, entry: PlannedEntry): Buffer {
  const descriptor = Buffer.alloc(DATA_DESCRIPTOR_BYTES)
  descriptor.writeUInt32LE(SIG_DATA_DESCRIPTOR, 0)
  descriptor.writeUInt32LE(crc, 4)
  descriptor.writeUInt32LE(entry.deflatedSize, 8)
  descriptor.writeUInt32LE(entry.source.size, 12)
  return descriptor
}

function centralHeader(entry: PlannedEntry, crc: number, localHeaderOffset: number): Buffer {
  const header = Buffer.alloc(CENTRAL_HEADER_BYTES + entry.name.length)
  header.writeUInt32LE(SIG_CENTRAL_HEADER, 0)
  header.writeUInt16LE(VERSION_MADE_BY, 4)
  header.writeUInt16LE(VERSION_NEEDED, 6)
  header.writeUInt16LE(FLAGS, 8)
  header.writeUInt16LE(METHOD_DEFLATE, 10)
  header.writeUInt16LE(entry.dosTime, 12)
  header.writeUInt16LE(entry.dosDate, 14)
  header.writeUInt32LE(crc, 16)
  header.writeUInt32LE(entry.deflatedSize, 20)
  header.writeUInt32LE(entry.source.size, 24)
  header.writeUInt16LE(entry.name.length, 28)
  header.writeUInt32LE(FILE_MODE, 38)
  header.writeUInt32LE(localHeaderOffset, 42)
  entry.name.copy(header, CENTRAL_HEADER_BYTES)
  return header
}

function endOfDirectory(entryCount: number, directoryBytes: number, directoryOffset: number) {
  const end = Buffer.alloc(END_OF_DIRECTORY_BYTES)
  end.writeUInt32LE(SIG_END_OF_DIRECTORY, 0)
  end.writeUInt16LE(entryCount, 8)
  end.writeUInt16LE(entryCount, 10)
  end.writeUInt32LE(directoryBytes, 12)
  end.writeUInt32LE(directoryOffset, 16)
  return end
}

/**
 * Build a readable stream that emits `entries` as a ZIP archive, in order.
 *
 * Sources are opened one at a time, each only when the previous entry has been
 * written, so at most one is open however many entries there are. The stream
 * applies backpressure to the open source, and destroying it (client went
 * away) destroys that source too.
 *
 * The stream errors, leaving the archive deliberately incomplete, if a source
 * fails or yields a different number of bytes than its entry declared.
 */
export function createZipStream(
  entries: ReadonlyArray<ZipEntry>,
  options: ZipStreamOptions = {}
): Readable {
  const { plan } = planArchive(entries)
  // Held in an object so the teardown hook below sees what the generator set.
  const open: { source: Readable | null } = { source: null }

  async function* archive(): AsyncGenerator<Buffer> {
    const directory: Buffer[] = []
    let offset = 0

    for (const [index, entry] of plan.entries()) {
      const { name, size } = entry.source
      const header = localHeader(entry)
      yield header

      let crc = 0
      let remaining = size // bytes of this file not yet written
      let blockRemaining = 0 // bytes left in the stored block being written

      const source = await entry.source.open()
      open.source = source
      try {
        for await (const chunk of source) {
          const data: Buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
          if (data.length === 0) continue
          if (data.length > remaining) {
            throw new Error(`ZIP entry "${name}" is larger than its declared ${size} bytes`)
          }
          crc = crc32(data, crc)

          // Slice the chunk across stored-block boundaries, adding a block
          // header wherever a new block starts.
          const parts: Buffer[] = []
          let position = 0
          while (position < data.length) {
            if (blockRemaining === 0) {
              blockRemaining = Math.min(MAX_STORED_BLOCK, remaining)
              parts.push(storedBlockHeader(blockRemaining, blockRemaining === remaining))
            }
            const take = Math.min(blockRemaining, data.length - position)
            parts.push(data.subarray(position, position + take))
            position += take
            blockRemaining -= take
            remaining -= take
          }
          yield parts.length === 1 ? parts[0] : Buffer.concat(parts)
        }
      } finally {
        open.source = null
        source.destroy()
      }

      if (remaining !== 0) {
        throw new Error(
          `ZIP entry "${name}" ended ${remaining} bytes short of its declared ${size}`
        )
      }
      // A DEFLATE stream needs at least one block, even for an empty file.
      if (size === 0) yield storedBlockHeader(0, true)

      yield dataDescriptor(crc, entry)
      directory.push(centralHeader(entry, crc, offset))
      offset += header.length + entry.deflatedSize + DATA_DESCRIPTOR_BYTES
      options.onEntryComplete?.(index)
    }

    const directoryBytes = Buffer.concat(directory)
    yield directoryBytes
    yield endOfDirectory(plan.length, directoryBytes.length, offset)
  }

  const stream = Readable.from(archive(), { objectMode: false, highWaterMark: 256 * 1024 })

  // Readable.from() cleans up by asking the generator to return, but a
  // generator that is waiting on its source cannot answer until that source
  // produces something. Destroy the open source first so teardown is immediate
  // even when storage has stalled.
  const destroyArchive = stream._destroy.bind(stream)
  stream._destroy = (error, callback) => {
    open.source?.destroy()
    destroyArchive(error, callback)
  }

  return stream
}
