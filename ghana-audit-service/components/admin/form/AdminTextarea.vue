<template>
  <AdminFormGroup
    :id="id"
    :label="label"
    :required="required"
    :error="error"
    :help-text="helpText"
    :hint="hint"
  >
    <textarea
      :id="id"
      :value="textValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :rows="rows"
      :class="[
        'form-input w-full resize-y',
        error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
      ]"
      @input="handleInput"
      @blur="$emit('blur')"
    />
  </AdminFormGroup>
</template>

<script setup lang="ts">
  interface Props {
    modelValue?: string | null
    label?: string
    id?: string
    placeholder?: string
    rows?: number
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    error?: string
    helpText?: string
    hint?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    rows: 4,
    label: undefined,
    id: undefined,
    placeholder: undefined,
    required: false,
    disabled: false,
    readonly: false,
    error: undefined,
    helpText: undefined,
    hint: undefined
  })

  const emit = defineEmits<{
    'update:modelValue': [value: string]
    blur: []
  }>()

  // Convert null to empty string for the textarea
  const textValue = computed(() => props.modelValue ?? '')

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement
    emit('update:modelValue', target.value)
  }
</script>
