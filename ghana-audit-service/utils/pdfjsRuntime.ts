import type * as PdfjsLibModule from 'pdfjs-dist/legacy/build/pdf.mjs'
import type * as PdfjsViewerModule from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'

export type PdfjsLib = typeof PdfjsLibModule
export type PdfjsViewer = typeof PdfjsViewerModule

export interface PdfjsRuntime {
  lib: PdfjsLib
  viewer: PdfjsViewer
  /** Where this pdf.js version's files are served from (see modules/pdfjs-assets.ts). */
  baseUrl: string
}

let runtime: Promise<PdfjsRuntime> | null = null
let stylesheet: Promise<void> | null = null

/**
 * Loads pdf.js — core and viewer components — from the versioned static files
 * that modules/pdfjs-assets.ts serves, once per page, and points its worker at
 * the matching script. Browser-only: the reader never renders on the server.
 */
export function loadPdfjs(baseUrl: string): Promise<PdfjsRuntime> {
  if (runtime) return runtime

  const loading = (async (): Promise<PdfjsRuntime> => {
    // Native dynamic imports of absolute URLs — Vite must leave them alone.
    const lib = (await import(/* @vite-ignore */ `${baseUrl}/build/pdf.min.mjs`)) as PdfjsLib
    lib.GlobalWorkerOptions.workerSrc = `${baseUrl}/build/pdf.worker.min.mjs`
    // The viewer components pick the core up from globalThis.pdfjsLib, which
    // the core sets as it loads, so the two files must be imported in this order.
    const viewer = (await import(/* @vite-ignore */ `${baseUrl}/web/pdf_viewer.mjs`)) as PdfjsViewer
    return { lib, viewer, baseUrl }
  })()

  runtime = loading
  // A failed load (offline, blocked) must not poison later attempts.
  loading.catch(() => {
    if (runtime === loading) runtime = null
  })
  return loading
}

/**
 * Adds the viewer's stylesheet to the page once and resolves when it has
 * loaded, so pages aren't laid out before their styles exist.
 */
export function ensurePdfjsStylesheet(baseUrl: string): Promise<void> {
  if (stylesheet) return stylesheet

  const loading = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `${baseUrl}/web/pdf_viewer.css`
    link.onload = () => resolve()
    link.onerror = () => {
      link.remove()
      reject(new Error('pdf.js stylesheet failed to load'))
    }
    document.head.appendChild(link)
  })

  stylesheet = loading
  loading.catch(() => {
    if (stylesheet === loading) stylesheet = null
  })
  return loading
}

/** `getDocument()` options pointing pdf.js at its fonts, CMaps and wasm decoders. */
export function pdfjsDocumentOptions(baseUrl: string) {
  return {
    cMapUrl: `${baseUrl}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${baseUrl}/standard_fonts/`,
    wasmUrl: `${baseUrl}/wasm/`,
    iccUrl: `${baseUrl}/iccs/`
  }
}
