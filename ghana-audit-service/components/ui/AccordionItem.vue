<template>
  <div :class="containerClasses">
    <button
      :id="buttonId"
      type="button"
      class="w-full flex items-center gap-4 p-4 bg-transparent border-none cursor-pointer text-left"
      :aria-expanded="isOpen"
      :aria-controls="contentId"
      @click="toggle"
    >
      <div
        v-if="icon"
        class="w-[50px] h-[50px] rounded-md flex items-center justify-center flex-shrink-0 bg-primary/10"
      >
        <Icon
          v-if="isHeroicon(icon)"
          :name="icon"
          class="w-6 h-6 text-primary"
          aria-hidden="true"
        />
        <span v-else class="text-2xl">{{ icon }}</span>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="m-0 text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
        <p v-if="subtitle" class="text-sm text-gray-500 dark:text-gray-400 m-0">{{ subtitle }}</p>
      </div>
      <span :class="toggleIconClasses">
        {{ isOpen ? '−' : '+' }}
      </span>
    </button>

    <Transition name="accordion">
      <div
        v-show="isOpen"
        :id="contentId"
        :class="contentClasses"
        role="region"
        :aria-labelledby="buttonId"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    title: string
    icon?: string
    subtitle?: string
    defaultOpen?: boolean
    variant?: 'default' | 'card'
  }

  const props = withDefaults(defineProps<Props>(), {
    defaultOpen: false,
    variant: 'card',
    icon: undefined,
    subtitle: undefined
  })

  // Helper to detect heroicon names
  const isHeroicon = (icon: string) => icon.includes(':')

  // Generate unique IDs for accessibility
  const uniqueId = useId()
  const buttonId = computed(() => `accordion-button-${uniqueId}`)
  const contentId = computed(() => `accordion-content-${uniqueId}`)

  const isOpen = ref(props.defaultOpen)

  const toggle = () => {
    isOpen.value = !isOpen.value
  }

  const containerClasses = computed(() => {
    const base = 'overflow-hidden transition-all'

    if (props.variant === 'card') {
      return [
        base,
        'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg',
        isOpen.value ? 'border-primary shadow-md' : 'hover:border-primary'
      ].join(' ')
    }

    return base
  })

  const toggleIconClasses = computed(() => {
    return 'w-[30px] h-[30px] flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-xl text-primary flex-shrink-0'
  })

  const contentClasses = computed(() => {
    return 'p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
  })

  // Expose toggle for external control
  defineExpose({ toggle, isOpen })
</script>

<style scoped>
  .accordion-enter-active,
  .accordion-leave-active {
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .accordion-enter-from,
  .accordion-leave-to {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
  }

  .accordion-enter-to,
  .accordion-leave-from {
    opacity: 1;
    max-height: 500px;
  }
</style>
