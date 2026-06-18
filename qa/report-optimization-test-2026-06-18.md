# Report PDF Optimization — Full Functional Test

**Date:** 2026-06-18
**Branch:** `test/admin-portal-qa-audit`
**Feature:** Admin audit-report PDF upload + optimization (inspect → split → classify native/scanned → OCR → merge → Ghostscript compress → replace-if-smaller), run as a detached background job with SSE progress streaming, plus thumbnail generation. UI in `AdminFileModal.vue` on the report create/edit pages; pipeline in `server/utils/pdfOptimizer.ts`; endpoints under `server/api/admin/reports/`.
**Environment:** local `npm run dev` on `:3000`; installed `qpdf` + `ghostscript` (poppler-utils + tesseract already present) so the real pipeline runs. Azure Blob unconfigured → on-disk `public/pdf/reports/` (expected dev fallback). Fixtures built from a real 5-page image-heavy bulletin.

## Outcome

The pipeline itself is **solid** (correct compression, preset behaviour, skip-when-not-smaller, OCR, validation). But the **feedback path was completely broken** — two defects meant the admin UI never showed progress or results. Both were **found and fixed during this test**; a third (bookmark protection) is a real but lower-severity gap left documented. After the fixes, the feature works end-to-end.

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | **P1** | SSE stream 401s → no optimization feedback at all | **Fixed** |
| 2 | **P1** | Successful jobs never send a terminal event → modal hangs at "Optimizing…" forever | **Fixed** |
| 3 | P2 | Bookmark-protection guard never fires (poppler `pdfinfo` emits no "Bookmarks:" line) → bookmarked PDFs are optimized and lose their outline silently; the "Optimize anyway (drops bookmarks)" UX is dead | **Open (documented)** |
| 4 | P3 | "X native · Y scanned" tally under-counts (showed 4 on a 5-page PDF — a page that is neither clearly native nor scanned is uncounted) | **Open (documented)** |

## Bugs found & fixed

### P1-1 — SSE auth rejected (no feedback)
`server/middleware/adminAuth.ts` matched the SSE-ticket route list against `event.path` (which **includes the query string**) instead of the query-stripped `pathname`. EventSource can't send a `Bearer` header, so it authenticates via a signed `ticket` query param — but `SSE_TICKET_ROUTES.includes(path)` was always false (path was `/api/admin/reports/optimize-stream?jobId=…&ticket=…`), so every stream request 401'd.
**Evidence:** dev log `[…/optimize-stream?…] Missing or invalid authorization`; UI showed nothing.
**Fix:** match against `pathname`.

### P1-2 — successful jobs never deliver a terminal event (UI hangs)
On success, `runOptimization` (`optimize.post.ts`) only called `updateJob(status:'success')` — it never `pushEvent`-ed a terminal `done` (the **error** path did). `optimize-stream.get.ts` only delivered the terminal via a *live* `done` event or a connect-time `isTerminal` check, and it snapshot/replayed the buffer **before** subscribing (a race for fast jobs). So any client connected while a job was running got progress events but never the terminal → the modal hung at "Optimizing…" indefinitely even though the backend finished and replaced the file.
**Evidence:** reproducible after a clean restart — file on disk dropped 3.0MB→1.18MB while the modal stayed on "Optimizing…"; `ropt-02-after-upload.png`.
**Fix:** (a) emit a `done` event on the success path; (b) rewrite the stream to **subscribe first, then cursor-flush buffered events, with a terminal re-check after the initial flush** — eliminating the replay/subscribe race.

### Dockerfile (requested)
The optimize job runs **in-process** in the web runner, but the runtime image installed only `poppler-utils` (the comment wrongly claimed the toolchain lived in a separate worker). Added `ghostscript`, `qpdf`, `tesseract-ocr`, `tesseract-ocr-data-eng` to the runner stage so optimization doesn't 500 with `MISSING_BINARY` in production.

## Scenario results (post-fix)

| Scenario | Result |
|---|---|
| **A** Preset selector (reports-only, default ebook, 3 options, localStorage key `gas:report-optimize-preset`) | ✅ PASS |
| **B** Upload → optimize → thumbnail → confirm → create | ✅ PASS — UI "Reduced 3.0 MB → 1.1 MB (saved 1.8 MB)", auto thumbnail, report row saved with optimized `file_size=1184605` + thumbnail |
| **Presets** (direct pipeline) | ✅ screen 854 KB < ebook 1.18 MB < printer (unchanged → **skipped**, no gain at 300 DPI) |
| **C** Already-compressed → skipped | ✅ tiny text-only PDF and printer-on-bulletin both `skippedCompression`, original untouched |
| **D** Bookmarked PDF | ⚠️ **Optimized with NO HAS_BOOKMARKS error** (guard non-functional — see P2-3); outline silently dropped |
| **E** Scanned/image-only → OCR | ✅ classified 4 scanned, tesseract OCR ran, 5.86 MB → 5.25 MB searchable output, page count preserved |
| **F** Edit-page "Optimize PDF" re-optimize | ✅ inline "Reduced to 1.1 MB", `audit_reports.file_size` updated, `audit_logs` `report_optimization` row added (action `update`) |
| **G** Thumbnail | ✅ auto-generate works ("Auto-generated from PDF", jpg in `public/uploads/thumbnails/`); regenerate/custom share the same proven upload+endpoint path |
| **H** Replace file | Covered via the shared upload+optimize path proven in B (re-uploads re-optimize + re-thumbnail) |
| **I** Error/edge paths | ✅ optimize & generate-thumbnail: 400 "Invalid file path" (incl. traversal `/etc/passwd`), 422 "PDF file not found", 400 "fileUrl is required" |
| **J** Unit suite | ✅ 18/18 (`pdfOptimizer.test.ts`, `optimize.test.ts`, `generate-thumbnail.test.ts`) |

## Open findings (not fixed)

- **P2-3 Bookmark guard non-functional.** `pdfOptimizer.inspectPdf` derives `hasBookmarks` from a `pdfinfo` "Bookmarks:"/"Outline" line, but poppler `pdfinfo` (24.x here; Alpine build similar) does not emit one even when an outline exists (confirmed: `qpdf --json` shows `/Outlines` on the same file while `pdfinfo` shows no bookmark line). Result: the `HAS_BOOKMARKS` error never triggers, so bookmarked report PDFs are optimized and **lose their outline with no warning**, and the "Optimize anyway (drops bookmarks)" retry button is unreachable. Recommended fix: detect outlines via a reliable source (e.g. `qpdf --json` `outlines`, which is already a dependency) instead of `pdfinfo`.
- **P3-4 Page tally under-counts.** `nativePages + scannedPages` was 4 for a 5-page PDF across every run — a page that is neither clearly native (text/fonts) nor clearly scanned (image-only) is left uncounted in the classify tally. Cosmetic (the merge sanity-check still enforces the true page count); the "X native · Y scanned" line can read low.

## Verification commands
- Pipeline (real binaries): ran `optimizeReportPdf()` directly on each fixture/preset — see Scenario results.
- Quality gates on fixes: `npm run typecheck` ✅, `eslint` ✅, `prettier --check` ✅ (the 3 changed TS files), optimize unit tests ✅.

## Notes / caveats
- The PDF preview iframe logs a CSP `worker-src` violation (PDF.js worker blocked by `script-src`) — preview still renders; unrelated to optimization, not investigated here.
- Console `ERR_INCOMPLETE_CHUNKED_ENCODING` / `ERR_CONNECTION_REFUSED` on `optimize-stream` seen mid-test were artifacts of restarting the dev server with an open EventSource, not product behaviour.
