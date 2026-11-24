<template>
  <AdminFormGroup
    :id="controlId"
    :label="label"
    :required="required"
    :error="error"
    :help-text="helpText"
  >
    <div class="flex items-center gap-3">
      <span
        class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20"
        aria-hidden="true"
      >
        <Icon
          v-if="modelValue"
          :name="modelValue"
          class="w-6 h-6 text-primary dark:text-primary-200"
        />
      </span>
      <select
        :id="controlId"
        :value="modelValue ?? ''"
        :class="[
          'form-input w-full',
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
        ]"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="allowNone" value="">No icon</option>
        <option v-else-if="!modelValue" value="" disabled>Choose an icon</option>
        <option v-for="option in APP_ICON_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>
  </AdminFormGroup>
</template>

<script setup lang="ts">
  import { APP_ICON_OPTIONS } from '~/utils/serviceApps'

  interface Props {
    modelValue?: string | null
    label?: string
    id?: string
    required?: boolean
    /** Offer "No icon" (an empty value). */
    allowNone?: boolean
    error?: string
    helpText?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    label: undefined,
    id: undefined,
    required: false,
    allowNone: false,
    error: undefined,
    helpText: undefined
  })

  const emit = defineEmits<{
    'update:modelValue': [value: string]
  }>()

  const fallbackId = useId()
  const controlId = computed(() => props.id || fallbackId)
</script>
