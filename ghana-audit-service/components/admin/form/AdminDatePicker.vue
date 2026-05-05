<template>
  <AdminFormGroup :id="id" :label="label" :required="required" :error="error" :help-text="helpText">
    <input
      :id="id"
      :type="type"
      :value="formattedValue"
      :min="min"
      :max="max"
      :disabled="disabled"
      :class="[
        'form-input w-full',
        error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
      ]"
      @input="handleInput"
    />
  </AdminFormGroup>
</template>

<script setup lang="ts">
  interface Props {
    modelValue?: string | null
    label?: string
    id?: string
    type?: 'date' | 'datetime-local'
    min?: string
    max?: string
    required?: boolean
    disabled?: boolean
    error?: string
    helpText?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    type: 'date',
    modelValue: '',
    label: undefined,
    id: undefined,
    min: undefined,
    max: undefined,
    required: false,
    disabled: false,
    error: undefined,
    helpText: undefined
  })

  const emit = defineEmits<{
    'update:modelValue': [value: string]
  }>()

  // Format ISO date string for input
  const formattedValue = computed(() => {
    if (!props.modelValue) return ''

    try {
      const date = new Date(props.modelValue)
      if (isNaN(date.getTime())) return ''

      if (props.type === 'datetime-local') {
        // Format as YYYY-MM-DDTHH:mm
        return date.toISOString().slice(0, 16)
      } else {
        // Format as YYYY-MM-DD
        return date.toISOString().slice(0, 10)
      }
    } catch {
      return ''
    }
  })

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.value) {
      // Convert to ISO string
      const date = new Date(target.value)
      emit('update:modelValue', date.toISOString())
    } else {
      emit('update:modelValue', '')
    }
  }
</script>
