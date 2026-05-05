<template>
  <AdminFormGroup :id="id" :label="label" :required="required" :error="error" :help-text="helpText">
    <select
      :id="id"
      :value="selectValue"
      :disabled="disabled"
      :class="[
        'form-input w-full',
        error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
      ]"
      @change="handleChange"
    >
      <option v-if="placeholder" value="" disabled>
        {{ placeholder }}
      </option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </AdminFormGroup>
</template>

<script setup lang="ts">
  interface Option {
    value: string | number
    label: string
  }

  interface Props {
    modelValue?: string | number | null
    options: Option[]
    label?: string
    id?: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    error?: string
    helpText?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    label: undefined,
    id: undefined,
    placeholder: undefined,
    required: false,
    disabled: false,
    error: undefined,
    helpText: undefined
  })

  const emit = defineEmits<{
    'update:modelValue': [value: string | number]
  }>()

  // Convert null to empty string for the select
  const selectValue = computed(() => props.modelValue ?? '')

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement
    emit('update:modelValue', target.value)
  }
</script>
