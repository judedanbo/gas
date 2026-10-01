import type { OptimizationPhase } from '~/composables/useReportOptimization'

// Admin-facing copy for the PDF optimization pipeline. The server only ever
// sends fixed error codes (never internals), so the friendly wording lives
// here in one place. The admin surface is intentionally English-only.
export const OPTIMIZATION_ERROR_MESSAGES: Record<string, string> = {
  MISSING_BINARY: 'The server is missing its PDF tools. Contact the administrator.',
  HAS_BOOKMARKS: 'This PDF contains bookmarks that optimization would remove.',
  TIMEOUT:
    'Optimization took too long and was stopped. The original file is unchanged — you can retry.',
  QUEUE_TIMEOUT:
    'Optimization waited too long behind other jobs. The original file is unchanged — try again shortly.',
  INTERRUPTED:
    'Optimization was interrupted by a server restart. The file itself is saved — you can run optimization again.'
}

export function optimizationErrorMessage(code: string | null | undefined): string {
  return (
    (code ? OPTIMIZATION_ERROR_MESSAGES[code] : undefined) ??
    'Optimization failed. The original file is unchanged.'
  )
}

export const OPTIMIZATION_PHASE_LABELS: Record<OptimizationPhase, string> = {
  inspect: 'Inspecting PDF…',
  split: 'Splitting pages…',
  classify: 'Classifying pages…',
  ocr: 'Running OCR on scanned pages…',
  merge: 'Reassembling document…',
  compress: 'Compressing…',
  done: 'Finishing…'
}

export function optimizationPhaseLabel(phase: OptimizationPhase | null): string {
  return (phase ? OPTIMIZATION_PHASE_LABELS[phase] : undefined) ?? 'Optimizing PDF…'
}

// Coarse 0–100 position reached at the end of each optimizer phase.
const PHASE_PROGRESS: Record<OptimizationPhase, number> = {
  inspect: 5,
  split: 10,
  classify: 25,
  ocr: 60,
  merge: 80,
  compress: 95,
  done: 100
}

/**
 * Overall optimization progress for a phase, refined by page-of-N while
 * inside the per-page phases (classify, ocr). 0 before the first event.
 */
export function optimizationProgressPercent(
  phase: OptimizationPhase | null | undefined,
  page = 0,
  totalPages = 0
): number {
  if (!phase) return 0
  if (phase === 'classify' || phase === 'ocr') {
    const base = phase === 'classify' ? PHASE_PROGRESS.split : PHASE_PROGRESS.classify
    const span = PHASE_PROGRESS[phase] - base
    const frac = totalPages ? Math.min(1, page / totalPages) : 0
    return Math.round(base + span * frac)
  }
  return PHASE_PROGRESS[phase] ?? 0
}

/** "Page x of N" while inside the per-page phases, else null. */
export function optimizationPageLabel(
  phase: OptimizationPhase | null | undefined,
  page = 0,
  totalPages = 0
): string | null {
  if ((phase === 'classify' || phase === 'ocr') && totalPages > 0) {
    return `Page ${page} of ${totalPages}`
  }
  return null
}
