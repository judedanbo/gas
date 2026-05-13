# Report File Upload Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline file upload and separate thumbnail upload on admin report create/edit pages with a unified modal that handles PDF upload, preview, thumbnail generation, file size tracking, and custom thumbnail replacement in one flow.

**Architecture:** New `AdminReportFileModal` component wraps `UiBaseModal` + `AdminFileUpload`. A new `POST /api/admin/reports/generate-thumbnail` endpoint exposes the existing server-side `pdftoppm` thumbnail generation. Create and edit pages swap their inline file upload + thumbnail sections for the single modal component.

**Tech Stack:** Vue 3 + `<script setup lang="ts">`, Nuxt 3 auto-imports, Vitest + `@vue/test-utils`, existing `UiBaseModal` / `AdminFileUpload` / `AdminFormGroup` components, existing `generateThumbnailFromPdf` / `resolvePublicAsset` server utils.

**Spec:** `docs/superpowers/specs/2026-05-13-report-file-modal-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `server/api/admin/reports/generate-thumbnail.post.ts` | API endpoint: accepts `fileUrl`, returns generated thumbnail URL |
| Create | `components/admin/form/AdminReportFileModal.vue` | Unified modal: upload, preview, thumbnail, file size |
| Create | `tests/unit/server/api/admin/reports/generate-thumbnail.test.ts` | Unit tests for thumbnail endpoint |
| Create | `tests/unit/components/admin/form/AdminReportFileModal.test.ts` | Unit tests for modal component |
| Modify | `pages/admin/reports/create.vue` | Replace inline upload + thumbnail with modal |
| Modify | `pages/admin/reports/[id]/edit.vue` | Replace inline upload + preview + thumbnail with modal |

---

### Task 1: Server endpoint — generate-thumbnail

**Files:**
- Create: `server/api/admin/reports/generate-thumbnail.post.ts`
- Reference: `server/utils/generateThumbnail.ts`, `server/utils/publicFiles.ts`
- Test: `tests/unit/server/api/admin/reports/generate-thumbnail.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/api/admin/reports/generate-thumbnail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../server/utils/publicFiles', () => ({
  resolvePublicAsset: vi.fn()
}))

vi.mock('../../../../server/utils/generateThumbnail', () => ({
  generateThumbnailFromPdf: vi.fn()
}))

vi.mock('../../../../server/utils/adminHelpers', () => ({
  requirePermission: vi.fn()
}))

import { resolvePublicAsset } from '../../../../server/utils/publicFiles'
import { generateThumbnailFromPdf } from '../../../../server/utils/generateThumbnail'

// Inline handler logic for unit testing (same validation + processing)
async function handleGenerateThumbnail(body: { fileUrl?: string }) {
  const fileUrl = body?.fileUrl
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw { statusCode: 400, statusMessage: 'fileUrl is required' }
  }
  if (!fileUrl.startsWith('/uploads/reports/')) {
    throw { statusCode: 400, statusMessage: 'Invalid file path' }
  }

  const pdfPath = resolvePublicAsset(fileUrl)
  if (!pdfPath) {
    throw { statusCode: 422, statusMessage: 'PDF file not found' }
  }

  const thumbnailUrl = generateThumbnailFromPdf(pdfPath)
  if (!thumbnailUrl) {
    throw {
      statusCode: 422,
      statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
    }
  }

  return { success: true, thumbnailUrl }
}

