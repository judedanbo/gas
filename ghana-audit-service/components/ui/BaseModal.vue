<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-modal flex items-center justify-center p-4"
        @keydown.esc.stop="close"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="closeOnBackdrop && close()"
        />

        <!-- Modal Content -->
        <div
          ref="modalRef"
          :class="modalClasses"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="title ? titleId : undefined"
          :aria-describedby="$slots.default ? bodyId : undefined"
        >
          <!-- Header -->
          <div
            v-if="title || $slots.header || showClose"
            class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700"
          >
            <slot name="header">
              <h2
                v-if="title"
                :id="titleId"
                class="text-xl font-semibold text-gray-900 dark:text-white"
              >
                {{ title }}
              </h2>
            </slot>
            <button
              v-if="showClose"
              type="button"
              class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :aria-label="$t('common.close')"
              @click="close"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <!-- Body -->
          <div
            :id="bodyId"
            class="px-6 py-4 overflow-y-auto text-gray-700 dark:text-gray-300"
            :style="{ maxHeight: maxHeight }"
          >
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="px-6 py-4 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  interface Props {
    modelValue: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    showClose?: boolean
    closeOnBackdrop?: boolean
    maxHeight?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 'md',
    showClose: true,
    closeOnBackdrop: true,
    maxHeight: '70vh',
    title: undefined
  })

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
  }>()

  // Unique ids so several modals on one page never share `aria-labelledby` targets
  const uid = useId()
  const titleId = `${uid}-title`
  const bodyId = `${uid}-body`

  const modalRef = ref<HTMLElement | null>(null)

  const modalClasses = computed(() => {
    const base = 'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full focus:outline-none'

    const sizes = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      full: 'max-w-4xl'
    }

    return [base, sizes[props.size]].join(' ')
  })

  function close() {
    emit('update:modelValue', false)
  }

  // Trap keyboard focus inside the dialog while open and return it to the
  // opener on close (WAI-ARIA dialog pattern).
  const isOpen = computed(() => props.modelValue)
  useFocusTrap(modalRef, { active: isOpen })

  // Prevent the page behind from scrolling
  watch(
    () => props.modelValue,
    (open) => {
      if (typeof document === 'undefined') return
      document.body.style.overflow = open ? 'hidden' : ''
    },
    { immediate: true }
  )

  onUnmounted(() => {
    if (typeof document !== 'undefined') document.body.style.overflow = ''
  })
</script>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .modal-enter-active > div:last-child,
  .modal-leave-active > div:last-child {
    transition: transform 0.2s ease;
  }

  .modal-enter-from > div:last-child,
  .modal-leave-to > div:last-child {
    transform: scale(0.95);
  }
</style>
