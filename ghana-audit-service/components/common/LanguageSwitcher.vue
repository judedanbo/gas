<template>
  <nav class="flex items-center gap-1" :aria-label="$t('common.language')">
    <Icon name="heroicons:language" :class="iconClasses" class="w-4 h-4" aria-hidden="true" />
    <NuxtLink
      v-for="loc in availableLocales"
      :key="loc.code"
      :to="switchLocalePath(loc.code as LocaleCode)"
      :lang="loc.code"
      :hreflang="loc.code"
      :aria-current="loc.code === locale ? 'true' : undefined"
      class="px-2 py-1 text-xs md:text-sm font-medium rounded no-underline transition-colors touch-target-area"
      :class="loc.code === locale ? activeClasses : inactiveClasses"
    >
      {{ loc.name }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
  /**
   * Links to the same page in each configured locale.
   * Uses real links (not `setLocale`) so the switch works without JavaScript
   * and search engines can discover the alternate-language URLs.
   */
  interface Props {
    variant?: 'on-brand' | 'default'
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'default'
  })

  const { locale, locales } = useI18n()
  const switchLocalePath = useSwitchLocalePath()

  type LocaleCode = typeof locale.value

  const availableLocales = computed(() =>
    (locales.value as Array<{ code: string; name?: string }>).map((l) => ({
      code: l.code,
      name: l.name ?? l.code.toUpperCase()
    }))
  )

  const iconClasses = computed(() =>
    props.variant === 'on-brand' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
  )

  const activeClasses = computed(() =>
    props.variant === 'on-brand'
      ? 'bg-white text-primary'
      : 'bg-primary text-white dark:bg-primary-200 dark:text-gray-900'
  )

  const inactiveClasses = computed(() =>
    props.variant === 'on-brand'
      ? 'text-white/90 hover:text-white hover:bg-white/10'
      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
  )
</script>
