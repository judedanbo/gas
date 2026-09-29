<template>
  <section
    v-if="!hideWhenEmpty || jobs.length > 0 || (!loaded && loading)"
    class="bg-white dark:bg-gray-800 rounded-lg shadow"
    aria-labelledby="upload-jobs-heading"
  >
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <h2 id="upload-jobs-heading" class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ title }}
          </h2>
          <span
            v-if="activeJobs.length > 0"
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
          >
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            {{ activeJobs.length }} in progress
          </span>
        </div>
        <button
          type="button"
          class="text-sm text-primary hover:underline"
          :disabled="loading"
          @click="refresh"
        >
          Refresh
        </button>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Report uploads keep running on the server after you leave the page or sign out.
      </p>
    </div>

    <div class="divide-y divide-gray-200 dark:divide-gray-700">
      <!-- Loading (first fetch only) -->
      <div v-if="!loaded && loading" class="p-6 text-center">
        <div
          class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"
          role="status"
          aria-label="Loading uploads"
        />
      </div>

      <!-- Error -->
      <div
        v-else-if="error && jobs.length === 0"
        class="p-6 text-center text-sm text-red-700 dark:text-red-400"
      >
        {{ error }}
      </div>

      <!-- Empty -->
      <div v-else-if="jobs.length === 0" class="p-6 text-center text-gray-500 dark:text-gray-400">
        No report uploads in the last 24 hours
      </div>

      <!-- Job rows -->
      <article
        v-for="job in jobs"
        v-else
        :key="job.id"
        class="p-4 sm:p-5"
        :aria-label="`Upload of ${job.originalName}`"
      >
        <div class="flex items-start gap-4">
          <!-- Thumbnail / icon -->
          <UiBaseImage
            v-if="job.thumbnailUrl"
            :src="job.thumbnailUrl"
            :alt="`Cover of ${job.originalName}`"
            class="w-12 h-16 object-cover rounded flex-shrink-0"
          />
          <div
            v-else
            class="w-12 h-16 bg-red-100 dark:bg-red-900/20 rounded flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
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

          <div class="flex-1 min-w-0 space-y-2">
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ job.reportTitle || job.originalName }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatBytes(job.finalSize ?? job.size) }}
                <template v-if="job.user"> · {{ job.user.name }}</template>
                · {{ formatRelativeTime(job.createdAt) }}
              </p>
            </div>
            <p v-if="job.reportTitle" class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ job.originalName }}
            </p>

            <AdminUiAdminUploadJobProgress :job="job" compact />

            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <NuxtLink
                v-if="job.reportId"
                :to="`/admin/reports/${job.reportId}/edit`"
                class="text-primary hover:underline"
              >
                Open report
              </NuxtLink>
              <NuxtLink
                v-else-if="job.status === 'completed'"
                :to="{ path: '/admin/reports/create', query: { uploadJobId: job.id } }"
                class="text-primary hover:underline"
              >
                Create report from this file
              </NuxtLink>
              <span v-else-if="job.active" class="text-xs text-gray-500 dark:text-gray-400">
                Not yet attached to a report
              </span>
              <button
                v-if="!job.active"
                type="button"
                class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs"
                :aria-label="`Dismiss upload of ${job.originalName}`"
                @click="dismiss(job.id)"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { formatBytes } from '~/utils/formatBytes'
  import { formatRelativeTime } from '~/utils/reportUploadJobUi'

  interface Props {
    title?: string
    /** Render nothing when there are no jobs to show (reports list page). */
    hideWhenEmpty?: boolean
    limit?: number
    sinceHours?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    title: 'Report uploads',
    hideWhenEmpty: false,
    limit: 20,
    sinceHours: 24
  })

  const { jobs, activeJobs, loading, loaded, error, refresh, dismiss } = useReportUploadJobs({
    limit: props.limit,
    sinceHours: props.sinceHours
  })
</script>
