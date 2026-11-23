<template>
  <UiBaseModal
    :model-value="modelValue"
    title="Keep on the carousel"
    size="lg"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form id="carousel-keep-form" class="space-y-4" @submit.prevent="submit">
      <p class="text-sm">
        <span class="font-medium text-gray-900 dark:text-white">{{ title }}</span>
        stays on the home page carousel even when newer items are published.
      </p>

      <fieldset>
        <legend class="mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Keep it for how long?
        </legend>
        <div class="space-y-2">
          <label class="flex items-center gap-3 text-sm">
            <input
              v-model="duration"
              type="radio"
              name="carousel-keep-duration"
              value="forever"
              class="h-4 w-4 text-primary focus:ring-primary"
            />
            Until I remove it
          </label>
          <label class="flex items-center gap-3 text-sm">
            <input
              v-model="duration"
              type="radio"
              name="carousel-keep-duration"
              value="date"
              class="h-4 w-4 text-primary focus:ring-primary"
            />
            Until a date
          </label>
        </div>
      </fieldset>

      <div v-if="duration === 'date'">
        <label
          for="carousel-keep-until"
          class="mb-1 block text-sm font-medium text-gray-900 dark:text-white"
        >
          Keep until (inclusive)
        </label>
        <input
          id="carousel-keep-until"
          v-model="until"
          type="date"
          required
          :min="today"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:w-auto"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          After this date the item is treated like any other: it stays only while it is among the
          latest.
        </p>
      </div>
    </form>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button
          v-if="isKept"
          type="button"
          class="text-sm font-medium text-gray-700 underline hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          :disabled="saving"
          @click="$emit('stop')"
        >
          Stop keeping
        </button>
        <span v-else />
        <div class="flex gap-3">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            @click="$emit('update:modelValue', false)"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="carousel-keep-form"
            class="btn btn-primary btn-sm"
            :disabled="saving"
          >
            {{ saving ? 'Saving...' : 'Keep' }}
          </button>
        </div>
      </div>
    </template>
  </UiBaseModal>
</template>

<script setup lang="ts">
  const props = defineProps<{
    modelValue: boolean
    title: string
    /** Current keep-until date when the item is already kept */
    pinnedUntil: string | null
    isKept: boolean
    saving: boolean
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    /** null = keep until removed */
    save: [pinnedUntil: string | null]
    stop: []
  }>()

  const today = carouselToday()
  const duration = ref<'forever' | 'date'>('forever')
  const until = ref('')

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      duration.value = props.pinnedUntil ? 'date' : 'forever'
      until.value = props.pinnedUntil ?? ''
    },
    { immediate: true }
  )

  function submit() {
    emit('save', duration.value === 'date' ? until.value : null)
  }
</script>
