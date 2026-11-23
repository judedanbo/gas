<template>
  <!--
    A real checkbox inside a 44px-tall pill, so it is an easy target on touch
    screens and stays legible over any cover image. The accessible name carries
    the report title; the visible word is hidden from assistive tech so it is
    not read twice.
  -->
  <label
    class="inline-flex min-h-[2.75rem] select-none items-center gap-2 rounded-full border bg-white/95 px-3 text-sm font-semibold shadow-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 dark:bg-gray-900/95 dark:has-[:focus-visible]:ring-accent dark:has-[:focus-visible]:ring-offset-gray-900"
    :class="[
      selected
        ? 'border-primary text-primary dark:border-primary-200 dark:text-primary-200'
        : 'border-gray-300 text-gray-900 dark:border-gray-600 dark:text-white',
      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary'
    ]"
    :title="disabled ? disabledReason : undefined"
  >
    <input
      type="checkbox"
      class="h-4 w-4 shrink-0 accent-primary focus-visible:outline-none dark:accent-primary-200"
      :checked="selected"
      :disabled="disabled"
      :aria-label="$t('reports.bulk.selectReport', { title })"
      @change="emit('toggle')"
    />
    <span aria-hidden="true">
      {{ long ? $t('reports.bulk.selectLong') : $t('reports.bulk.select') }}
    </span>
  </label>
</template>

<script setup lang="ts">
  interface Props {
    /** Report title, used in the checkbox's accessible name. */
    title: string
    selected: boolean
    /** Unavailable because the selection is full. */
    disabled?: boolean
    /** Explains `disabled` on hover. */
    disabledReason?: string
    /** Spell out what selecting is for, where there is room. */
    long?: boolean
  }

  withDefaults(defineProps<Props>(), {
    disabled: false,
    disabledReason: undefined,
    long: false
  })

  const emit = defineEmits<{ toggle: [] }>()
</script>
