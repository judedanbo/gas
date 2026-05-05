<template>
  <div class="form-group">
    <label v-if="label" :for="id" class="form-label flex items-center gap-1">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
      <span v-if="hint" class="text-xs text-gray-400 font-normal ml-1">({{ hint }})</span>
    </label>
    <slot />
    <p v-if="error" class="mt-1 text-sm text-red-500">
      {{ error }}
    </p>
    <p v-else-if="helpText" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      {{ helpText }}
    </p>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    label?: string
    id?: string
    required?: boolean
    error?: string
    helpText?: string
    hint?: string
  }

  withDefaults(defineProps<Props>(), {
    required: false,
    label: undefined,
    id: undefined,
    error: undefined,
    helpText: undefined,
    hint: undefined
  })
</script>
