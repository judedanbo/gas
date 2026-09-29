<template>
  <div>
    <!-- Inline Card -->
    <AdminFormGroup :label="label" :required="required" :error="error || undefined">
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
            <span class="text-primary font-medium">Attach {{ label }}</span>
          </p>
          <p class="text-xs text-gray-500 mt-1">PDF files</p>
        </div>

        <!-- File attached state -->
        <div
          v-else
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <UiBaseImage
            v-if="cardThumbnail"
            :src="cardThumbnail"
            alt="Report thumbnail"
            class="w-14 h-14 object-cover rounded-lg flex-shrink-0"
          />
          <div
            v-else
            class="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center flex-shrink-0"
          >
            <svg class="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              {{ formatBytes(cardFileSize) }}
            </p>
          </div>
          <span class="text-xs text-primary font-medium flex-shrink-0">Change</span>
        </div>
      </button>
    </AdminFormGroup>

    <!-- Modal -->
    <UiBaseModal v-model="isOpen" :title="label" size="full" max-height="80vh">
      <div class="space-y-6">
        <!-- Upload Area (shown when no file or replacing) -->
        <div v-if="!modalFileUrl || isReplacing">
          <AdminFormAdminFileUpload
            :model-value="''"
            :type="resource === 'reports' ? 'report' : 'publication'"
            :preset="optimizePreset"
            label="Upload PDF"
            required
            @update:model-value="handleUploadComplete"
            @file-info="handleUploadFileInfo"
            @upload-job="handleUploadJob"
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

        <!-- Compression preset selector (reports only) -->
        <div
          v-if="resource === 'reports' && !modalFileUrl"
          class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4"
        >
          <label
            for="optimize-preset"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Compression
          </label>
          <select
            id="optimize-preset"
            v-model="optimizePreset"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="ebook">Balanced (150 DPI, recommended)</option>
            <option value="screen">Aggressive (72 DPI, smallest file)</option>
            <option value="printer">Conservative (300 DPI, print-quality)</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">
            Only images are downsampled. Vector text, tables, and charts are preserved.
          </p>
        </div>

        <!-- Background upload job (reports only): store → thumbnail → optimize
             runs server-side; this follows it by polling. -->
        <div
          v-if="
            resource === 'reports' &&
            modalFileUrl &&
            followedJob &&
            optimization.status.value === 'idle'
          "
          class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4"
        >
          <AdminUiAdminUploadJobProgress :job="followedJob" />
          <p v-if="followedJob.active" class="text-xs text-gray-500 mt-2">
            You can confirm now — processing continues in the background.
          </p>
          <button
            v-if="followedJob.status === 'completed' && followedJob.errorCode === 'HAS_BOOKMARKS'"
            type="button"
            class="btn btn-ghost text-sm mt-2"
            @click="retryWithBookmarksDropped"
          >
            Optimize anyway (drops bookmarks)
          </button>
        </div>

        <!-- Optimization progress / result panel (reports only; explicit
             retry from this modal) -->
        <div
          v-if="resource === 'reports' && modalFileUrl && optimization.status.value !== 'idle'"
          class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4"
          aria-live="polite"
        >
          <div v-if="optimization.isRunning.value" class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-gray-700 dark:text-gray-300">
                {{ optimizationPhaseLabel(optimization.phase.value) }}
              </span>
              <span
                v-if="
                  (optimization.phase.value === 'classify' || optimization.phase.value === 'ocr') &&
                  optimization.totalPages.value > 0
                "
                class="text-gray-500"
              >
                Page {{ optimization.page.value }} of {{ optimization.totalPages.value }}
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
              <div
                class="h-2 bg-primary transition-all duration-200"
                :style="{ width: `${optimization.progress.value}%` }"
              />
            </div>
            <p
              v-if="optimization.nativePages.value > 0 || optimization.scannedPages.value > 0"
              class="text-xs text-gray-500"
            >
              {{ optimization.nativePages.value }} native ·
              {{ optimization.scannedPages.value }} scanned
            </p>
            <p class="text-xs text-gray-500">
              You can confirm now — optimization continues in the background.
            </p>
          </div>

          <div
            v-else-if="optimization.status.value === 'success' && optimization.result.value"
            class="text-sm space-y-1"
          >
            <p
              v-if="optimization.result.value.skippedCompression"
              class="text-gray-600 dark:text-gray-300"
            >
              File was already well-compressed; original kept.
            </p>
            <p v-else class="text-green-700 dark:text-green-400 font-medium">
              Reduced {{ formatBytes(optimization.result.value.originalSize) }} &rarr;
              {{ formatBytes(optimization.result.value.optimizedSize) }} (saved
              {{ formatBytes(optimization.result.value.savedBytes) }})
            </p>
            <p class="text-xs text-gray-500">
              {{ optimization.result.value.nativePages }} native ·
              {{ optimization.result.value.scannedPages }} scanned
            </p>
            <p
              v-if="(optimization.result.value.ocrFailedPages ?? 0) > 0"
              class="text-xs text-amber-600 dark:text-amber-400"
            >
              {{ optimization.result.value.ocrFailedPages }} page(s) could not be OCR-processed and
              were kept as scans.
            </p>
          </div>

          <div v-else-if="optimization.status.value === 'error'" class="text-sm space-y-2">
            <p class="text-amber-700 dark:text-amber-400">
              {{ optimization.errorMessage.value }}
            </p>
            <p class="text-xs text-gray-500">
              The original file will be used. You can retry from the edit page.
            </p>
            <button
              v-if="optimization.errorCode.value === 'HAS_BOOKMARKS'"
              type="button"
              class="btn btn-ghost text-sm"
              @click="retryWithBookmarksDropped"
            >
              Optimize anyway (drops bookmarks)
            </button>
          </div>
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
                  {{ formatBytes(modalFileSize) }}
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
              <iframe :src="modalFileUrl" class="w-full h-[400px]" title="PDF Preview" />
              <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 text-sm">
                <a
                  :href="modalFileUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open in new tab
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <p class="text-sm text-gray-500 dark:text-gray-400">Generating thumbnail...</p>
                </div>
                <UiBaseImage
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
                  <template v-else-if="thumbnailSource === 'custom'"> Custom upload </template>
                  <template v-else-if="thumbnailSource === 'existing'">
                    Existing thumbnail
                  </template>
                  <template v-else> No thumbnail set </template>
                </p>

                <p v-if="thumbnailError" class="text-sm text-amber-600 dark:text-amber-400">
                  {{ thumbnailError }}
                </p>

                <div v-if="!isUploadingCustomThumbnail" class="space-y-2">
                  <button
                    type="button"
                    class="btn btn-ghost text-sm w-full"
                    :disabled="thumbnailGenerating || fileNotYetStored"
                    :title="
                      fileNotYetStored ? 'Available once the file is saved to storage' : undefined
                    "
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
  import { useOptimizePreset } from '~/composables/useReportOptimization'
  import { formatBytes } from '~/utils/formatBytes'
  import { optimizationPhaseLabel } from '~/utils/reportOptimizationUi'
  import type { ReportOptimizationMeta, ReportUploadJob } from '~/types/admin'

  export interface OptimizationSnapshot {
    optimizedAt: string
    meta: ReportOptimizationMeta
  }

  interface Props {
    resource: 'reports' | 'publications'
    label?: string
    fileUrl?: string | null
    fileSize?: number | null
    thumbnail?: string | null
    error?: string
    required?: boolean
    reportId?: number | null
    /** Background upload job for the committed fileUrl (re-followed on open). */
    uploadJobId?: string | null
  }

  const props = withDefaults(defineProps<Props>(), {
    label: 'File',
    fileUrl: null,
    fileSize: null,
    thumbnail: null,
    error: undefined,
    required: false,
    reportId: null,
    uploadJobId: null
  })

  const emit = defineEmits<{
    'update:fileUrl': [url: string]
    'update:fileSize': [size: number | undefined]
    'update:thumbnail': [url: string]
    // Result snapshot of a completed optimization, for the create flow to
    // send with its POST (a saved report gets this persisted server-side
    // instead). null when no optimization finished for the confirmed file.
    'update:optimization': [snapshot: OptimizationSnapshot | null]
    // Id of the background upload job that produced the confirmed file
    // (null for publications / files without a job). Sent with the save so
    // the server links the report to the job.
    'update:uploadJob': [jobId: string | null]
  }>()

  const api = useAdminApi()
  const optimization = useReportOptimization()
  // Follows the server-side upload pipeline for the file in the modal.
  const uploadJob = useReportUploadJob()

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

  // Compression preset for the optimization pipeline. Only applies to
  // reports — publications skip optimization. Shared with the edit page.
  const optimizePreset = useOptimizePreset()

  // What the card displays (committed values from props)
  const cardFileUrl = computed(() => props.fileUrl || null)
  const cardFileSize = computed(() => props.fileSize || null)
  const cardThumbnail = computed(() => props.thumbnail || null)

  const displayFilename = computed(() => extractFilename(cardFileUrl.value))

  // The followed job, but only while it is the file currently in the modal
  // (a replacement upload starts a new job).
  const followedJob = computed<ReportUploadJob | null>(() => {
    const job = uploadJob.job.value
    return job && job.fileUrl === modalFileUrl.value ? job : null
  })

  // Until the pipeline has stored the bytes, server-side thumbnail
  // regeneration would find nothing to render.
  const fileNotYetStored = computed(() => {
    const job = followedJob.value
    return Boolean(job && (job.status === 'queued' || job.status === 'storing'))
  })

  // Mirror pipeline outputs into the modal as they arrive: the generated
  // cover (unless the admin picked a custom one) and the post-optimization
  // size.
  watch(uploadJob.job, (job) => {
    if (!job || job.fileUrl !== modalFileUrl.value) return
    if (job.thumbnailUrl && thumbnailSource.value !== 'custom' && !modalThumbnail.value) {
      modalThumbnail.value = job.thumbnailUrl
      thumbnailSource.value = 'generated'
    }
    if (job.status === 'completed' && job.finalSize) {
      modalFileSize.value = job.finalSize
    }
  })

  function extractFilename(url: string | null): string {
    if (!url) return ''
    return url.split('/').pop() || url
  }

  function openModal() {
    modalFileUrl.value = props.fileUrl || null
    modalFileSize.value = props.fileSize || null
    modalThumbnail.value = props.thumbnail || null
    thumbnailSource.value = props.thumbnail ? 'existing' : null
    thumbnailError.value = null
    isReplacing.value = false
    isUploadingCustomThumbnail.value = false
    optimization.reset()
    uploadJob.reset()
    // Re-follow the job behind the committed file so reopening the modal
    // shows where the pipeline is (it may still be optimizing).
    if (props.resource === 'reports' && props.uploadJobId && props.fileUrl) {
      uploadJob.follow(props.uploadJobId)
    }
    isOpen.value = true
  }

  async function handleUploadComplete(url: string) {
    modalFileUrl.value = url
    isReplacing.value = false
    thumbnailError.value = null
    modalThumbnail.value = null
    thumbnailSource.value = null
    optimization.reset()

    // Reports: the server pipeline (store → thumbnail → optimize) took over
    // the moment the bytes landed; handleUploadJob follows it. The admin can
    // confirm/save at any point — the server patches the row when done.
    // Publications still thumbnail synchronously here.
    if (props.resource !== 'reports') {
      generateThumbnail()
    }
  }

  function handleUploadJob(job: ReportUploadJob) {
    uploadJob.follow(job)
  }

  async function runOptimization(opts?: { allowDropBookmarks?: boolean }) {
    if (!modalFileUrl.value) return
    await optimization.start({
      fileUrl: modalFileUrl.value,
      preset: optimizePreset.value,
      reportId: props.reportId,
      allowDropBookmarks: opts?.allowDropBookmarks
    })
    // The pipeline replaces the file in place, so the URL is unchanged.
    // Pick up the new size when the optimizer reports it.
    if (optimization.result.value && !optimization.result.value.skippedCompression) {
      modalFileSize.value = optimization.result.value.optimizedSize
    }
  }

  function retryWithBookmarksDropped() {
    runOptimization({ allowDropBookmarks: true })
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
        `${props.resource}/generate-thumbnail`,
        { fileUrl: modalFileUrl.value }
      )
      modalThumbnail.value = result.thumbnailUrl
      thumbnailSource.value = 'generated'
    } catch {
      thumbnailError.value = 'Thumbnail generation failed. You can upload a custom image instead.'
    } finally {
      thumbnailGenerating.value = false
    }
  }

  function handleCustomThumbnail(url: string) {
    modalThumbnail.value = url
    thumbnailSource.value = 'custom'
    isUploadingCustomThumbnail.value = false
  }

  function optimizationSnapshot(): OptimizationSnapshot | null {
    if (props.resource !== 'reports') return null

    // Explicit retry from this modal (bookmark drop) — freshest result wins.
    const r = optimization.result.value
    if (optimization.status.value === 'success' && r) {
      return {
        optimizedAt: new Date().toISOString(),
        meta: {
          preset: optimizePreset.value,
          originalSize: r.originalSize,
          optimizedSize: r.optimizedSize,
          savedBytes: r.savedBytes,
          pageCount: r.pageCount ?? optimization.totalPages.value,
          nativePages: r.nativePages,
          scannedPages: r.scannedPages,
          ocrFailedPages: r.ocrFailedPages ?? 0,
          skippedCompression: r.skippedCompression
        }
      }
    }

    // Background pipeline finished while the modal was open.
    const job = followedJob.value
    if (
      job &&
      job.status === 'completed' &&
      job.optimizationStatus === 'success' &&
      job.optimizationResult
    ) {
      return {
        optimizedAt: job.completedAt ?? new Date().toISOString(),
        meta: job.optimizationResult
      }
    }
    return null
  }

  function handleConfirm() {
    emit('update:fileUrl', modalFileUrl.value || '')
    emit('update:fileSize', modalFileSize.value || undefined)
    emit('update:thumbnail', modalThumbnail.value || '')
    emit('update:optimization', optimizationSnapshot())
    emit('update:uploadJob', followedJob.value?.id ?? null)
    // The page follows the job from here (create/edit pages poll it).
    uploadJob.stop()
    isOpen.value = false
  }

  function handleCancel() {
    uploadJob.stop()
    isOpen.value = false
  }
</script>