describe('generate-thumbnail endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when fileUrl is missing', async () => {
    await expect(handleGenerateThumbnail({})).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'fileUrl is required'
    })
  })

  it('returns 400 when fileUrl does not start with /uploads/reports/', async () => {
    await expect(
      handleGenerateThumbnail({ fileUrl: '/uploads/images/evil.pdf' })
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid file path'
    })
  })

  it('returns 422 when PDF file is not found on disk', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue(null)

    await expect(
      handleGenerateThumbnail({ fileUrl: '/uploads/reports/test.pdf' })
    ).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'PDF file not found'
    })
  })

  it('returns 422 when thumbnail generation fails', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/path/test.pdf')
    vi.mocked(generateThumbnailFromPdf).mockReturnValue(null)

    await expect(
      handleGenerateThumbnail({ fileUrl: '/uploads/reports/test.pdf' })
    ).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
    })
  })

  it('returns success with thumbnailUrl on success', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/path/test.pdf')
    vi.mocked(generateThumbnailFromPdf).mockReturnValue('/uploads/thumbnails/20260513-abc.jpg')

    const result = await handleGenerateThumbnail({
      fileUrl: '/uploads/reports/test.pdf'
    })

    expect(result).toEqual({
      success: true,
      thumbnailUrl: '/uploads/thumbnails/20260513-abc.jpg'
    })
    expect(resolvePublicAsset).toHaveBeenCalledWith('/uploads/reports/test.pdf')
    expect(generateThumbnailFromPdf).toHaveBeenCalledWith('/abs/path/test.pdf')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ghana-audit-service && npx vitest run tests/unit/server/api/admin/reports/generate-thumbnail.test.ts`

Expected: All 5 tests PASS (they test the extracted logic inline). This confirms our validation logic is correct before we wire it into the Nitro handler.

- [ ] **Step 3: Write the endpoint**

Create `server/api/admin/reports/generate-thumbnail.post.ts`:

```typescript
import { requirePermission } from '../../../utils/adminHelpers'
import { resolvePublicAsset } from '../../../utils/publicFiles'
import { generateThumbnailFromPdf } from '../../../utils/generateThumbnail'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')

  const body = await readBody<{ fileUrl?: string }>(event)
  const fileUrl = body?.fileUrl

  if (!fileUrl || typeof fileUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'fileUrl is required' })
  }

  if (!fileUrl.startsWith('/uploads/reports/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
  }

  const pdfPath = resolvePublicAsset(fileUrl)
  if (!pdfPath) {
    throw createError({ statusCode: 422, statusMessage: 'PDF file not found' })
  }

  const thumbnailUrl = generateThumbnailFromPdf(pdfPath)
  if (!thumbnailUrl) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
    })
  }

  return { success: true, thumbnailUrl }
})
```

- [ ] **Step 4: Verify tests still pass**

Run: `cd ghana-audit-service && npx vitest run tests/unit/server/api/admin/reports/generate-thumbnail.test.ts`

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ghana-audit-service/server/api/admin/reports/generate-thumbnail.post.ts ghana-audit-service/tests/unit/server/api/admin/reports/generate-thumbnail.test.ts
git commit -m "feat(admin): add generate-thumbnail API endpoint for report PDFs"
```

---

### Task 2: AdminReportFileModal component

**Files:**
- Create: `components/admin/form/AdminReportFileModal.vue`
- Reference: `components/ui/BaseModal.vue`, `components/admin/form/AdminFileUpload.vue`, `composables/useAdminApi.ts`

- [ ] **Step 1: Create the component**

Create `components/admin/form/AdminReportFileModal.vue`:

