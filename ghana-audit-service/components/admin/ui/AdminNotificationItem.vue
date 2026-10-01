<template>
  <article
    :class="[
      'flex gap-3 px-4 py-3 transition-colors',
      fresh ? 'bg-primary/5 dark:bg-primary/10' : ''
    ]"
    :aria-labelledby="titleId"
  >
    <!-- Leading visual: the report cover when there is one, else the status -->
    <div class="relative flex-shrink-0" aria-hidden="true">
      <UiBaseImage
        v-if="notification.thumbnailUrl"
        :src="notification.thumbnailUrl"
        alt=""
        class="h-12 w-9 rounded object-cover"
      />
      <span
        v-else
        :class="['flex h-9 w-9 items-center justify-center rounded-full', statusStyle.wrap]"
      >
        <svg
          :class="['h-5 w-5', statusStyle.icon]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPath" />
        </svg>
      </span>
      <span
        v-if="notification.thumbnailUrl"
        :class="[
          'absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white dark:ring-gray-800',
          statusStyle.wrap
        ]"
      >
        <svg
          :class="['h-3 w-3', statusStyle.icon]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" :d="iconPath" />
        </svg>
      </span>
    </div>

    <div class="min-w-0 flex-1 space-y-1">
      <div class="flex items-start justify-between gap-3">
        <p :id="titleId" class="text-sm font-medium text-gray-900 dark:text-white">
          <span v-if="fresh" class="sr-only">New:</span>
          {{ notification.title }}
        </p>
        <time
          :datetime="timestamp"
          class="flex-shrink-0 pt-0.5 text-xs text-gray-500 dark:text-gray-400"
        >
          {{ relativeTime }}
        </time>
      </div>

      <p
        v-if="notification.subject"
        class="truncate text-sm text-gray-700 dark:text-gray-300"
        :title="notification.subject"
      >
        {{ notification.subject }}
      </p>
      <p v-if="notification.meta" class="truncate text-xs text-gray-500 dark:text-gray-400">
        {{ notification.meta }}
      </p>

      <!-- Progress while running -->
      <div v-if="running" class="space-y-1 pt-1">
        <div class="flex items-center justify-between gap-3 text-xs">
          <span class="min-w-0 truncate text-gray-700 dark:text-gray-300">
            {{ notification.progressLabel || 'Working…' }}
          </span>
          <span class="flex-shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
            {{ progressFigure }}
          </span>
        </div>
        <div
          class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600"
          role="progressbar"
          :aria-label="progressName"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="notification.progress ?? undefined"
          :aria-valuetext="progressValueText"
        >
          <div
            v-if="notification.progress !== null"
            class="h-full rounded-full bg-primary transition-[width] duration-300"
            :style="{ width: `${notification.progress}%` }"
          />
          <div v-else class="notification-indeterminate h-full w-1/3 rounded-full bg-primary" />
        </div>
      </div>

      <!-- Outcome details -->
      <p
        v-for="(note, index) in notification.notes"
        :key="index"
        :class="['text-xs', NOTE_TONES[note.tone]]"
      >
        {{ note.text }}
      </p>

      <div
        v-if="notification.actions.length > 0 || !running"
        class="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5"
      >
        <NuxtLink
          v-for="action in notification.actions"
          :key="action.label"
          :to="action.to"
          class="text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm dark:text-primary-200"
          @click="emit('navigate')"
        >
          {{ action.label }}
        </NuxtLink>
        <button
          v-if="!running"
          type="button"
          class="rounded-sm text-xs text-gray-600 hover:text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-400 dark:hover:text-gray-200"
          :aria-label="`Dismiss notification: ${accessibleName}`"
          @click="emit('dismiss', notification.id)"
        >
          Dismiss
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
  import type {
    AdminNotification,
    AdminNotificationCategory,
    AdminNotificationNote,
    AdminNotificationStatus
  } from '~/types/admin'
  import { formatRelativeTime } from '~/utils/reportUploadJobUi'

  interface Props {
    notification: AdminNotification
    /** Unread when the panel was opened — highlighted until it closes. */
    fresh?: boolean
    /** Clock for the relative timestamp (ticks while the panel is open). */
    now?: number
  }

  const props = withDefaults(defineProps<Props>(), { fresh: false, now: () => Date.now() })

  const emit = defineEmits<{
    dismiss: [id: string]
    /** An action link was followed — the panel should close. */
    navigate: []
  }>()

  const NOTE_TONES: Record<AdminNotificationNote['tone'], string> = {
    muted: 'text-gray-600 dark:text-gray-300',
    success: 'text-green-700 dark:text-green-400',
    warning: 'text-amber-700 dark:text-amber-400',
    error: 'text-red-700 dark:text-red-400'
  }

  const STATUS_STYLES = {
    running: {
      wrap: 'bg-primary/10 dark:bg-primary/20',
      icon: 'text-primary dark:text-primary-200'
    },
    success: {
      wrap: 'bg-green-100 dark:bg-green-900/30',
      icon: 'text-green-700 dark:text-green-400'
    },
    warning: {
      wrap: 'bg-amber-100 dark:bg-amber-900/30',
      icon: 'text-amber-700 dark:text-amber-400'
    },
    error: { wrap: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-700 dark:text-red-400' },
    info: { wrap: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-700 dark:text-blue-400' }
  } as const

  // Heroicons (outline) paths, matching the rest of the admin UI. Running
  // entries show what kind of work it is; outcomes show how it went.
  const CATEGORY_ICONS: Record<AdminNotificationCategory, string> = {
    upload: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
    optimization: 'M13 10V3L4 14h7v7l9-11h-7z',
    general: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  }
  const OUTCOME_ICONS: Record<Exclude<AdminNotificationStatus, 'running'>, string> = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    warning:
      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  }

  const titleId = computed(() => `notification-${props.notification.id.replace(/[^\w-]/g, '-')}`)
  const running = computed(() => props.notification.status === 'running')
  const statusStyle = computed(() => STATUS_STYLES[props.notification.status])
  const iconPath = computed(() => {
    const { status, category } = props.notification
    return status === 'running' ? CATEGORY_ICONS[category] : OUTCOME_ICONS[status]
  })

  const timestamp = computed(() => props.notification.finishedAt ?? props.notification.createdAt)
  const relativeTime = computed(() => formatRelativeTime(timestamp.value, props.now))

  const accessibleName = computed(() => {
    const { title, subject } = props.notification
    return subject ? `${title} — ${subject}` : title
  })

  const progressFigure = computed(() => {
    const { progress, progressDetail } = props.notification
    if (progressDetail) return progressDetail
    return progress !== null ? `${progress}%` : ''
  })

  const progressName = computed(() => `Progress: ${accessibleName.value}`)
  const progressValueText = computed(() => {
    const { progress, progressLabel, progressDetail } = props.notification
    const parts = [progress !== null ? `${progress}%` : null, progressLabel, progressDetail]
    return parts.filter(Boolean).join(' — ') || 'In progress'
  })
</script>

<style scoped>
  .notification-indeterminate {
    animation: notification-indeterminate 1.4s ease-in-out infinite;
  }

  @keyframes notification-indeterminate {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(300%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    /* A static, full-width bar still reads as "in progress". */
    .notification-indeterminate {
      animation: none;
      width: 100%;
      opacity: 0.5;
    }
  }
</style>
