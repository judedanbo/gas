<template>
  <div class="max-w-3xl">
    <NuxtLink
      to="/admin/notifications"
      class="mb-4 inline-flex items-center gap-1.5 rounded-sm text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-400 dark:hover:text-gray-200"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      All notifications
    </NuxtLink>

    <!-- Loading an upload that is not in the feed -->
    <div
      v-if="!notification && loadingJob"
      class="rounded-lg bg-white p-10 text-center shadow dark:bg-gray-800"
    >
      <div
        class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        role="status"
        aria-label="Loading notification"
      />
    </div>

    <!-- Gone: dismissed, expired, or from another browser session -->
    <div v-else-if="!notification" class="rounded-lg bg-white shadow dark:bg-gray-800">
      <AdminUiAdminEmptyState
        title="Notification not found"
        description="It may have been dismissed or expired, or it belongs to another browser tab."
        action-to="/admin/notifications"
        action-label="View all notifications"
      />
    </div>

    <article
      v-else
      class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800"
      aria-labelledby="notification-title"
    >
      <header class="flex items-start gap-4 border-b border-gray-200 p-6 dark:border-gray-700">
        <UiBaseImage
          v-if="notification.thumbnailUrl"
          :src="notification.thumbnailUrl"
          :alt="`Cover of ${notification.subject ?? 'the report'}`"
          class="h-24 w-[4.5rem] flex-shrink-0 rounded object-cover"
        />
        <div class="min-w-0 flex-1">
          <span :class="['badge', STATUS_BADGES[notification.status]]">
            {{ notificationStatusLabel(notification.status) }}
          </span>
          <h1 id="notification-title" class="mt-2 text-xl font-bold text-gray-900 dark:text-white">
            {{ notification.title }}
          </h1>
          <p v-if="notification.subject" class="mt-1 break-words text-gray-700 dark:text-gray-300">
            {{ notification.subject }}
          </p>
        </div>
      </header>

      <div class="space-y-6 p-6">
        <!-- Live progress -->
        <section v-if="running" aria-labelledby="progress-heading" class="space-y-2">
          <h2 id="progress-heading" class="sr-only">Progress</h2>
          <div class="flex items-center justify-between gap-3 text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300" aria-live="polite">
              {{ notification.progressLabel || 'Working…' }}
            </span>
            <span class="tabular-nums text-gray-600 dark:text-gray-400">
              {{
                notification.progressDetail ||
                (notification.progress !== null ? `${notification.progress}%` : '')
              }}
            </span>
          </div>
          <div
            class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600"
            role="progressbar"
            :aria-label="`Progress: ${notification.title}`"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="notification.progress ?? undefined"
          >
            <div
              class="h-full rounded-full bg-primary transition-[width] duration-300"
              :style="{ width: `${notification.progress ?? 100}%` }"
              :class="{ 'opacity-50': notification.progress === null }"
            />
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400">
            This keeps running on the server — you can leave this page.
          </p>
        </section>

        <!-- Outcome -->
        <section v-if="notification.notes.length > 0" aria-labelledby="outcome-heading">
          <h2
            id="outcome-heading"
            class="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
          >
            Outcome
          </h2>
          <ul class="space-y-1">
            <li
              v-for="(note, index) in notification.notes"
              :key="index"
              :class="['text-sm', NOTE_TONES[note.tone]]"
            >
              {{ note.text }}
            </li>
          </ul>
        </section>

        <!-- Facts -->
        <section aria-labelledby="details-heading">
          <h2
            id="details-heading"
            class="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
          >
            Details
          </h2>
          <dl class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="row in details"
              :key="row.label"
              class="grid grid-cols-1 gap-1 py-2 text-sm sm:grid-cols-3 sm:gap-4"
            >
              <dt class="text-gray-600 dark:text-gray-400">{{ row.label }}</dt>
              <dd class="break-words text-gray-900 dark:text-white sm:col-span-2">
                {{ row.value }}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <!-- Actions -->
      <footer
        class="flex flex-wrap items-center gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/30"
      >
        <NuxtLink
          v-for="(action, index) in notification.actions"
          :key="action.label"
          :to="action.to"
          :class="['btn px-4 py-2 text-sm', index === 0 ? 'btn-primary' : 'btn-ghost']"
        >
          {{ action.label }}
        </NuxtLink>
        <button
          v-if="!running"
          type="button"
          class="btn btn-ghost ml-auto px-4 py-2 text-sm"
          :disabled="dismissing"
          @click="dismiss"
        >
          Dismiss
        </button>
      </footer>
    </article>
  </div>
</template>

<script setup lang="ts">
  import type { AdminNotification, AdminNotificationNote } from '~/types/admin'
  import {
    isUploadNotificationId,
    notificationDetails,
    notificationStatusLabel,
    uploadJobIdFromNotificationId,
    uploadJobToNotification
  } from '~/utils/adminNotifications'

  definePageMeta({
    layout: 'admin'
  })

  const NOTE_TONES: Record<AdminNotificationNote['tone'], string> = {
    muted: 'text-gray-700 dark:text-gray-300',
    success: 'text-green-700 dark:text-green-400',
    warning: 'text-amber-700 dark:text-amber-400',
    error: 'text-red-700 dark:text-red-400'
  }

  const STATUS_BADGES: Record<AdminNotification['status'], string> = {
    running: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-secondary'
  }

  const route = useRoute()
  const router = useRouter()
  const store = useAdminNotifications()

  const id = computed(() => String(route.params.id ?? ''))
  const isUpload = computed(() => isUploadNotificationId(id.value))

  // Uploads are followed straight from the server, so the page works (and
  // stays live) even for one that has aged out of the bell's feed.
  const follower = useReportUploadJob()
  const loadingJob = computed(() => isUpload.value && !follower.job.value && !follower.error.value)

  watch(
    id,
    (value) => {
      if (isUploadNotificationId(value)) follower.follow(uploadJobIdFromNotificationId(value))
      else follower.reset()
    },
    { immediate: true }
  )

  const notification = computed<AdminNotification | null>(() => {
    if (isUpload.value && follower.job.value) return uploadJobToNotification(follower.job.value)
    return store.notifications.value.find((n) => n.id === id.value) ?? null
  })

  const running = computed(() => notification.value?.status === 'running')
  const details = computed(() =>
    notification.value
      ? notificationDetails(notification.value, isUpload.value ? follower.job.value : null)
      : []
  )

  // Reading an outcome here counts as seeing it.
  watch(
    () => notification.value?.status,
    (status) => {
      if (status && status !== 'running') store.markSeen([id.value])
    },
    { immediate: true }
  )

  useHead({ title: () => notification.value?.title ?? 'Notification' })

  const dismissing = ref(false)
  async function dismiss(): Promise<void> {
    dismissing.value = true
    try {
      if (await store.dismiss(id.value)) await router.push('/admin/notifications')
    } finally {
      dismissing.value = false
    }
  }
</script>
