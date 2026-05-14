<script setup lang="ts">
interface Props {
  show: boolean
  triggerRef: HTMLElement | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const popoverRef = ref<HTMLElement | null>(null)

// Popover position state
const positionStyle = ref<Record<string, string>>({
  top: '0px',
  left: '0px',
})

function calculatePosition() {
  if (!props.triggerRef || !popoverRef.value) return

  const trigger = props.triggerRef.getBoundingClientRect()
  const popoverWidth = 320
  const popoverHeight = popoverRef.value.offsetHeight || 400
  const gap = 4
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Default: place below the trigger
  let top = trigger.bottom + gap + window.scrollY
  let left = trigger.left + window.scrollX

  // Flip above if overflows viewport bottom
  if (trigger.bottom + gap + popoverHeight > viewportHeight) {
    top = trigger.top - gap - popoverHeight + window.scrollY
  }

  // Align right if overflows right edge
  if (left + popoverWidth > viewportWidth) {
    left = trigger.right + window.scrollX - popoverWidth
    // Keep at 0 minimum
    if (left < 0) left = 0
  }

  positionStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

// Recalculate position after show transitions
async function updatePosition() {
  await nextTick()
  calculatePosition()
}

// Keyboard handler
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

// Click outside handler
function onMousedown(e: MouseEvent) {
  const target = e.target as Node
  if (
    popoverRef.value &&
    !popoverRef.value.contains(target) &&
    props.triggerRef &&
    !props.triggerRef.contains(target)
  ) {
    emit('close')
  }
}

// Resize/scroll recalculation
function onReposition() {
  if (props.show) {
    calculatePosition()
  }
}

// Add/remove listeners when show changes
watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      await updatePosition()
      document.addEventListener('mousedown', onMousedown)
      document.addEventListener('keydown', onKeydown)
      window.addEventListener('resize', onReposition)
      window.addEventListener('scroll', onReposition, true)
    } else {
      document.removeEventListener('mousedown', onMousedown)
      document.removeEventListener('keydown', onKeydown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onMousedown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onReposition)
  window.removeEventListener('scroll', onReposition, true)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        ref="popoverRef"
        role="dialog"
        aria-modal="true"
        aria-label="Date time picker"
        class="fixed z-50 w-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg dark:shadow-black/20"
        :style="positionStyle"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
