<template>
  <AdminFormGroup
    :id="id"
    :label="label"
    :required="required"
    :error="error || uploadError || undefined"
    :help-text="helpText"
  >
    <div
      :class="[
        'relative border-2 border-dashed rounded-lg transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
        error || uploadError ? 'border-red-500' : ''
      ]"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <!-- Preview -->
      <div v-if="previewUrl || fileUrl" class="relative p-4">
        <!-- Image Preview -->
        <div v-if="isImage" class="flex items-center gap-4">
          <UiBaseImage
            :src="previewUrl || fileUrl"
            :alt="fileName || 'Preview'"
            class="w-20 h-20 object-cover rounded-lg"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ fileName || 'Uploaded file' }}
            </p>
            <p v-if="fileSize" class="text-xs text-gray-500">
              {{ formatFileSize(fileSize) }}
            </p>
          </div>
        </div>

        <!-- PDF/File Preview -->
        <div v-else class="flex items-center gap-4">
          <div
            class="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center"
          >
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              {{ fileName || 'Uploaded file' }}
            </p>
            <p v-if="fileSize" class="text-xs text-gray-500">
              {{ formatFileSize(fileSize) }}
            </p>
          </div>
        </div>

        <!-- Remove Button -->
        <button
          type="button"
          aria-label="Remove file"
          class="absolute top-2 right-2 p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          @click="clearFile"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Upload Area -->
      <div v-else class="p-6 text-center">
        <input
          :id="inputId"
          type="file"
          :accept="acceptedTypes"
          class="hidden"
          :disabled="uploading"
          @change="handleFileSelect"
        />

        <label :for="inputId" class="cursor-pointer">
          <div
            class="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3"
          >
            <svg
              v-if="uploading"
              class="w-6 h-6 text-primary animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <svg
              v-else
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

          <p class="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
            <span v-if="uploading">
              Uploading{{ uploadProgress !== null ? ` ${uploadProgress}%` : '...' }}
            </span>
            <span v-else>
              <span class="text-primary font-medium">Click to upload</span>
              or drag and drop
            </span>
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ acceptLabel }} (max {{ formatFileSize(maxSize) }})
          </p>
          <div
            v-if="uploading && uploadProgress !== null"
            class="mt-3 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-label="Upload progress"
            :aria-valuenow="uploadProgress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="h-2 bg-primary transition-all duration-200"
              :style="{ width: `${uploadProgress}%` }"
            />
          </div>
        </label>
      </div>
    </div>
  </AdminFormGroup>
</template>

