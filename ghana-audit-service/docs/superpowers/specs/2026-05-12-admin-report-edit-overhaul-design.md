# Admin Report Edit Page Overhaul

**Date:** 2026-05-12
**Scope:** `pages/admin/reports/[id]/edit.vue`, `pages/admin/reports/create.vue`, supporting composables and components

## Summary

Comprehensive overhaul of the admin report edit page: sticky save bar with unsaved changes detection, embedded PDF preview, TipTap rich text editor for summaries, audit trail timeline, toast notifications, skeleton loading, and sidebar reorganization.

## 1. Sticky Save Bar + Unsaved Changes Guard

### Composable: `useUnsavedChanges`

New composable at `composables/useUnsavedChanges.ts`:

```typescript
interface UseUnsavedChangesOptions {
  formData: () => Record<string, unknown>  // reactive getter for current form state
  enabled?: Ref<boolean> | boolean         // disable during initial load
}

interface UseUnsavedChangesReturn {
  hasChanges: ComputedRef<boolean>
  markSaved: () => void       // snapshot current state as "saved"
  markClean: () => void       // force no-changes state (e.g., after discard)
}
```

**Behavior:**
- Deep-compares current form state against a stored snapshot using `JSON.stringify`
- `markSaved()` updates the snapshot to current values (called after successful save)
- Registers `beforeunload` handler when `hasChanges` is true
- Registers `onBeforeRouteLeave` guard with `window.confirm()` dialog

### Sticky Save Bar

Replace the current bottom action bar with a bar fixed to the viewport bottom. Appears with a slide-up transition when `hasChanges` is true.

**Layout:**
- Left: amber dot + "Unsaved changes" text
- Right: "Discard" ghost button (resets form to snapshot) + "Save Changes" primary button with spinner

The bar uses `position: sticky; bottom: 0` within the form container with a `z-10` to sit above content. Background matches the card style (`bg-white dark:bg-gray-800`) with a top border and subtle shadow.

### Files
- `composables/useUnsavedChanges.ts` — new
- `pages/admin/reports/[id]/edit.vue` — replace bottom action bar

## 2. Embedded PDF Preview

When `form.fileUrl` is set, render a preview section below the file upload card in the main content column.

**Component structure (inline, not a separate component):**
```html
<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
  <button @click="previewExpanded = !previewExpanded">
    Preview <chevron-icon />
  </button>
  <div v-if="previewExpanded">
    <iframe :src="form.fileUrl" class="w-full h-[500px] rounded-b-lg" />
    <a :href="form.fileUrl" target="_blank">Open in new tab</a>
  </div>
</div>
```

**Details:**
- Default state: collapsed (to save vertical space)
- The iframe `src` uses the `fileUrl` directly (internal path like `/uploads/reports/xxx.pdf`)
- Fallback link always visible below the iframe for browsers that don't render PDFs
- When a new file is uploaded, the preview updates immediately (reactive binding to `form.fileUrl`)
- No CSP changes needed — `frame-src 'self'` is already allowed

### Files
- `pages/admin/reports/[id]/edit.vue` — add preview section

## 3. Rich Text Summary (TipTap)

### New Dependencies
```
@tiptap/vue-3
@tiptap/starter-kit
@tiptap/extension-link
@tiptap/pm
```

### Component: `AdminFormAdminRichText.vue`

New component at `components/admin/form/AdminRichText.vue`.

**Props:**
- `modelValue: string` — HTML content
- `label?: string`
- `placeholder?: string`
- `error?: string`
- `required?: boolean`
- `disabled?: boolean`

**Emits:** `update:modelValue`

**Toolbar buttons (single row):**
- Bold (B) — toggle
- Italic (I) — toggle
- Bullet list — toggle
- Ordered list — toggle
- Link — opens a small inline popover with URL input + apply/remove buttons
- Clear formatting — clears all marks

**Styling:**
- Toolbar: `bg-gray-50 dark:bg-gray-700` with `border-b`, icon buttons with hover/active states
- Editor area: min-height 120px, max-height 300px with overflow scroll
- Active toolbar buttons get `bg-gray-200 dark:bg-gray-600` treatment
- Error state: red border matching other admin form components
- Focus ring matching the admin input style

