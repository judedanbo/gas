<template>
  <AdminFormGroup
    :id="id"
    :label="label"
    :required="required"
    :error="error"
    :help-text="helpText"
    :hint="hint"
  >
    <div class="relative">
      <input
        :id="id"
        :type="type"
        :value="inputValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :class="[
          'form-input w-full',
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : '',
          $slots.suffix ? 'pr-10' : ''
        ]"
        @input="handleInput"
        @blur="$emit('blur')"
      />
      <div
        v-if="$slots.suffix"
        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"
      >
        <slot name="suffix" />
      </div>
    </div>
  </AdminFormGroup>
</template>

<script setup lang="ts">
  interface Props {
    modelValue?: string | number | null
    label?: string
    id?: string
    type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel'
    placeholder?: string
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    error?: string
    helpText?: string
    hint?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    type: 'text',
    modelValue: '',
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
    'update:modelValue': [value: string | number]
    blur: []
  }>()

  // Convert null to empty string for the input
  const inputValue = computed(() => props.modelValue ?? '')

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    const value = props.type === 'number' ? Number(target.value) : target.value
    emit('update:modelValue', value)
  }
</script>
