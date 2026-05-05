import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'

// Mock Vue globals
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// Mock NuxtLink component
const NuxtLinkStub = {
  name: 'NuxtLink',
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

// Mock LoadingSpinner component
const LoadingSpinnerStub = {
  name: 'LoadingSpinner',
  props: ['size'],
  template: '<span class="loading-spinner"></span>'
}

// Create BaseButton component for testing (simplified version)
const BaseButton = {
  name: 'BaseButton',
  components: {
    NuxtLink: NuxtLinkStub,
    LoadingSpinner: LoadingSpinnerStub
  },
  props: {
    variant: { type: String, default: 'primary' },
    size: { type: String, default: 'md' },
    to: { type: String, default: undefined },
    type: { type: String, default: 'button' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    block: { type: Boolean, default: false }
  },
  setup(props: Record<string, unknown>) {
    const buttonClasses = computed(() => {
      const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

      const variants: Record<string, string> = {
        primary: 'bg-primary text-white hover:bg-primary-dark focus:ring-primary',
        secondary: 'bg-secondary text-white hover:bg-secondary-dark focus:ring-secondary',
        accent: 'bg-accent text-gray-900 hover:bg-accent-dark focus:ring-accent',
        outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white focus:ring-primary',
        ghost: 'text-primary hover:bg-primary/10 focus:ring-primary'
      }

      const sizes: Record<string, string> = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg'
      }

      return [
        base,
        variants[props.variant as string],
        sizes[props.size as string],
        props.block ? 'w-full' : ''
      ].join(' ')
    })

    return { buttonClasses }
  },
  template: `
    <component
      :is="to ? 'a' : 'button'"
      :href="to"
      :type="to ? undefined : type"
      :disabled="disabled || loading"
      :class="buttonClasses"
    >
      <LoadingSpinner v-if="loading" size="sm" class="mr-2" />
      <slot />
    </component>
  `
}

describe('BaseButton', () => {
  describe('rendering', () => {
    it('should render as a button by default', () => {
      const wrapper = mount(BaseButton, {
        slots: { default: 'Click me' }
      })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.text()).toBe('Click me')
    })

    it('should render as a link when "to" prop is provided', () => {
      const wrapper = mount(BaseButton, {
        props: { to: '/about' },
        slots: { default: 'Go to About' }
      })

      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.attributes('href')).toBe('/about')
    })

    it('should render slot content', () => {
      const wrapper = mount(BaseButton, {
        slots: { default: 'Test Button' }
      })

      expect(wrapper.text()).toBe('Test Button')
    })
  })

  describe('variants', () => {
    it('should apply primary variant classes by default', () => {
      const wrapper = mount(BaseButton)

      expect(wrapper.classes()).toContain('bg-primary')
      expect(wrapper.classes()).toContain('text-white')
    })

    it('should apply secondary variant classes', () => {
      const wrapper = mount(BaseButton, {
        props: { variant: 'secondary' }
      })

      expect(wrapper.classes()).toContain('bg-secondary')
    })

    it('should apply accent variant classes', () => {
      const wrapper = mount(BaseButton, {
        props: { variant: 'accent' }
      })

      expect(wrapper.classes()).toContain('bg-accent')
    })

    it('should apply outline variant classes', () => {
      const wrapper = mount(BaseButton, {
        props: { variant: 'outline' }
      })

      expect(wrapper.classes()).toContain('border-2')
      expect(wrapper.classes()).toContain('border-primary')
    })

    it('should apply ghost variant classes', () => {
      const wrapper = mount(BaseButton, {
        props: { variant: 'ghost' }
      })

      expect(wrapper.classes()).toContain('text-primary')
    })
  })

  describe('sizes', () => {
    it('should apply medium size classes by default', () => {
      const wrapper = mount(BaseButton)

      expect(wrapper.classes()).toContain('px-4')
      expect(wrapper.classes()).toContain('py-2')
      expect(wrapper.classes()).toContain('text-base')
    })

    it('should apply small size classes', () => {
      const wrapper = mount(BaseButton, {
        props: { size: 'sm' }
      })

      expect(wrapper.classes()).toContain('px-3')
      expect(wrapper.classes()).toContain('text-sm')
    })

    it('should apply large size classes', () => {
      const wrapper = mount(BaseButton, {
        props: { size: 'lg' }
      })

      expect(wrapper.classes()).toContain('px-6')
      expect(wrapper.classes()).toContain('py-3')
      expect(wrapper.classes()).toContain('text-lg')
    })
  })

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      const wrapper = mount(BaseButton, {
        props: { disabled: true }
      })

      expect(wrapper.attributes('disabled')).toBeDefined()
    })

    it('should be disabled when loading prop is true', () => {
      const wrapper = mount(BaseButton, {
        props: { loading: true }
      })

      expect(wrapper.attributes('disabled')).toBeDefined()
    })
  })

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      const wrapper = mount(BaseButton, {
        props: { loading: true }
      })

      expect(wrapper.findComponent(LoadingSpinnerStub).exists()).toBe(true)
    })

    it('should not show loading spinner when not loading', () => {
      const wrapper = mount(BaseButton, {
        props: { loading: false }
      })

      expect(wrapper.findComponent(LoadingSpinnerStub).exists()).toBe(false)
    })
  })

  describe('block mode', () => {
    it('should apply w-full class when block is true', () => {
      const wrapper = mount(BaseButton, {
        props: { block: true }
      })

      expect(wrapper.classes()).toContain('w-full')
    })

    it('should not apply w-full class when block is false', () => {
      const wrapper = mount(BaseButton, {
        props: { block: false }
      })

      expect(wrapper.classes()).not.toContain('w-full')
    })
  })

  describe('button type', () => {
    it('should have type="button" by default', () => {
      const wrapper = mount(BaseButton)

      expect(wrapper.attributes('type')).toBe('button')
    })

    it('should allow type="submit"', () => {
      const wrapper = mount(BaseButton, {
        props: { type: 'submit' }
      })

      expect(wrapper.attributes('type')).toBe('submit')
    })

    it('should not have type attribute when rendered as link', () => {
      const wrapper = mount(BaseButton, {
        props: { to: '/test' }
      })

      expect(wrapper.attributes('type')).toBeUndefined()
    })
  })

  describe('events', () => {
    it('should emit click event', async () => {
      const wrapper = mount(BaseButton)

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
    })

    it('should not emit click when disabled', async () => {
      const onClick = vi.fn()
      const wrapper = mount(BaseButton, {
        props: { disabled: true },
        attrs: { onClick }
      })

      await wrapper.trigger('click')

      // Native disabled buttons don't emit click events
      expect(onClick).not.toHaveBeenCalled()
    })
  })
})
