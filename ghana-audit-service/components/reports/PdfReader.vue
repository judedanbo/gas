<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
    :class="expanded ? 'fixed inset-0 z-[300] rounded-none border-0' : ''"
  >
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
        <Icon name="heroicons:document-text" class="w-4 h-4 inline -mt-0.5 mr-1" aria-hidden="true" />
        Report Viewer
      </h2>
      <div v-if="!loadError" class="flex items-center gap-1">
        <a
          :href="fileUrl"
          download
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :aria-label="$t('common.downloadPdf')"
        >
          <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" aria-hidden="true" />
          <span class="hidden sm:inline">Download</span>
        </a>
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :aria-label="expanded ? 'Exit fullscreen' : 'Enter fullscreen'"
          @click="toggleExpand"
        >
          <Icon :name="expanded ? 'heroicons:arrows-pointing-in' : 'heroicons:arrows-pointing-out'" class="w-4 h-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ expanded ? 'Exit' : 'Expand' }}</span>
        </button>
      </div>
      <div v-else>
        <button
          v-if="expanded"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Exit fullscreen"
          @click="toggleExpand"
        >
          <Icon name="heroicons:arrows-pointing-in" class="w-4 h-4" aria-hidden="true" />
          <span class="hidden sm:inline">Exit</span>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="checking" class="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-[40vh]">
      <UiLoadingSpinner />
    </div>

    <!-- Error state: report unavailable -->
    <div
      v-else-if="loadError"
      class="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900"
      :class="expanded ? '' : 'min-h-[50vh]'"
    >
      <div class="text-center max-w-md">
        <Icon name="heroicons:exclamation-circle" class="w-14 h-14 text-secondary/70 mx-auto mb-4" aria-hidden="true" />
        <h3 class="text-lg font-heading font-semibold text-gray-900 dark:text-white mb-2">
          Report Temporarily Unavailable
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          We're unable to load this report right now. The file may have been moved or is being updated. Please check back later or let us know so we can fix it.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <NuxtLink
            :to="reportIssueLink"
            class="btn-primary btn-sm inline-flex items-center gap-2"
          >
            <Icon name="heroicons:envelope" class="w-4 h-4" aria-hidden="true" />
            Report This Issue
          </NuxtLink>
          <button class="btn-outline btn-sm inline-flex items-center gap-2" @click="retryLoad">
            <Icon name="heroicons:arrow-path" class="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      </div>
    </div>

    <!-- PDF iframe (hidden on mobile) -->
    <template v-else>
      <iframe
        :src="viewUrl"
        :title="title"
        class="w-full flex-1 bg-gray-100 dark:bg-gray-700 hidden sm:block"
        :class="expanded ? '' : 'min-h-[70vh]'"
      />

      <!-- Mobile fallback -->
      <div class="flex-1 flex sm:hidden items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-[40vh]">
        <div class="text-center max-w-sm">
          <Icon name="heroicons:document-arrow-down" class="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            Download the PDF to read this report on your device.
          </p>
          <a :href="fileUrl" download class="btn-primary btn-sm inline-flex items-center gap-2">
            <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" aria-hidden="true" />
            Download PDF
          </a>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    fileUrl: string
    title?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    title: 'Audit Report PDF'
  })

  const viewUrl = computed(() => {
    const separator = props.fileUrl.includes('?') ? '&' : '?'
    return `${props.fileUrl}${separator}view=1`
  })

  const reportIssueLink = computed(() => ({
    path: '/contact',
    hash: '#send-message',
    query: {
      subject: 'report',
      message: `I would like to report a broken link for the report: ${props.title}. The download link does not appear to be working.`
    }
  }))

  const expanded = ref(false)
  const loadError = ref(false)
  const checking = ref(true)

  async function checkUrl() {
    checking.value = true
    loadError.value = false
    try {
      const response = await fetch(viewUrl.value)
      loadError.value = !response.ok
      response.body?.cancel()
    } catch {
      loadError.value = true
    } finally {
      checking.value = false
    }
  }

  function retryLoad() {
    checkUrl()
  }

  function toggleExpand() {
    expanded.value = !expanded.value
    document.body.style.overflow = expanded.value ? 'hidden' : ''
  }

  onMounted(() => {
    checkUrl()
  })

  onUnmounted(() => {
    document.body.style.overflow = ''
  })
</script>
