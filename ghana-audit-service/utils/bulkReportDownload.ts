/**
 * Bulk A-G report downloads: the limits and request format shared by the public
 * /reports page (composables/useReportBulkDownload.ts) and the server
 * (server/api/downloads/reports/bulk.get.ts, server/middleware/rateLimit.ts).
 *
 * Kept free of Nuxt/Nitro imports so both sides can use it.
 */

/**
 * `GET ?ids=3,7,12` streams those reports as one ZIP. Adding `&check=1` runs
 * the same validation and returns a JSON summary instead of the archive,
 * without spending any of the visitor's download allowance.
 */
export const BULK_REPORT_DOWNLOAD_PATH = '/api/downloads/reports/bulk'

/**
 * Most reports in one ZIP. Every file in a ZIP counts against the hourly
 * download limit (RATE_LIMITS.downloadHourly), so this must stay at or below
 * it or a full selection could never be downloaded.
 */
export const BULK_REPORT_MAX_FILES = 25

/**
 * Largest total a single ZIP may carry (1 GB). The archive is streamed and
 * cannot be resumed, so this bounds how much one dropped connection or pod
 * restart can waste. It also keeps the archive well inside the 4 GiB ceiling
 * of the plain (non-Zip64) format the server writes.
 */
export const BULK_REPORT_MAX_BYTES = 1024 * 1024 * 1024

/** Largest id MySQL's INT column can hold. */
const MAX_REPORT_ID = 2_147_483_647

/**
 * Parse the `ids` query value into unique report ids, keeping first-seen
 * order. Accepts a comma-separated string or repeated parameters. Returns null
 * for anything that is not 1..BULK_REPORT_MAX_FILES positive integers; one bad
 * token rejects the whole request rather than being dropped silently.
 */
export function parseBulkReportIds(raw: unknown): number[] | null {
  const tokens = (Array.isArray(raw) ? raw : [raw]).flatMap((value) =>
    typeof value === 'string' ? value.split(',') : [null]
  )

  const ids: number[] = []
  for (const token of tokens) {
    if (token === null || !/^\d{1,10}$/.test(token)) return null
    const id = Number(token)
    if (id < 1 || id > MAX_REPORT_ID) return null
    if (!ids.includes(id)) ids.push(id)
  }

  if (ids.length === 0 || ids.length > BULK_REPORT_MAX_FILES) return null
  return ids
}

/** True when the request only asks whether the download would succeed. */
export function isBulkCheck(raw: unknown): boolean {
  return raw === '1' || raw === 'true'
}

/** Build the download URL (or its `check` twin) for a set of report ids. */
export function bulkReportDownloadUrl(
  ids: ReadonlyArray<number | string>,
  options: { check?: boolean } = {}
): string {
  const url = `${BULK_REPORT_DOWNLOAD_PATH}?ids=${ids.join(',')}`
  return options.check ? `${url}&check=1` : url
}

/**
 * Convert the display size the public API returns for a report ("4.2 MB") back
 * to approximate bytes, for the running total shown while selecting. Returns
 * null for "N/A" and anything else unreadable; the server measures the real
 * files before a download starts.
 */
export function fileSizeLabelToBytes(label: string | null | undefined): number | null {
  const match = label?.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i)
  if (!match) return null

  const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }
  const bytes = Number(match[1]) * units[match[2].toUpperCase()]
  return Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : null
}

/** What the `check=1` request answers with: the download it would produce. */
export interface BulkReportDownloadSummary {
  /** Reports that will be in the archive. */
  count: number
  /** Combined size of those reports' files, in bytes. */
  totalBytes: number
  /** Exact size of the ZIP file, in bytes. */
  zipBytes: number
  fileName: string
  /** Requested ids left out: no longer published, or their file is missing. */
  unavailable: number[]
}
