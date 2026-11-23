import type { AuditReport } from '~/types'
import {
  BULK_REPORT_MAX_BYTES,
  BULK_REPORT_MAX_FILES,
  bulkReportDownloadUrl,
  fileSizeLabelToBytes,
  type BulkReportDownloadSummary
} from '~/utils/bulkReportDownload'

export interface SelectedReport {
  id: string
  title: string
  /** Approximate size taken from the listing; null when the listing has none. */
  bytes: number | null
}

export type BulkDownloadError =
  /** Download allowance used up. `remaining` reports would still fit right now. */
  | { kind: 'rate-limited'; retryAfterSeconds: number | null; remaining: number }
  | { kind: 'too-large'; totalBytes: number | null; maxBytes: number }
  /** None of the selected reports has a file available. */
  | { kind: 'unavailable' }
  | { kind: 'failed' }

export interface StartedBulkDownload {
  /** Report ids in the archive, kept so the same download can be repeated. */
  ids: readonly number[]
  count: number
  /** Size of the ZIP file. */
  bytes: number
  /** Selected reports left out because their file is not available. */
  unavailable: number
}

interface FetchFailure {
  statusCode?: number
  status?: number
  data?: {
    retryAfter?: unknown
    remaining?: unknown
    data?: { totalBytes?: unknown; maxBytes?: unknown }
  }
  response?: { status?: number; headers?: { get(name: string): string | null } }
}

function positiveNumber(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

function toBulkDownloadError(thrown: unknown): BulkDownloadError {
  const failure = (thrown ?? {}) as FetchFailure
  const status = failure.statusCode ?? failure.status ?? failure.response?.status

  if (status === 429) {
    return {
      kind: 'rate-limited',
      retryAfterSeconds:
        positiveNumber(failure.data?.retryAfter) ??
        positiveNumber(failure.response?.headers?.get('Retry-After')),
      remaining: positiveNumber(failure.data?.remaining) ?? 0
    }
  }
  if (status === 413) {
    return {
      kind: 'too-large',
      totalBytes: positiveNumber(failure.data?.data?.totalBytes),
      maxBytes: positiveNumber(failure.data?.data?.maxBytes) ?? BULK_REPORT_MAX_BYTES
    }
  }
  if (status === 404) return { kind: 'unavailable' }
  return { kind: 'failed' }
}

/**
 * Hand a same-origin URL to the browser as a download. The browser streams it
 * to disk with its own progress and cancel controls; nothing is held in page
 * memory, which matters for archives of several hundred megabytes on phones.
 */
function saveWithBrowser(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * Selecting several A-G reports on /reports and downloading them as one ZIP.
 *
 * The selection lives in `useState`, so it survives moving between pages of
 * results, changing filters, and opening a report and coming back.
 *
 * Downloading is two steps: ask the server whether this selection can be
 * downloaded right now (`check=1`, costs nothing), then let the browser fetch
 * the archive itself. Problems the visitor can act on (limit reached, too
 * large) therefore show up in the page instead of as a failed download.
 */
export function useReportBulkDownload(options: { save?: (url: string) => void } = {}) {
  const save = options.save ?? saveWithBrowser

  const selected = useState<SelectedReport[]>('reports-bulk-selection', () => [])
  const checking = ref(false)
  const error = ref<BulkDownloadError | null>(null)
  const started = ref<StartedBulkDownload | null>(null)

  const count = computed(() => selected.value.length)
  const isFull = computed(() => selected.value.length >= BULK_REPORT_MAX_FILES)
  /** Sum of the sizes the listing gave us; a lower bound if any are unknown. */
  const estimatedBytes = computed(() =>
    selected.value.reduce((sum, report) => sum + (report.bytes ?? 0), 0)
  )
  const hasUnknownSizes = computed(() => selected.value.some((report) => report.bytes === null))

  function isSelected(id: string): boolean {
    return selected.value.some((report) => report.id === id)
  }

  // Any change to the selection makes the last outcome stale.
  function selectionChanged() {
    error.value = null
    started.value = null
  }

  function toSelected(report: AuditReport): SelectedReport {
    return {
      id: report.id,
      title: report.title,
      bytes: fileSizeLabelToBytes(report.fileSize)
    }
  }

  /** Add or remove one report. Returns false when the selection is full. */
  function toggle(report: AuditReport): boolean {
    if (isSelected(report.id)) {
      selected.value = selected.value.filter((item) => item.id !== report.id)
    } else {
      if (isFull.value) return false
      selected.value = [...selected.value, toSelected(report)]
    }
    selectionChanged()
    return true
  }

  /**
   * Add every report given that is not selected yet, up to the limit. Returns
   * how many could not be added because the selection filled up.
   */
  function selectAll(reports: AuditReport[]): number {
    const missing = reports.filter((report) => !isSelected(report.id))
    const room = Math.max(0, BULK_REPORT_MAX_FILES - selected.value.length)
    const added = missing.slice(0, room)
    if (added.length > 0) {
      selected.value = [...selected.value, ...added.map(toSelected)]
      selectionChanged()
    }
    return missing.length - added.length
  }

  function deselectAll(reports: AuditReport[]) {
    const ids = new Set(reports.map((report) => report.id))
    const kept = selected.value.filter((report) => !ids.has(report.id))
    if (kept.length !== selected.value.length) {
      selected.value = kept
      selectionChanged()
    }
  }

  function clear() {
    selected.value = []
    selectionChanged()
  }

  /** Dismiss the "download started" or error message. */
  function dismiss() {
    selectionChanged()
  }

  async function run(ids: readonly number[], fromSelection: boolean) {
    if (checking.value || ids.length === 0) return

    checking.value = true
    error.value = null
    // A failed repeat keeps the earlier download on offer; a new one replaces it.
    if (fromSelection) started.value = null
    try {
      const summary = await $fetch<BulkReportDownloadSummary>(
        bulkReportDownloadUrl(ids, { check: true }),
        // $fetch repeats a GET once on 429/5xx by default. A refusal here is an
        // answer to show the visitor, not something to ask again.
        { retry: 0 }
      )
      // Ask only for what the server can deliver: every id requested counts
      // against the visitor's hourly allowance.
      const available = ids.filter((id) => !summary.unavailable.includes(id))
      save(bulkReportDownloadUrl(available))
      started.value = {
        ids: available,
        count: summary.count,
        bytes: summary.zipBytes,
        unavailable: summary.unavailable.length
      }
      if (fromSelection) selected.value = []
    } catch (thrown) {
      error.value = toBulkDownloadError(thrown)
    } finally {
      checking.value = false
    }
  }

  /** Download the current selection. Clears it once the download has started. */
  function download() {
    return run(
      selected.value.map((report) => Number(report.id)),
      true
    )
  }

  /** Repeat the download that was last started (e.g. the first one was cancelled). */
  function downloadAgain() {
    return run(started.value?.ids ?? [], false)
  }

  return {
    selected,
    count,
    isFull,
    estimatedBytes,
    hasUnknownSizes,
    maxFiles: BULK_REPORT_MAX_FILES,
    checking: readonly(checking),
    error: readonly(error),
    started: readonly(started),
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    clear,
    dismiss,
    download,
    downloadAgain
  }
}
