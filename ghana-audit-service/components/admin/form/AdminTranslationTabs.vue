<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <!-- Tabs -->
    <div class="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <button
        v-for="locale in locales"
        :key="locale.code"
        type="button"
        :class="[
          'flex-1 px-4 py-3 text-sm font-medium transition-colors',
          activeLocale === locale.code
            ? 'bg-white dark:bg-gray-900 text-primary border-b-2 border-primary -mb-px'
            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
        @click="activeLocale = locale.code"
      >
        {{ locale.label }}
        <span v-if="locale.required" class="text-red-500 ml-1">*</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="p-4 bg-white dark:bg-gray-900">
      <div v-for="locale in locales" v-show="activeLocale === locale.code" :key="locale.code">
        <div class="space-y-4">
          <template v-for="field in fields" :key="field.key">
            <!-- Text Input -->
            <AdminFormAdminInput
              v-if="field.type === 'input'"
              :id="`${field.key}-${locale.code}`"
              :model-value="getFieldValue(locale.code, field.key)"
              :label="field.label"
              :placeholder="field.placeholder"
              :required="field.required && locale.required"
              :error="getFieldError(locale.code, field.key)"
              @update:model-value="setFieldValue(locale.code, field.key, String($event))"
            />

            <!-- Textarea -->
            <AdminFormAdminTextarea
              v-else-if="field.type === 'textarea'"
              :id="`${field.key}-${locale.code}`"
              :model-value="getFieldValue(locale.code, field.key)"
              :label="field.label"
              :placeholder="field.placeholder"
              :rows="field.rows || 4"
              :required="field.required && locale.required"
              :error="getFieldError(locale.code, field.key)"
              @update:model-value="setFieldValue(locale.code, field.key, String($event))"
            />

            <!-- Rich Text -->
            <AdminFormAdminRichText
              v-else-if="field.type === 'richtext'"
              :id="`${field.key}-${locale.code}`"
              :model-value="getFieldValue(locale.code, field.key)"
              :label="field.label"
              :placeholder="field.placeholder"
              :required="field.required && locale.required"
              :error="getFieldError(locale.code, field.key)"
              @update:model-value="setFieldValue(locale.code, field.key, String($event))"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Translations } from '~/types/admin'

  interface Field {
    key: string
    label: string
    type: 'input' | 'textarea' | 'richtext'
    placeholder?: string
    required?: boolean
    rows?: number
  }

  type TranslationValue = Record<string, string | null | undefined>

  interface Props {
    modelValue: Translations<TranslationValue>
    fields: Field[]
    errors?: Record<string, Record<string, string>>
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: () => ({ en: {} }),
    errors: () => ({})
  })

  const emit = defineEmits<{
    'update:modelValue': [value: Translations<TranslationValue>]
  }>()

  const locales: { code: 'en' | 'ak'; label: string; required: boolean }[] = [
    { code: 'en', label: 'English', required: true },
    { code: 'ak', label: 'Akan', required: false }
  ]

  const activeLocale = ref<'en' | 'ak'>('en')

  // Get field value for a locale
  function getFieldValue(locale: string, key: string): string {
    const localeData = props.modelValue[locale as keyof typeof props.modelValue]
    return localeData?.[key] || ''
  }

  // Set field value for a locale
  function setFieldValue(locale: string, key: string, value: string) {
    const newValue = { ...props.modelValue }

    if (!newValue[locale as keyof typeof newValue]) {
      newValue[locale as keyof typeof newValue] = {}
    }

    newValue[locale as keyof typeof newValue] = {
      ...newValue[locale as keyof typeof newValue],
      [key]: value
    }

    emit('update:modelValue', newValue)
  }

  // Get field error for a locale
  function getFieldError(locale: string, key: string): string | undefined {
    return props.errors?.[locale]?.[key]
  }
</script>