<script setup lang="ts">
  import type { ReportUploadJob, UploadResponse } from '~/types/admin'

  interface Props {
    modelValue?: string | null
    label?: string
    id?: string
    type?: 'report' | 'publication' | 'image' | 'thumbnail'
    required?: boolean
    error?: string
    helpText?: string
    /** Compression preset for background report uploads (type = report). */
    preset?: 'screen' | 'ebook' | 'printer'
  }

  const props = withDefaults(defineProps<Props>(), {
    type: 'image',
    modelValue: '',
    label: undefined,
    id: undefined,
    required: false,
    error: undefined,
    helpText: undefined,
    preset: 'ebook'
  })

  // Generate a unique ID if not provided
  const inputId = computed(
    () => props.id || `file-upload-${Math.random().toString(36).slice(2, 9)}`
  )

  // Convert null to empty string
  const fileUrl = computed(() => props.modelValue ?? '')

  const emit = defineEmits<{
    'update:modelValue': [value: string]
    'file-info': [info: { filename: string; size: number; mimeType: string }]
    // Report uploads hand off to a server-side job once the bytes land
    // (store → thumbnail → optimize); the parent follows it by id.
    'upload-job': [job: ReportUploadJob]
  }>()

  const api = useAdminApi()
  const notifications = useAdminNotifications()

  const isDragging = ref(false)
  const uploading = ref(false)
  // Byte-transfer progress (0–100) while the request body is being sent.
  const uploadProgress = ref<number | null>(null)
  const uploadError = ref<string | null>(null)
  const previewUrl = ref<string | null>(null)
  const fileName = ref<string | null>(null)
  const fileSize = ref<number | null>(null)
  // Set once this field leaves the page; uploads still in flight then report
  // only through the notification center.
  let unmounted = false

  // File type configurations
  const typeConfig: Record<string, { accept: string[]; label: string; maxSize: number }> = {
    report: {
      accept: ['application/pdf'],
      label: 'PDF files',
      maxSize: 100 * 1024 * 1024
    },
    publication: {
      accept: ['application/pdf'],
      label: 'PDF files',
      maxSize: 10 * 1024 * 1024
    },
    image: {
      accept: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      label: 'JPG, PNG, WebP or GIF',
      maxSize: 5 * 1024 * 1024
    },
    thumbnail: {
      accept: ['image/jpeg', 'image/png', 'image/webp'],
      label: 'JPG, PNG or WebP',
      maxSize: 2 * 1024 * 1024
    }
  }

  const config = computed(() => typeConfig[props.type])
  const acceptedTypes = computed(() => config.value.accept.join(','))
  const acceptLabel = computed(() => config.value.label)
  const maxSize = computed(() => config.value.maxSize)
  const isImage = computed(() => props.type === 'image' || props.type === 'thumbnail')

  // Handle file selection
  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      await uploadFile(file)
    }
    // Reset input
    input.value = ''
  }

  // Handle drag & drop
  async function handleDrop(event: DragEvent) {
    isDragging.value = false
    const file = event.dataTransfer?.files?.[0]
    if (file) {
      await uploadFile(file)
    }
  }

  // Upload file
  async function uploadFile(file: File) {
    uploadError.value = null

    // Validate file type
    if (!config.value.accept.includes(file.type)) {
      uploadError.value = `Invalid file type. Please upload ${acceptLabel.value}`
      return
    }

    // Validate file size
    if (file.size > maxSize.value) {
      uploadError.value = `File is too large. Maximum size is ${formatFileSize(maxSize.value)}`
      return
    }

    uploading.value = true
    uploadProgress.value = 0

    // A-G reports run to 100MB: follow the transfer in the notification
    // center too, so it stays visible if the admin closes the dialog or
    // leaves the page. Once the bytes land, the server job takes over.
    const transfer =
      props.type === 'report'
        ? notifications.startTask({
            category: 'upload',
            title: 'Uploading report',
            subject: file.name,
            meta: formatFileSize(file.size),
            progress: 0,
            progressLabel: 'Sending file to the server…'
          })
        : null

    try {
      const onProgress = (fraction: number) => {
        uploadProgress.value = Math.round(fraction * 100)
        transfer?.update({ progress: uploadProgress.value })
      }
      let response: UploadResponse
      let job: ReportUploadJob | null = null
      if (props.type === 'report') {
        const reportResponse = await api.uploadReport(file, { preset: props.preset, onProgress })
        job = reportResponse.job
        response = reportResponse
        notifications.trackUploadJob(job)
        transfer?.remove()
      } else {
        response = await api.upload(file, props.type, { onProgress })
      }

      // Set preview
      if (isImage.value) {
        previewUrl.value = URL.createObjectURL(file)
      }

      fileName.value = response.originalName
      fileSize.value = response.size

      // Emit URL
      emit('update:modelValue', response.url)
      emit('file-info', {
        filename: response.filename,
        size: response.size,
        mimeType: response.mimeType
      })
      if (job) emit('upload-job', job)
    } catch (e: unknown) {
      const error = e as { data?: { message?: string }; message?: string }
      uploadError.value = error.data?.message || error.message || 'Upload failed'
      transfer?.fail({
        title: 'Report upload failed',
        notes: [{ text: uploadError.value, tone: 'error' }],
        // The inline error already says so while this field is on screen.
        toast: unmounted
      })
    } finally {
      uploading.value = false
      uploadProgress.value = null
    }
  }

  // Clear file
  function clearFile() {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }
    previewUrl.value = null
    fileName.value = null
    fileSize.value = null
    uploadError.value = null
    emit('update:modelValue', '')
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Cleanup on unmount. An upload in flight keeps going; it reports through
  // the notification center from then on.
  onUnmounted(() => {
    unmounted = true
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }
  })
</script>
