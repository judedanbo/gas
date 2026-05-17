<template>
  <UiBaseModal
    :model-value="showWarning"
    title="Session about to expire"
    size="sm"
    :show-close="false"
    :close-on-backdrop="false"
  >
    <p class="text-sm text-gray-700 dark:text-gray-300">
      You've been inactive for a while. For security, you'll be signed out in
    </p>
    <p
      class="mt-3 text-center text-3xl font-bold tabular-nums text-gray-900 dark:text-white"
      role="timer"
      aria-live="assertive"
      aria-atomic="true"
    >
      {{ formattedCountdown }}
    </p>
    <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
      Choose "Stay signed in" to continue your session.
    </p>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="onLogout">
          Sign out
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="onStay">
          Stay signed in
        </button>
      </div>
    </template>
  </UiBaseModal>
</template>

<script setup lang="ts">
  const { showWarning, secondsRemaining, start, stop, stayLoggedIn, logoutNow } =
    useSessionTimeout()

  const busy = ref(false)

  const formattedCountdown = computed(() => {
    const total = Math.max(0, secondsRemaining.value)
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  })

  async function onStay() {
    busy.value = true
    try {
      await stayLoggedIn()
    } finally {
      busy.value = false
    }
  }

  async function onLogout() {
    busy.value = true
    try {
      await logoutNow()
    } finally {
      busy.value = false
    }
  }

  onMounted(start)
  onBeforeUnmount(stop)
</script>