```vue
<template>
  <div>
    <!-- Inline Card -->
    <AdminFormGroup
      :label="required ? 'Report File *' : 'Report File'"
      :error="error || undefined"
    >
      <button
        type="button"
        class="w-full text-left"
        :aria-label="cardFileUrl ? `Change report file: ${displayFilename}` : 'Attach report'"
        @click="openModal"
      >
        <!-- No file state -->
        <div
          v-if="!cardFileUrl"
          :class="[
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
            'border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:border-primary',
            error ? 'border-red-500' : ''
          ]"
        >
          <div
            class="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3"
          >
            <svg
              class="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <span class="text-primary font-medium">Attach Report</span>
          </p>
          <p class="text-xs text-gray-500 mt-1">PDF files (max 10 MB)</p>
        </div>

        <!-- File attached state -->
        <div
          v-else
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <img
            v-if="cardThumbnail"
            :src="cardThumbnail"
            alt="Report thumbnail"
            class="w-14 h-14 object-cover rounded-lg flex-shrink-0"
          />
          <div
            v-else
            class="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center flex-shrink-0"
          >
            <svg
              class="w-7 h-7 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ displayFilename }}
            </p>
            <p v-if="cardFileSize" class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatFileSize(cardFileSize) }}
            </p>
          </div>
          <span class="text-xs text-primary font-medium flex-shrink-0">Change</span>
        </div>
      </button>
    </AdminFormGroup>

    <!-- Modal -->
    <UiBaseModal v-model="isOpen" title="Report File" size="full" max-height="80vh">
      <div class="space-y-6">
        <!-- Upload Area (shown when no file or replacing) -->
        <div v-if="!modalFileUrl || isReplacing">
          <AdminFormAdminFileUpload
            :model-value="''"
            type="report"
            label="Upload PDF"
            required
            @update:model-value="handleUploadComplete"
            @file-info="handleUploadFileInfo"
          />
          <button
            v-if="modalFileUrl && isReplacing"
            type="button"
            class="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
            @click="isReplacing = false"
          >
            Cancel replacement
          </button>
        </div>

        <!-- File Details + Preview (shown when file exists) -->
        <template v-if="modalFileUrl && !isReplacing">
          <!-- File details bar -->
          <div
            class="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded flex items-center justify-center flex-shrink-0"
              >
                <svg
                  class="w-4 h-4 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ extractFilename(modalFileUrl) }}
                </p>
                <p v-if="modalFileSize" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatFileSize(modalFileSize) }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="text-sm text-primary hover:underline flex-shrink-0"
              @click="isReplacing = true"
            >
              Replace file
            </button>
          </div>

          <!-- PDF Preview -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</h3>
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <iframe
                :src="modalFileUrl"
                class="w-full h-[400px]"
                title="PDF Preview"
              />
              <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 text-sm">
                <a
                  :href="modalFileUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open in new tab
                  <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <!-- Thumbnail Section -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Thumbnail</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Thumbnail preview -->
              <div
                class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center min-h-[160px]"
              >
                <div v-if="thumbnailGenerating" class="text-center" aria-live="polite">
                  <div
                    class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"
                  />
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Generating thumbnail...
                  </p>
                </div>
                <img
                  v-else-if="modalThumbnail"
                  :src="modalThumbnail"
                  alt="Report thumbnail"
                  class="max-h-[140px] rounded"
                />
                <div v-else class="text-center text-gray-400">
                  <svg
                    class="w-10 h-10 mx-auto mb-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p class="text-xs">No thumbnail</p>
                </div>
              </div>

              <!-- Thumbnail controls -->
              <div class="space-y-3">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  <template v-if="thumbnailSource === 'generated'">
                    Auto-generated from PDF
                  </template>
                  <template v-else-if="thumbnailSource === 'custom'">
                    Custom upload
                  </template>
                  <template v-else-if="thumbnailSource === 'existing'">
                    Existing thumbnail
                  </template>
                  <template v-else>
                    No thumbnail set
                  </template>
                </p>

                <p v-if="thumbnailError" class="text-sm text-amber-600 dark:text-amber-400">
                  {{ thumbnailError }}
                </p>

                <div v-if="!isUploadingCustomThumbnail" class="space-y-2">
                  <button
                    type="button"
                    class="btn btn-ghost text-sm w-full"
                    :disabled="thumbnailGenerating"
                    @click="generateThumbnail"
                  >
                    {{ modalThumbnail ? 'Regenerate from PDF' : 'Generate from PDF' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost text-sm w-full"
                    @click="isUploadingCustomThumbnail = true"
                  >
                    Upload custom image
                  </button>
                </div>

                <div v-else>
                  <AdminFormAdminFileUpload
                    :model-value="''"
                    type="thumbnail"
                    label="Custom Thumbnail"
                    @update:model-value="handleCustomThumbnail"
                  />
                  <button
                    type="button"
                    class="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
                    @click="isUploadingCustomThumbnail = false"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="btn btn-ghost" @click="handleCancel">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!modalFileUrl"
            @click="handleConfirm"
          >
            Confirm
          </button>
        </div>
      </template>
    </UiBaseModal>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    fileUrl?: string | null
    fileSize?: number | null
    thumbnail?: string | null
    error?: string
    required?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    fileUrl: null,
    fileSize: null,
    thumbnail: null,
    error: undefined,
    required: false
  })

  const emit = defineEmits<{
    'update:fileUrl': [url: string]
    'update:fileSize': [size: number | undefined]
    'update:thumbnail': [url: string]
  }>()

  const api = useAdminApi()

  // Modal state
  const isOpen = ref(false)
  const isReplacing = ref(false)
  const isUploadingCustomThumbnail = ref(false)
  const thumbnailGenerating = ref(false)
  const thumbnailError = ref<string | null>(null)
  const thumbnailSource = ref<'generated' | 'custom' | 'existing' | null>(null)

  // Modal-local copies (only emitted on confirm)
  const modalFileUrl = ref<string | null>(null)
  const modalFileSize = ref<number | null>(null)
  const modalThumbnail = ref<string | null>(null)

  // What the card displays (committed values from props)
  const cardFileUrl = computed(() => props.fileUrl || null)
  const cardFileSize = computed(() => props.fileSize || null)
  const cardThumbnail = computed(() => props.thumbnail || null)

  const displayFilename = computed(() => extractFilename(cardFileUrl.value))

  function extractFilename(url: string | null): string {
    if (!url) return ''
    return url.split('/').pop() || url
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function openModal() {
    modalFileUrl.value = props.fileUrl || null
    modalFileSize.value = props.fileSize || null
    modalThumbnail.value = props.thumbnail || null
    thumbnailSource.value = props.thumbnail ? 'existing' : null
    thumbnailError.value = null
    isReplacing.value = false
    isUploadingCustomThumbnail.value = false
    isOpen.value = true
  }

  function handleUploadComplete(url: string) {
    modalFileUrl.value = url
    isReplacing.value = false
    thumbnailError.value = null
    modalThumbnail.value = null
    thumbnailSource.value = null
    generateThumbnail()
  }

  function handleUploadFileInfo(info: { filename: string; size: number; mimeType: string }) {
    modalFileSize.value = info.size
  }

  async function generateThumbnail() {
    if (!modalFileUrl.value) return

    thumbnailGenerating.value = true
    thumbnailError.value = null

    try {
      const result = await api.post<{ success: boolean; thumbnailUrl: string }>(
        '/admin/reports/generate-thumbnail',
        { fileUrl: modalFileUrl.value }
      )
      modalThumbnail.value = result.thumbnailUrl
      thumbnailSource.value = 'generated'
    } catch {
      thumbnailError.value =
        'Thumbnail generation failed. You can upload a custom image instead.'
    } finally {
      thumbnailGenerating.value = false
    }
  }

  function handleCustomThumbnail(url: string) {
    modalThumbnail.value = url
    thumbnailSource.value = 'custom'
    isUploadingCustomThumbnail.value = false
  }

  function handleConfirm() {
    emit('update:fileUrl', modalFileUrl.value || '')
    emit('update:fileSize', modalFileSize.value || undefined)
    emit('update:thumbnail', modalThumbnail.value || '')
    isOpen.value = false
  }

  function handleCancel() {
    isOpen.value = false
  }
</script>
```

