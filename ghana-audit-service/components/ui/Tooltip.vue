<template>
  <div ref="triggerRef" class="inline-flex" @mouseenter="onEnter" @mouseleave="onLeave">
    <slot />
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="show && text"
          role="tooltip"
          class="fixed z-[9999] px-3 py-2 text-sm font-normal leading-snug text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none max-w-xs w-max"
          :style="tooltipStyle"
        >
          {{ text }}
          <div
            class="absolute w-2.5 h-2.5 bg-gray-900 dark:bg-gray-700 rotate-45 left-1/2 -translate-x-1/2"
            :class="position === 'top' ? '-bottom-1' : '-top-1'"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    text: string
    position?: 'top' | 'bottom'
  }

  const props = withDefaults(defineProps<Props>(), {
    position: 'top'
  })

  const triggerRef = ref<HTMLElement | null>(null)
  const show = ref(false)
  const tooltipStyle = ref<Record<string, string>>({})

  function updatePosition() {
    if (!triggerRef.value) return
    const rect = triggerRef.value.getBoundingClientRect()
    const x = rect.left + rect.width / 2

    if (props.position === 'top') {
      tooltipStyle.value = {
        left: `${x}px`,
        top: `${rect.top}px`,
        transform: 'translate(-50%, -100%) translateY(-8px)'
      }
    } else {
      tooltipStyle.value = {
        left: `${x}px`,
        top: `${rect.bottom}px`,
        transform: 'translate(-50%, 0) translateY(8px)'
      }
    }
  }

  function onEnter() {
    updatePosition()
    show.value = true
  }

  function onLeave() {
    show.value = false
  }
</script>
