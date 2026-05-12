<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-3">
      <TransitionGroup name="toast-slide">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          role="alert"
          :class="[
            'flex items-start gap-3 rounded-lg border-l-4 bg-white p-4 shadow-lg dark:bg-gray-800',
            'min-w-[320px] max-w-[420px]',
            borderColorMap[toast.type],
          ]"
        >
          <!-- Icon -->
          <div :class="['mt-0.5 flex-shrink-0', iconColorMap[toast.type]]">
            <!-- Success: checkmark -->
            <svg
              v-if="toast.type === 'success'"
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <!-- Error: X -->
            <svg
              v-else-if="toast.type === 'error'"
              class="h-5 w-5"
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
            <!-- Warning: triangle -->
            <svg
              v-else-if="toast.type === 'warning'"
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <!-- Info: info circle -->
            <svg
              v-else
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <!-- Message -->
          <p class="flex-1 text-sm text-gray-700 dark:text-gray-200">
            {{ toast.message }}
          </p>

          <!-- Close button -->
          <button
            type="button"
            class="flex-shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:hover:text-gray-300"
            :class="focusRingColorMap[toast.type]"
            aria-label="Dismiss notification"
            @click="dismiss(toast.id)"
          >
            <svg
              class="h-4 w-4"
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
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  const { toasts, dismiss } = useToast()

  const borderColorMap: Record<string, string> = {
    success: 'border-green-500',
    error: 'border-red-500',
    warning: 'border-amber-500',
    info: 'border-blue-500',
  }

  const iconColorMap: Record<string, string> = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
  }

  const focusRingColorMap: Record<string, string> = {
    success: 'focus:ring-green-500',
    error: 'focus:ring-red-500',
    warning: 'focus:ring-amber-500',
    info: 'focus:ring-blue-500',
  }
</script>

<style scoped>
  .toast-slide-enter-active {
    transition: all 0.3s ease-out;
  }

  .toast-slide-leave-active {
    transition: all 0.2s ease-in;
  }

  .toast-slide-enter-from {
    opacity: 0;
    transform: translateX(100%);
  }

  .toast-slide-leave-to {
    opacity: 0;
    transform: translateX(100%);
  }

  .toast-slide-move {
    transition: transform 0.3s ease;
  }
</style>