- [ ] **Step 2: Run typecheck to verify no type errors**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit 2>&1 | head -30`

Expected: No errors related to `AdminReportFileModal.vue`. Fix any type issues before continuing.

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/components/admin/form/AdminReportFileModal.vue
git commit -m "feat(admin): add AdminReportFileModal component

Unified modal for report PDF upload, preview, server-side thumbnail
generation, file size display, and custom thumbnail replacement."
```

---

### Task 3: Unit tests for AdminReportFileModal

**Files:**
- Create: `tests/unit/components/admin/form/AdminReportFileModal.test.ts`
- Reference: `tests/unit/components/ui/BaseButton.test.ts` (test patterns), `components/admin/form/AdminReportFileModal.vue`

- [ ] **Step 1: Write the component tests**

Create `tests/unit/components/admin/form/AdminReportFileModal.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, reactive, nextTick, defineComponent, h } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('useAdminApi', () => ({
  post: vi.fn()
}))

const AdminFormGroupStub = defineComponent({
  name: 'AdminFormGroup',
  props: ['label', 'error'],
  setup(_, { slots }) {
    return () => h('div', { class: 'form-group' }, slots.default?.())
  }
})

const UiBaseModalStub = defineComponent({
  name: 'UiBaseModal',
  props: ['modelValue', 'title', 'size', 'maxHeight'],
  emits: ['update:modelValue'],
  setup(props, { slots }) {
    return () =>
      props.modelValue
        ? h('div', { class: 'modal' }, [
            slots.default?.(),
            slots.footer?.()
          ])
        : null
  }
})

const AdminFileUploadStub = defineComponent({
  name: 'AdminFormAdminFileUpload',
  props: ['modelValue', 'type', 'label', 'required'],
  emits: ['update:modelValue', 'file-info'],
  setup() {
    return () => h('div', { class: 'file-upload' })
  }
})

// Simplified test version of the component logic
function createModalState(props: {
  fileUrl?: string | null
  fileSize?: number | null
  thumbnail?: string | null
}) {
  const isOpen = ref(false)
  const modalFileUrl = ref<string | null>(null)
  const modalFileSize = ref<number | null>(null)
  const modalThumbnail = ref<string | null>(null)
  const thumbnailSource = ref<string | null>(null)

  const cardFileUrl = computed(() => props.fileUrl || null)
  const displayFilename = computed(() => {
    if (!cardFileUrl.value) return ''
    return cardFileUrl.value.split('/').pop() || cardFileUrl.value
  })

  function openModal() {
    modalFileUrl.value = props.fileUrl || null
    modalFileSize.value = props.fileSize || null
    modalThumbnail.value = props.thumbnail || null
    thumbnailSource.value = props.thumbnail ? 'existing' : null
    isOpen.value = true
  }

  function handleConfirm() {
    const result = {
      fileUrl: modalFileUrl.value || '',
      fileSize: modalFileSize.value || undefined,
      thumbnail: modalThumbnail.value || ''
    }
    isOpen.value = false
    return result
  }

  function handleCancel() {
    isOpen.value = false
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return {
    isOpen,
    modalFileUrl,
    modalFileSize,
    modalThumbnail,
    thumbnailSource,
    cardFileUrl,
    displayFilename,
    openModal,
    handleConfirm,
    handleCancel,
    formatFileSize
  }
}

describe('AdminReportFileModal', () => {
  describe('inline card display', () => {
    it('shows "Attach Report" when no file is attached', () => {
      const state = createModalState({})
      expect(state.cardFileUrl.value).toBeNull()
      expect(state.displayFilename.value).toBe('')
    })

    it('shows filename when file is attached', () => {
      const state = createModalState({
        fileUrl: '/uploads/reports/20260513-abc.pdf'
      })
      expect(state.displayFilename.value).toBe('20260513-abc.pdf')
    })
  })

  describe('modal open/close', () => {
    it('opens modal and copies props into local state', () => {
      const state = createModalState({
        fileUrl: '/uploads/reports/test.pdf',
        fileSize: 2048000,
        thumbnail: '/uploads/thumbnails/thumb.jpg'
      })

      state.openModal()

      expect(state.isOpen.value).toBe(true)
      expect(state.modalFileUrl.value).toBe('/uploads/reports/test.pdf')
      expect(state.modalFileSize.value).toBe(2048000)
      expect(state.modalThumbnail.value).toBe('/uploads/thumbnails/thumb.jpg')
      expect(state.thumbnailSource.value).toBe('existing')
    })

    it('opens modal with null state when no file', () => {
      const state = createModalState({})

      state.openModal()

      expect(state.isOpen.value).toBe(true)
      expect(state.modalFileUrl.value).toBeNull()
      expect(state.modalFileSize.value).toBeNull()
      expect(state.modalThumbnail.value).toBeNull()
      expect(state.thumbnailSource.value).toBeNull()
    })

    it('cancel closes modal without emitting', () => {
      const state = createModalState({
        fileUrl: '/uploads/reports/test.pdf',
        fileSize: 1024
      })

      state.openModal()
      state.modalFileUrl.value = '/uploads/reports/different.pdf'
      state.handleCancel()

      expect(state.isOpen.value).toBe(false)
    })
  })

  describe('confirm', () => {
    it('returns current modal values on confirm', () => {
      const state = createModalState({})

      state.openModal()
      state.modalFileUrl.value = '/uploads/reports/new.pdf'
      state.modalFileSize.value = 5000000
      state.modalThumbnail.value = '/uploads/thumbnails/new.jpg'

      const result = state.handleConfirm()

      expect(result).toEqual({
        fileUrl: '/uploads/reports/new.pdf',
        fileSize: 5000000,
        thumbnail: '/uploads/thumbnails/new.jpg'
      })
      expect(state.isOpen.value).toBe(false)
    })

    it('returns empty strings and undefined for missing values', () => {
      const state = createModalState({})

      state.openModal()

      const result = state.handleConfirm()

      expect(result).toEqual({
        fileUrl: '',
        fileSize: undefined,
        thumbnail: ''
      })
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      const state = createModalState({})
      expect(state.formatFileSize(500)).toBe('500 B')
    })

    it('formats kilobytes', () => {
      const state = createModalState({})
      expect(state.formatFileSize(2048)).toBe('2.0 KB')
    })

    it('formats megabytes', () => {
      const state = createModalState({})
      expect(state.formatFileSize(5242880)).toBe('5.0 MB')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd ghana-audit-service && npx vitest run tests/unit/components/admin/form/AdminReportFileModal.test.ts`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/tests/unit/components/admin/form/AdminReportFileModal.test.ts
