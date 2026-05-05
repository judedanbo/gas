<template>
  <UiBaseModal
    :model-value="modelValue"
    :title="title"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="text-center">
      <!-- Icon -->
      <div
        :class="[
          'mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4',
          variant === 'danger' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-yellow-100 dark:bg-yellow-900/20'
        ]"
      >
        <svg
          :class="[
            'w-6 h-6',
            variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
          ]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <!-- Message -->
      <p class="text-gray-600 dark:text-gray-300 mb-6">
        {{ message }}
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="loading"
          @click="$emit('update:modelValue', false)"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          :class="[
            'btn flex items-center gap-2',
            variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'
          ]"
          :disabled="loading"
          @click="$emit('confirm')"
        >
          <svg
            v-if="loading"
            class="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {{ confirmText }}
        </button>
      </div>
    </template>
  </UiBaseModal>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'danger',
  loading: false
})

defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()
</script>
