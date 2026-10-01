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
  INSPECT_FAILED:
    'The PDF could not be read — it may be damaged or password-protected. The original file is unchanged.'
}

export function optimizationErrorMessage(code: string | null | undefined): string {
  const known = code ? OPTIMIZATION_ERROR_MESSAGES[code] : undefined
  if (known) return known
  // Name the failing step (a fixed code, never internals) so a report from an
  // admin can be matched to the server log line.
  return code
    ? `Optimization failed (${code}). The original file is unchanged.`
    : 'Optimization failed. The original file is unchanged.'
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