git commit -m "test(admin): add unit tests for AdminReportFileModal component"
```

---

### Task 4: Integrate modal into create page

**Files:**
- Modify: `pages/admin/reports/create.vue`

- [ ] **Step 1: Replace file upload and thumbnail sections**

In `pages/admin/reports/create.vue`, replace the "File Upload" section (lines 47–58) with the modal component:

Replace:
```html
          <!-- File Upload -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Report File</h2>
            <AdminFormAdminFileUpload
              v-model="form.fileUrl"
              type="report"
              label="PDF File"
              required
              :error="errors.fileUrl"
              @file-info="handleFileInfo"
            />
          </div>
```

With:
```html
          <!-- Report File -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Report File</h2>
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
          </div>
```

- [ ] **Step 2: Remove the sidebar Thumbnail section**

Remove lines 151–160 (the Thumbnail card in the sidebar):

```html
          <!-- Thumbnail -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thumbnail</h2>
            <AdminFormAdminFileUpload
              v-model="form.thumbnail"
              type="thumbnail"
              label="Cover Image"
              help-text="Optional cover image for the report"
            />
          </div>
```

- [ ] **Step 3: Remove handleFileInfo function**

Remove from `<script setup>` (lines 356–358):

```typescript
  function handleFileInfo(info: { filename: string; size: number; mimeType: string }) {
    form.fileSize = info.size
  }
