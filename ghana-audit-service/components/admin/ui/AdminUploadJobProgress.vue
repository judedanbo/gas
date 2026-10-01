<template>
  <div class="space-y-2" aria-live="polite">
    <div class="flex items-center justify-between gap-3 text-sm">
      <span
        :class="[
          'font-medium',
          job.status === 'failed'
            ? 'text-red-700 dark:text-red-400'
            : job.status === 'completed'
              ? 'text-green-700 dark:text-green-400'
              : 'text-gray-700 dark:text-gray-300'
        ]"
      >
        {{ stageLabel }}
      </span>
      <span v-if="pageLabel" class="text-gray-500 dark:text-gray-400 flex-shrink-0">
        {{ pageLabel }}
      </span>
      <span
        v-else-if="job.active"
        class="text-gray-500 dark:text-gray-400 flex-shrink-0 tabular-nums"
      >
        {{ job.progress }}%
      </span>
    </div>

    <div
      v-if="job.active || job.status === 'completed'"
      class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden"
      role="progressbar"
      :aria-label="`Upload progress for ${job.originalName}`"
      :aria-valuenow="job.progress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${job.progress}% — ${stageLabel}`"
    >
      <div
        :class="[
          'h-2 transition-all duration-300',
          job.status === 'completed' ? 'bg-green-600' : 'bg-primary'
        ]"
        :style="{ width: `${job.progress}%` }"
      />
    </div>

    <p v-if="resumeNote" class="text-xs text-gray-500 dark:text-gray-400">
      {{ resumeNote }}
    </p>
    <p v-if="resultSummary" class="text-xs text-gray-600 dark:text-gray-300">
      {{ resultSummary }}
    </p>
    <p v-if="ocrFailedPages > 0" class="text-xs text-amber-600 dark:text-amber-400">
      {{ ocrFailedPages }} page(s) could not be OCR-processed and were kept as scans.
    </p>
    <p
      v-if="errorMessage"
      :class="[
        'text-xs',
        job.status === 'failed'
          ? 'text-red-700 dark:text-red-400'
          : 'text-amber-700 dark:text-amber-400'
      ]"
    >
      {{ errorMessage }}
    </p>
    <p v-if="job.active && !compact" class="text-xs text-gray-500 dark:text-gray-400">
      This continues in the background — you can leave this page or sign out, and follow it from the
      notifications bell at the top of the page.
    </p>
  </div>
</template>

<script setup lang="ts">
  import type { ReportUploadJob } from '~/types/admin'
  import {
    uploadJobErrorMessage,
    uploadJobPageLabel,
    uploadJobResultSummary,
    uploadJobResumeNote,
    uploadJobStageLabel
  } from '~/utils/reportUploadJobUi'

  interface Props {
    job: ReportUploadJob
    /** Hide the "continues in the background" hint. */
    compact?: boolean
  }

  const props = withDefaults(defineProps<Props>(), { compact: false })

  const stageLabel = computed(() => uploadJobStageLabel(props.job))
  const pageLabel = computed(() => uploadJobPageLabel(props.job))
  const resultSummary = computed(() => uploadJobResultSummary(props.job))
  const resumeNote = computed(() => uploadJobResumeNote(props.job))
  const errorMessage = computed(() => uploadJobErrorMessage(props.job))
  const ocrFailedPages = computed(() =>
    props.job.status === 'completed' ? (props.job.optimizationResult?.ocrFailedPages ?? 0) : 0
  )
</script>