**TipTap extensions used:**
- `StarterKit` (provides bold, italic, bullet list, ordered list, paragraph, hard break)
- `Link` with `openOnClick: false` (don't navigate when clicking links in the editor)
- `Placeholder` for placeholder text

### Integration with AdminTranslationTabs

`AdminTranslationTabs.vue` already handles field types. The `richtext` type is referenced in the field config but may not be fully implemented. Add/verify the rendering case:

```html
<AdminFormAdminRichText
  v-else-if="field.type === 'richtext'"
  v-model="modelValue[locale][field.key]"
  :label="field.label"
  :placeholder="field.placeholder"
  :error="getFieldError(locale, field.key)"
  :required="field.required && locale === 'en'"
/>
```

### Data format

Summary fields store HTML strings in the existing `text` column (no schema change). Example output:
```html
<p>This report covers the <strong>2025 financial year</strong> audit of:</p>
<ul><li>Revenue collection</li><li>Expenditure management</li></ul>
```

### Public display

The report detail page should render summary with `v-html` inside a container with Tailwind Typography's `prose` class for consistent styling. `@tailwindcss/typography` is already installed.

### Files
- `components/admin/form/AdminRichText.vue` — new
- `components/admin/form/AdminTranslationTabs.vue` — verify/add richtext case
- `pages/admin/reports/[id]/edit.vue` — change summary field type to `richtext`
- `pages/admin/reports/create.vue` — same change
- `package.json` — add TipTap dependencies
- (`@tailwindcss/typography` is already installed — no action needed)

## 4. Audit Trail / History

### API Endpoint: `GET /api/admin/reports/[id]/history`

New endpoint at `server/api/admin/reports/[id]/history.get.ts`.

**Query:** `audit_logs` table filtered by `entityType = 'report'` and `entityId = :id`, joined with `users` to get the actor's name. Ordered by `createdAt DESC`, limited to 20.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "action": "update",
      "userName": "Admin User",
      "changes": { "before": {...}, "after": {...} },
      "createdAt": "2026-05-12T10:30:00Z"
    }
  ]
}
```

### UI: Sidebar Timeline

A new collapsible section in the sidebar titled "History", positioned between the Thumbnail and Meta sections.

**Timeline design:**
- Vertical line (left border) with circular dots at each entry
- Each entry: user initial circle (colored) + user name + action verb + relative time
- Action verbs: "created this report", "updated this report", "deleted this report"
- For updates: small "View changes" toggle that expands to show changed fields
- Show last 10 entries; if more exist, show "View full history" link (placeholder — links nowhere for now, can be a future full-page view)

**Change diff display (for updates):**
- Parse the `changes` JSON (which has `before` and `after` keys)
- Show field-level diffs: "Title: 'Old Title' → 'New Title'"
- Skip unchanged fields
- Translate field keys to human-readable labels

### Files
- `server/api/admin/reports/[id]/history.get.ts` — new
- `pages/admin/reports/[id]/edit.vue` — add history section

## 5. Toast Notification System

### Composable: `useToast`

New composable at `composables/useToast.ts`. Uses a module-level reactive array as a singleton queue (shared across all components that call `useToast()`).

```typescript
interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number  // ms, default 4000
}

interface UseToastReturn {
  toasts: Readonly<Ref<Toast[]>>
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
  dismiss: (id: string) => void
}
```

Auto-dismiss after `duration` ms. Each toast gets a unique ID for targeted dismissal.

### Component: `UiToastContainer.vue`

Renders the toast queue as stacked cards in the top-right corner of the viewport (`fixed top-4 right-4 z-50`). Each toast slides in from the right with a transition.

**Toast card:**
- Icon (checkmark for success, X for error, warning triangle, info circle)
- Message text
- Close button
- Color-coded left border (green/red/amber/blue)

### Mounting

Add `<UiToastContainer />` to the admin layout so it's available on all admin pages.

### Files
- `composables/useToast.ts` — new
- `components/ui/ToastContainer.vue` — new
- `layouts/admin.vue` — mount container

## 6. Skeleton Loading

Replace the current spinner with a skeleton that mirrors the two-column edit page layout.

**Structure:**
- Left column: two cards with animated pulse placeholders (matching translations card height + file upload card height)
- Right column: three smaller cards with pulse placeholders (matching settings, thumbnail, meta)

Uses `animate-pulse` on `bg-gray-200 dark:bg-gray-700` rounded blocks. No separate component — inline in the edit page template since it's specific to this layout.

### Files
- `pages/admin/reports/[id]/edit.vue` — replace spinner with skeleton

## 7. Sidebar Reorganization

Reorder and regroup the sidebar sections for better information hierarchy:

1. **Status** — Prominent status badge (green "Published" / gray "Draft"), publish toggle, publish date picker (conditional)
2. **URL** — Slug input with availability checker
3. **Classification** — Category select dropdown
4. **Thumbnail** — Thumbnail upload
5. **History** — Audit trail timeline (new, Section 4)
6. **Meta** — Created/updated timestamps, created by user name

Each section remains in its own card. The status badge is a colored pill at the top of the Status card for immediate visibility.

### Files
- `pages/admin/reports/[id]/edit.vue` — reorder sidebar sections

## 8. Post-Save Behavior

After a successful save:
1. Show success toast: "Report updated successfully"
2. Stay on the edit page (do NOT redirect to list)
3. Call `markSaved()` to reset the unsaved changes snapshot
4. Re-fetch the report to get server-side timestamps and any normalized data
5. Re-fetch history to show the new audit log entry

The "Cancel" button in the sticky bar navigates back to `/admin/reports`. The back arrow at the top of the page also goes to `/admin/reports`.

## Files Changed (Summary)

| File | Change |
|------|--------|
| `composables/useUnsavedChanges.ts` | New — unsaved changes detection |
| `composables/useToast.ts` | New — toast notification system |
| `components/ui/ToastContainer.vue` | New — toast renderer |
| `components/admin/form/AdminRichText.vue` | New — TipTap rich text editor |
| `components/admin/form/AdminTranslationTabs.vue` | Add richtext field type rendering |
| `server/api/admin/reports/[id]/history.get.ts` | New — audit trail endpoint |
| `pages/admin/reports/[id]/edit.vue` | Major overhaul — all sections |
| `pages/admin/reports/create.vue` | Rich text field type + toast |
| `layouts/admin.vue` | Mount toast container |
| `package.json` | TipTap dependencies |

## Out of Scope

- Full history page (just a "View full history" placeholder link for now)
- Rich text for other admin entity edit pages (reports only for now, component is reusable)
- Autosave / draft recovery
- Version comparison (side-by-side diff view)
- Create page overhaul (only the richtext field change applies; full create page improvements are a separate effort)
- Collaborative editing / locking