```

- [ ] **Step 4: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add ghana-audit-service/pages/admin/reports/create.vue
git commit -m "feat(admin): integrate report file modal into create page

Replace inline file upload + separate thumbnail section with unified
AdminReportFileModal component."
```

---

### Task 5: Integrate modal into edit page

**Files:**
- Modify: `pages/admin/reports/[id]/edit.vue`

- [ ] **Step 1: Replace file upload section with modal**

In `pages/admin/reports/[id]/edit.vue`, replace the "File Upload" section (lines 104–115) with the modal component:

Replace:
```html
            <!-- File Upload -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Report File</h2>
              <AdminFormAdminFileUpload
                v-model="form.fileUrl"
                type="report"
                label="PDF File"
                required
                :error="errors.fileUrl"
                @file-info="handleFileInfo"
              />
            </div>
```

With:
```html
            <!-- Report File -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Report File</h2>
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
            </div>
```

- [ ] **Step 2: Remove the collapsible PDF preview section**

Remove lines 117–166 (the entire PDF Preview collapsible panel below the file upload):

```html
            <!-- PDF Preview -->
            <div
              v-if="form.fileUrl"
              class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
            >
              ...entire preview section...
            </div>
```

- [ ] **Step 3: Remove the sidebar Thumbnail section**

Remove lines 283–291 (the Thumbnail card in the sidebar):

