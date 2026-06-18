<template>
  <div class="flex items-center justify-between">
    <div>
      <label v-if="label" :for="id" class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ label }}
      </label>
      <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400">
        {{ description }}
      </p>
    </div>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="disabled"
      :class="[
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        modelValue ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700',
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      ]"
      @click="toggle"
    >
      <span
        :class="[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          modelValue ? 'translate-x-5' : 'translate-x-0'
        ]"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    modelValue: boolean
    label?: string
    description?: string
    id?: string
    disabled?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    label: undefined,
    description: undefined,
    id: undefined,
    disabled: false
  })

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
  }>()

  function toggle() {
    if (!props.disabled) {
      emit('update:modelValue', !props.modelValue)
    }
  }
</script>
