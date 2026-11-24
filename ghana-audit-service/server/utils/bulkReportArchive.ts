import { extname } from 'node:path'
import { resolveDownloadSource, type DownloadSource } from './downloadSource'

export interface BulkReportRow {
  id: number
  slug: string
  fileUrl: string | null
  updatedAt: Date | string | null
}

/** A report whose file was found in storage, ready to be added to an archive. */
export interface BulkReportFile extends DownloadSource {
  id: number
  slug: string
  /** File name inside the archive. */
  name: string
  modifiedAt: Date | undefined
}

/**
 * File name for a report inside the archive: its slug plus the stored file's
 * extension, matching what the single-file download calls it. Slugs are
 * unique and URL-safe already; the clean-up and the numeric suffix only
 * guarantee the name stays a single, distinct path segment whatever is in the
 * database.
 */
export function archiveEntryName(slug: string, fileUrl: string | null, taken: Set<string>): string {
  const storedExtension = fileUrl ? extname(fileUrl.split(/[?#]/)[0]).toLowerCase() : ''
  const extension = /^\.[a-z0-9]{1,8}$/.test(storedExtension) ? storedExtension : '.pdf'
  const base =
    slug
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 180) || 'report'

  let name = `${base}${extension}`
  for (let copy = 2; taken.has(name.toLowerCase()); copy++) {
    name = `${base}-${copy}${extension}`
  }
  // Compared case-insensitively: Windows and macOS would otherwise overwrite
  // one file with another on extraction.
  taken.add(name.toLowerCase())
  return name
}

/**
 * Look up each report's file and keep the ones that exist, in the order
 * given. Reports whose file is in neither Blob storage nor on disk are left
 * out (the caller reports them); a storage failure throws.
 */
export async function resolveBulkReportFiles(rows: BulkReportRow[]): Promise<BulkReportFile[]> {
  const sources = await Promise.all(rows.map((row) => resolveDownloadSource(row.fileUrl)))

  const taken = new Set<string>()
  const files: BulkReportFile[] = []
  rows.forEach((row, index) => {
    const source = sources[index]
    if (!source) return

    const modifiedAt = row.updatedAt ? new Date(row.updatedAt) : undefined
    files.push({
      ...source,
      id: row.id,
      slug: row.slug,
      name: archiveEntryName(row.slug, row.fileUrl, taken),
      modifiedAt: modifiedAt && !Number.isNaN(modifiedAt.getTime()) ? modifiedAt : undefined
    })
  })
  return files
}

/** Name the browser saves the archive under, dated so repeat downloads differ. */
export function bulkArchiveFileName(now: Date = new Date()): string {
  return `auditor-general-reports-${now.toISOString().slice(0, 10)}.zip`
}