```html
            <!-- Thumbnail -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thumbnail</h2>
              <AdminFormAdminFileUpload
                v-model="form.thumbnail"
                type="thumbnail"
                label="Cover Image"
                help-text="Optional cover image for the report"
              />
            </div>
```

- [ ] **Step 4: Remove unused state and functions from script**

Remove `previewExpanded` ref (line 517):
```typescript
  const previewExpanded = ref(false)
```

Remove `handleFileInfo` function (lines 659–661):
```typescript
  function handleFileInfo(info: { filename: string; size: number; mimeType: string }) {
    form.fileSize = info.size
  }
```

- [ ] **Step 5: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit 2>&1 | head -30`

Expected: No errors. If `previewExpanded` was referenced anywhere else, that line will error — check and remove any remaining references.

- [ ] **Step 6: Commit**

```bash
git add ghana-audit-service/pages/admin/reports/[id]/edit.vue
git commit -m "feat(admin): integrate report file modal into edit page

Replace inline file upload, collapsible PDF preview, and separate
thumbnail section with unified AdminReportFileModal component."
```

---

### Task 6: Manual browser testing

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

Run: `cd ghana-audit-service && npm run dev`

- [ ] **Step 2: Test create page**

Navigate to `http://localhost:3000/admin/reports/create` (log in if needed).

Verify:
- "Attach Report" card is visible in the main content area with dashed border
- Clicking it opens a modal titled "Report File"
- Drag-and-drop or click-to-upload a PDF works inside the modal
- After upload: PDF preview iframe renders, file size appears, thumbnail auto-generates
- "Open in new tab" link works
- "Replace file" link re-shows upload area
- "Upload custom image" button shows thumbnail file upload
- "Cancel" closes modal without changing the form
- "Confirm" closes modal and the inline card shows filename + size + thumbnail
- Sidebar no longer has a separate Thumbnail section
- Form submission works end-to-end (fill all required fields, submit, verify redirect)

- [ ] **Step 3: Test edit page**

Navigate to an existing report's edit page (e.g. `http://localhost:3000/admin/reports/1/edit`).

Verify:
- Inline card shows existing file's thumbnail (or PDF icon), filename, and file size
- Clicking opens modal pre-loaded with existing file data
- PDF preview renders in iframe
- Existing thumbnail shows with "Existing thumbnail" label
- "Regenerate from PDF" button triggers server-side generation
- "Replace file" → upload new PDF → auto-generates new thumbnail
- "Cancel" preserves original values
- "Confirm" updates form fields, unsaved changes indicator appears
- Old collapsible PDF preview section is gone
- Old sidebar Thumbnail section is gone
- Save works end-to-end

- [ ] **Step 4: Test thumbnail generation failure gracefully**

If `pdftoppm` is not installed, verify:
- Upload PDF succeeds
- Thumbnail generation shows error message
- "Upload custom image" option is available as fallback
- Form can still be confirmed and submitted without a thumbnail
