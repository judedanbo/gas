/**
 * Pure helpers for the inline PDF reader (components/reports/PdfViewer.vue and
 * PdfReader.vue), kept out of the components so they can be unit-tested.
 */

/** Zoom range offered by the reader's controls. */
export const MIN_SCALE = 0.25
export const MAX_SCALE = 4
/** Each zoom step multiplies or divides the scale by this. */
export const ZOOM_FACTOR = 1.25

/** The scale one zoom step away from `scale`, clamped to the offered range. */
export function nextScale(scale: number, direction: 1 | -1): number {
  const stepped = direction > 0 ? scale * ZOOM_FACTOR : scale / ZOOM_FACTOR
  const rounded = Math.round(stepped * 100) / 100
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, rounded))
}

export function zoomPercent(scale: number): number {
  return Math.round(scale * 100)
}

/** `page` as a valid 1-based page number for a document of `pageCount` pages. */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page) || pageCount < 1) return 1
  return Math.min(Math.max(Math.round(page), 1), pageCount)
}

/**
 * Whether a PDF that pdf.js can't fetch (it lives on another origin) can be
 * shown in an <iframe> instead. The browser must have a built-in PDF viewer
 * (`navigator.pdfViewerEnabled`), and it must be a mouse-driven one: phone and
 * tablet browsers either have no inline viewer (Chrome for Android downloads
 * the file) or, like iOS Safari, show only the first page inside a frame.
 * Everyone else gets a link that opens the file in a new tab, where the
 * device's own viewer takes over.
 */
export function canFramePdf(nav: { pdfViewerEnabled?: boolean }, finePointer: boolean): boolean {
  return nav.pdfViewerEnabled === true && finePointer
}

/** `canFramePdf` for the visitor's browser (browser-only). */
export function detectPdfFramingSupport(): boolean {
  const finePointer =
    typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches
  return canFramePdf(navigator, finePointer)
}
