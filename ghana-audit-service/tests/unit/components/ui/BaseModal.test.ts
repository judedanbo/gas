import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'

// Mock Vue globals
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onUnmounted', onUnmounted)

// Mock document.body
// const originalBody = document.body

// Create BaseModal component for testing
const BaseModal = {
  name: 'BaseModal',
  props: {
    modelValue: { type: Boolean, required: true },
    title: { type: String, default: undefined },
    size: { type: String, default: 'md' },
    showClose: { type: Boolean, default: true },
    closeOnBackdrop: { type: Boolean, default: true },
    maxHeight: { type: String, default: '70vh' }
  },
  emits: ['update:modelValue'],
  setup(
    props: Record<string, unknown>,
    { emit }: { emit: (event: string, ...args: unknown[]) => void }
  ) {
    const modalRef = ref<HTMLElement | null>(null)

    const modalClasses = computed(() => {
      const base = 'relative bg-white rounded-lg shadow-xl w-full'

      const sizes: Record<string, string> = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-4xl'
      }

      return [base, sizes[props.size as string]].join(' ')
    })

    function close() {
      emit('update:modelValue', false)
    }

    function handleBackdropClick() {
      if (props.closeOnBackdrop) {
        close()
      }
    }

    return { modalRef, modalClasses, close, handleBackdropClick }
  },
  template: `
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        data-testid="backdrop"
        @click="handleBackdropClick"
      />

      <!-- Modal Content -->
      <div
        ref="modalRef"
        :class="modalClasses"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : undefined"
      >
        <!-- Header -->
        <div v-if="title || $slots.header || showClose" class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <slot name="header">
            <h2 v-if="title" id="modal-title" class="text-xl font-semibold text-gray-900">
              {{ title }}
            </h2>
          </slot>
          <button
            v-if="showClose"
            type="button"
            class="close-button p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
            @click="close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="px-6 py-4 overflow-y-auto" :style="{ maxHeight: maxHeight }">
          <slot />
        </div>

        <!-- Footer -->
        <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <slot name="footer" />
        </div>
      </div>
    </div>
  `
}

describe('BaseModal', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  describe('visibility', () => {
    it('should not render when modelValue is false', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: false }
      })

      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    it('should render when modelValue is true', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    })
  })

  describe('title', () => {
    it('should render title when provided', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, title: 'Modal Title' }
      })

      expect(wrapper.find('#modal-title').text()).toBe('Modal Title')
    })

    it('should have aria-labelledby when title is provided', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, title: 'Modal Title' }
      })

      expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBe('modal-title')
    })

    it('should not have aria-labelledby when no title', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBeUndefined()
    })
  })

  describe('size', () => {
    it('should apply medium size by default', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      expect(wrapper.find('[role="dialog"]').classes()).toContain('max-w-md')
    })

    it('should apply small size', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, size: 'sm' }
      })

      expect(wrapper.find('[role="dialog"]').classes()).toContain('max-w-sm')
    })

    it('should apply large size', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, size: 'lg' }
      })

      expect(wrapper.find('[role="dialog"]').classes()).toContain('max-w-lg')
    })

    it('should apply xl size', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, size: 'xl' }
      })

      expect(wrapper.find('[role="dialog"]').classes()).toContain('max-w-xl')
    })

    it('should apply full size', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, size: 'full' }
      })

      expect(wrapper.find('[role="dialog"]').classes()).toContain('max-w-4xl')
    })
  })

  describe('close button', () => {
    it('should show close button by default', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      expect(wrapper.find('.close-button').exists()).toBe(true)
    })

    it('should hide close button when showClose is false', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, showClose: false }
      })

      expect(wrapper.find('.close-button').exists()).toBe(false)
    })

    it('should emit update:modelValue with false when close button clicked', async () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      await wrapper.find('.close-button').trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('should have proper aria-label', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      expect(wrapper.find('.close-button').attributes('aria-label')).toBe('Close modal')
    })
  })

  describe('backdrop', () => {
    it('should close on backdrop click by default', async () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      await wrapper.find('[data-testid="backdrop"]').trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('should not close on backdrop click when closeOnBackdrop is false', async () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, closeOnBackdrop: false }
      })

      await wrapper.find('[data-testid="backdrop"]').trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })
  })

  describe('slots', () => {
    it('should render default slot content', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true },
        slots: { default: '<p>Modal content</p>' }
      })

      expect(wrapper.find('p').text()).toBe('Modal content')
    })

    it('should render header slot', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true },
        slots: {
          header: '<span class="custom-header">Custom Header</span>',
          default: 'Body'
        }
      })

      expect(wrapper.find('.custom-header').exists()).toBe(true)
    })

    it('should render footer slot', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true },
        slots: {
          default: 'Body',
          footer: '<button class="footer-btn">Save</button>'
        }
      })

      expect(wrapper.find('.footer-btn').exists()).toBe(true)
    })
  })

  describe('accessibility', () => {
    it('should have role="dialog"', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    })

    it('should have aria-modal="true"', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      expect(wrapper.find('[role="dialog"]').attributes('aria-modal')).toBe('true')
    })
  })

  describe('maxHeight', () => {
    it('should apply default maxHeight', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true }
      })

      const body = wrapper.find('.overflow-y-auto')
      expect(body.attributes('style')).toContain('max-height: 70vh')
    })

    it('should apply custom maxHeight', () => {
      const wrapper = mount(BaseModal, {
        props: { modelValue: true, maxHeight: '50vh' }
      })

      const body = wrapper.find('.overflow-y-auto')
      expect(body.attributes('style')).toContain('max-height: 50vh')
    })
  })
})
