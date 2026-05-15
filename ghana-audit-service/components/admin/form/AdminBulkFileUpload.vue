<template>
  <div class="space-y-4">
    <div
      :class="[
        'relative rounded-lg border-2 border-dashed transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
      ]"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <div class="p-6 text-center">
        <input
          :id="inputId"
          type="file"
          :accept="acceptedTypes"
          multiple
          class="hidden"
          :disabled="uploading"
          @change="handleFileSelect"
        />

        <label :for="inputId" class="cursor-pointer">
          <div
            class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
          >
            <svg
              class="h-6 w-6 text-gray-400"
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
            <span class="font-medium text-primary">Click to select images</span>
            or drag and drop
          </p>
          <p class="mt-1 text-xs text-gray-500">
            JPG, PNG, WebP or GIF — up to {{ maxPerBatch }} files, {{ formatSize(maxSize) }} each
          </p>
        </label>
      </div>
    </div>

    <div v-if="items.length > 0" class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium text-gray-700 dark:text-gray-300">
          {{ completedCount }} / {{ items.length }} uploaded
        </span>
        <button
          v-if="!uploading && completedCount < items.length"
          type="button"
          class="text-xs text-gray-500 hover:text-red-600 dark:hover:text-red-400"
          @click="reset"
        >
          Clear all
        </button>
      </div>

      <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div class="h-full bg-primary transition-all" :style="{ width: `${progressPercent}%` }" />
      </div>

      <ul class="space-y-3">
        <li
          v-for="(item, index) in items"
          :key="item.localId"
          class="flex gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <img
            :src="item.previewUrl"
            :alt="item.file.name"
            class="h-16 w-16 flex-shrink-0 rounded object-cover"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                {{ item.file.name }}
              </p>
              <span class="text-xs" :class="statusClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </div>
            <p class="text-xs text-gray-500">
              {{ formatSize(item.file.size) }}
            </p>
            <div v-if="showFields" class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                v-model="item.alt"
                type="text"
                placeholder="Alt text (accessibility)"
                class="form-input text-xs"
              />
              <input
                v-model="item.caption"
                type="text"
                placeholder="Caption (optional)"
                class="form-input text-xs"
              />
            </div>
            <p v-if="item.error" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ item.error }}
            </p>
          </div>
          <div class="flex flex-col gap-1">
            <button
              v-if="item.status === 'error'"
              type="button"
              class="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
              :disabled="uploading"
              @click="retry(index)"
            >
              Retry
            </button>
            <button
              v-if="item.status === 'queued' || item.status === 'error'"
              type="button"
              class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
              :disabled="uploading"
              @click="removeItem(index)"
            >
              Remove
            </button>
          </div>
        </li>
      </ul>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="uploading || items.length === 0 || completedCount === items.length"
          @click="startUpload"
        >
          {{ uploading ? 'Uploading…' : 'Upload all' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  type Status = 'queued' | 'uploading' | 'done' | 'error'

  interface Item {
    localId: string
    file: File
    previewUrl: string
    status: Status
    error: string | null
    url: string | null
    alt: string
    caption: string
  }

  interface Props {
    maxPerBatch?: number
    showFields?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    maxPerBatch: 50,
    showFields: true
  })

  const emit = defineEmits<{
    complete: [
      payload: {
        url: string
        translations: { en: { alt: string | null; caption: string | null } }
      }[]
    ]
  }>()

  const api = useAdminApi()

  const inputId = `bulk-upload-${Math.random().toString(36).slice(2, 9)}`
  const acceptedTypes = 'image/jpeg,image/png,image/webp,image/gif'
  const maxSize = 5 * 1024 * 1024

  const isDragging = ref(false)
  const uploading = ref(false)
  const items = ref<Item[]>([])

  const completedCount = computed(() => items.value.filter((i) => i.status === 'done').length)
  const progressPercent = computed(() =>
    items.value.length === 0 ? 0 : Math.round((completedCount.value / items.value.length) * 100)
  )

  function statusLabel(status: Status): string {
    return { queued: 'Queued', uploading: 'Uploading…', done: 'Done', error: 'Failed' }[status]
  }

  function statusClass(status: Status): string {
    return {
      queued: 'text-gray-500',
      uploading: 'text-blue-600 dark:text-blue-400',
      done: 'text-green-600 dark:text-green-400',
      error: 'text-red-600 dark:text-red-400'
    }[status]
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function addFiles(files: FileList | File[]) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const arr = Array.from(files)
    for (const file of arr) {
      if (items.value.length >= props.maxPerBatch) break
      if (!allowed.includes(file.type)) {
        items.value.push({
          localId: crypto.randomUUID(),
          file,
          previewUrl: '',
          status: 'error',
          error: 'Unsupported file type',
          url: null,
          alt: '',
          caption: ''
        })
        continue
      }
      if (file.size > maxSize) {
        items.value.push({
          localId: crypto.randomUUID(),
          file,
          previewUrl: '',
          status: 'error',
          error: `File exceeds ${formatSize(maxSize)}`,
          url: null,
          alt: '',
          caption: ''
        })
        continue
      }
      items.value.push({
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued',
        error: null,
        url: null,
        alt: deriveDefaultAlt(file.name),
        caption: ''
      })
    }
  }

  function deriveDefaultAlt(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim()
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files) addFiles(input.files)
    input.value = ''
  }

  function handleDrop(event: DragEvent) {
    isDragging.value = false
    if (event.dataTransfer?.files) addFiles(event.dataTransfer.files)
  }

  async function uploadOne(item: Item) {
    item.status = 'uploading'
    item.error = null
    try {
      const response = await api.upload(item.file, 'image')
      item.url = response.url
      item.status = 'done'
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      item.error = err.data?.message || err.message || 'Upload failed'
      item.status = 'error'
    }
  }

  async function startUpload() {
    if (uploading.value) return
    uploading.value = true
    try {
      for (const item of items.value) {
        if (item.status === 'done') continue
        if (item.status === 'error' && !item.previewUrl) continue
        await uploadOne(item)
      }
      const successful = items.value
        .filter((i) => i.status === 'done' && i.url)
        .map((i) => ({
          url: i.url as string,
          translations: {
            en: { alt: i.alt || null, caption: i.caption || null }
          }
        }))
      emit('complete', successful)
    } finally {
      uploading.value = false
    }
  }

  async function retry(index: number) {
    const item = items.value[index]
    if (!item) return
    uploading.value = true
    try {
      await uploadOne(item)
    } finally {
      uploading.value = false
    }
  }

  function removeItem(index: number) {
    const item = items.value[index]
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    items.value.splice(index, 1)
  }

  function reset() {
    for (const item of items.value) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    items.value = []
  }

  defineExpose({ reset, items })

  onUnmounted(() => {
    for (const item of items.value) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
  })
</script>
