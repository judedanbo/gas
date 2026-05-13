# Report File Upload Modal — Design Spec

## Overview

Replace the inline file upload and separate thumbnail upload on the admin report create/edit pages with a unified modal component. The modal handles PDF upload, preview, server-side thumbnail generation, and file size tracking in a single flow.

## Goals

1. **PDF preview**: Show an iframe preview of the attached report PDF inside the modal
2. **Unified file modal**: Replace inline drag-and-drop + separate thumbnail upload with one modal that handles both
3. **Thumbnail generation**: Auto-generate thumbnail from PDF via the existing server-side `pdftoppm` utility, with option to replace with a custom image
4. **File size tracking**: Capture file size from the upload response and emit it to the form for inclusion in create/update payloads

## Approach

Single new component (`AdminReportFileModal`) using Approach A — a focused component for the report file workflow that reuses `AdminFileUpload` internally for the actual upload step and `UiBaseModal` for the modal shell.

## Component: `AdminReportFileModal`

**File**: `components/admin/form/AdminReportFileModal.vue`

### Props

```typescript
interface Props {
  fileUrl?: string | null       // existing file URL (edit mode)
  fileSize?: number | null      // existing file size in bytes
  thumbnail?: string | null     // existing thumbnail URL
  error?: string                // validation error from parent form
  required?: boolean
}
```

### Emits

```typescript
defineEmits<{
  'update:fileUrl': [url: string]
  'update:fileSize': [size: number | undefined]
  'update:thumbnail': [url: string]
}>()
```

### Inline Display (modal closed)

Two states:

**No file attached (create page initial state):**
- Styled card with dashed border, upload icon, and "Attach Report" text
- Clicking opens the modal

**File attached (edit page, or after upload):**
- Compact card showing:
  - Thumbnail image on the left (or PDF icon fallback if no thumbnail)
  - Filename (extracted from URL path)
  - Formatted file size (e.g. "2.4 MB")
  - Subtle "Change" or pencil icon button
- Clicking the card opens the modal with existing data pre-loaded

### Modal Contents

Uses `UiBaseModal` with `size="full"` (max-w-4xl) and title "Report File".

**Layout inside modal (top to bottom):**

1. **Upload area** — `AdminFileUpload` component configured for `type="report"`. Hidden when a file is already uploaded (shows file details instead). A "Replace file" link re-shows the upload area.

2. **PDF Preview** — `<iframe>` rendering the uploaded PDF URL. Includes an "Open in new tab" link below. Only visible when a fileUrl exists.

3. **File details bar** — Horizontal bar showing: filename, formatted file size, MIME type badge ("PDF").

4. **Thumbnail section** — Two-column layout:
   - Left: Generated/existing thumbnail preview (or placeholder with spinner during generation)
   - Right: Status text ("Auto-generated from PDF" or "Custom upload") and a button to upload a custom replacement via `AdminFileUpload` configured for `type="thumbnail"`

5. **Footer actions** — "Cancel" (discards any changes made in the modal) and "Confirm" (emits all three values: `fileUrl`, `fileSize`, `thumbnail` and closes modal).

### Modal Flow

```
[Open modal]
  → If no file: show upload area
  → If existing file: show preview + details + thumbnail

[Upload new PDF]
  → AdminFileUpload uploads to /api/admin/upload?type=report
  → On success: capture fileUrl + fileSize from response
  → Show PDF preview in iframe
  → Auto-call POST /api/admin/reports/generate-thumbnail with fileUrl
  → On thumbnail success: show generated thumbnail
  → On thumbnail failure: show message + manual upload fallback

[Admin optionally uploads custom thumbnail]
  → Replaces auto-generated thumbnail URL

[Click "Confirm"]
  → Emit update:fileUrl, update:fileSize, update:thumbnail
  → Close modal

[Click "Cancel" or Esc or backdrop]
  → Discard any changes, close modal, original values preserved
```

## Server Endpoint: Generate Thumbnail

**Route**: `POST /api/admin/reports/generate-thumbnail`

**File**: `server/api/admin/reports/generate-thumbnail.post.ts`

**Auth**: Standard admin auth middleware (automatic for `/api/admin/**`)

**Request body**:
```typescript
{ fileUrl: string }  // e.g. "/uploads/reports/20260513-abc.pdf"
```

**Validation**:
- `fileUrl` is required, must be a non-empty string
- `fileUrl` must start with `/uploads/reports/` (prevent path traversal)

**Processing**:
1. Call `resolvePublicAsset(fileUrl)` to get filesystem path
2. If file not found, return 422 "PDF file not found"
3. Call `generateThumbnailFromPdf(pdfPath)`
4. If generation fails, return 422 "Thumbnail generation failed — pdftoppm may not be available"
5. Return `{ success: true, thumbnailUrl: "<generated url>" }`

**Response**:
```typescript
{ success: boolean; thumbnailUrl: string }
```

## Page Integration

### Create page (`pages/admin/reports/create.vue`)

**Changes:**
- Replace `AdminFileUpload` for report PDF (lines 48-58) with `AdminReportFileModal`
- Remove the sidebar Thumbnail `AdminFileUpload` section (lines 152-160)
- Remove `handleFileInfo` function — modal emits directly to form fields
- Wire up three v-model bindings:
  ```html
  <AdminFormAdminReportFileModal
    :file-url="form.fileUrl"
    :file-size="form.fileSize"
    :thumbnail="form.thumbnail"
    :error="errors.fileUrl"
    required
    @update:file-url="form.fileUrl = $event"
    @update:file-size="form.fileSize = $event"
    @update:thumbnail="form.thumbnail = $event"
  />
  ```

### Edit page (`pages/admin/reports/[id]/edit.vue`)

**Changes:**
- Replace `AdminFileUpload` for report PDF (lines 105-115) with `AdminReportFileModal`
- Remove collapsible PDF preview section (lines 118-166)
- Remove sidebar Thumbnail section (lines 283-291)
- Remove `previewExpanded` ref
- Remove `handleFileInfo` function
- Wire up same three v-model bindings as create page

### What stays unchanged on both pages:
- Form submission logic (`create()` / `update()`)
- Slug, category, translations, publish settings
- Validation rules (`fileUrl` remains required)
- `ReportInput` type and payload shape
- Unsaved changes tracking (watches same form fields)

## File Size Handling

- File size is captured from the upload response (`response.size` in bytes)
- Displayed formatted in the modal (e.g. "2.4 MB") using the same `formatFileSize` helper pattern from `AdminFileUpload`
- Emitted as raw bytes to the form's `fileSize` field
- Sent as part of `ReportInput` on create/update — no changes to the API handlers needed
- For existing reports on edit page, `fileSize` comes from the database and is passed as a prop

## Existing Auto-Generation Behavior

The create/update API handlers (`server/api/admin/reports/index.ts` and `[id].ts`) already auto-generate thumbnails when none is provided. With this change, the modal will typically provide an explicit thumbnail (auto-generated or custom), so the server-side fallback becomes a safety net rather than the primary path. No changes needed to those handlers.

## Accessibility

- Modal uses `UiBaseModal` which already provides: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Esc to close
- The inline file card is a `<button>` with descriptive `aria-label` ("Attach report" or "Change report file: {filename}")
- Upload areas inside the modal retain keyboard accessibility from `AdminFileUpload`
- Thumbnail generation loading state announced via `aria-live="polite"` region
