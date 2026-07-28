/**
 * The audit_reports.file_size column is varchar(50) and holds mixed data:
 * - raw byte counts as strings (e.g. "74285320") — written by admin uploads
 *   (validation coerces to number, MySQL stringifies on store)
 * - legacy pre-formatted labels (e.g. "4.2 MB") — imported by the crawlers
 *
 * The admin API contract (types/admin.ts) promises `fileSize: number | null`,
 * so admin read paths must convert through this helper before returning.
 * The public API is unaffected — it formats for display via
 * transformReport.ts formatFileSize(), which accepts both shapes.
 */
export function fileSizeToBytes(size: string | null): number | null {
  if (!size) return null

  const trimmed = size.trim()

  // Raw byte count, e.g. "74285320"
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const bytes = Number(trimmed)
    return Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : null
  }

  // Legacy pre-formatted label, e.g. "4.2 MB" — convert back to approximate
  // bytes so older crawler-imported reports still show a size in admin.
  const match = trimmed.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i)
  if (match) {
    const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }
    const bytes = Number(match[1]) * units[match[2].toUpperCase()]
    return Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : null
  }

  return null
}
