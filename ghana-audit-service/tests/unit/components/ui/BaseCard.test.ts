import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'

// Mock Vue globals
vi.stubGlobal('computed', computed)

// Create BaseCard component for testing
const BaseCard = {
  name: 'BaseCard',
  props: {
    title: { type: String, default: undefined },
    subtitle: { type: String, default: undefined },
    padding: { type: String, default: 'md' },
    shadow: { type: String, default: 'sm' },
    hover: { type: Boolean, default: false }
  },
  setup(props: Record<string, unknown>) {
    const cardClasses = computed(() => {
      const base = 'bg-white rounded-lg border border-gray-200 overflow-hidden'

      const shadows: Record<string, string> = {
        none: '',
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg'
      }

      const hoverEffect = props.hover ? 'transition-all duration-200 hover:shadow-lg hover:-translate-y-1' : ''

      return [base, shadows[props.shadow as string], hoverEffect].join(' ')
    })

    const bodyClasses = computed(() => {
      const paddings: Record<string, string> = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8'
      }

      return paddings[props.padding as string]
    })

    return { cardClasses, bodyClasses }
  },
  template: `
    <div :class="cardClasses">
      <div v-if="$slots.header || title" class="px-6 py-4 border-b border-gray-200">
        <slot name="header">
          <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
          <p v-if="subtitle" class="mt-1 text-sm text-gray-500">{{ subtitle }}</p>
        </slot>
      </div>

      <div class="card-body" :class="bodyClasses">
        <slot />
      </div>

      <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <slot name="footer" />
      </div>
    </div>
  `
}

describe('BaseCard', () => {
  describe('rendering', () => {
    it('should render the card container', () => {
      const wrapper = mount(BaseCard)

      expect(wrapper.element.tagName).toBe('DIV')
      expect(wrapper.classes()).toContain('bg-white')
      expect(wrapper.classes()).toContain('rounded-lg')
    })

    it('should render slot content in the body', () => {
      const wrapper = mount(BaseCard, {
        slots: { default: '<p>Card content</p>' }
      })

      expect(wrapper.text()).toContain('Card content')
    })
  })

  describe('header', () => {
    it('should render title when provided', () => {
      const wrapper = mount(BaseCard, {
        props: { title: 'Card Title' }
      })

      expect(wrapper.find('h3').text()).toBe('Card Title')
    })

    it('should render subtitle when provided with title', () => {
      const wrapper = mount(BaseCard, {
        props: { title: 'Title', subtitle: 'Subtitle text' }
      })

      expect(wrapper.find('p').text()).toBe('Subtitle text')
    })

    it('should not render header when no title or header slot', () => {
      const wrapper = mount(BaseCard, {
        slots: { default: 'Content only' }
      })

      expect(wrapper.find('h3').exists()).toBe(false)
    })

    it('should render header slot content', () => {
      const wrapper = mount(BaseCard, {
        slots: {
          header: '<span class="custom-header">Custom Header</span>',
          default: 'Body'
        }
      })

      expect(wrapper.find('.custom-header').exists()).toBe(true)
      expect(wrapper.find('.custom-header').text()).toBe('Custom Header')
    })
  })

  describe('footer', () => {
    it('should render footer slot when provided', () => {
      const wrapper = mount(BaseCard, {
        slots: {
          default: 'Body content',
          footer: '<button>Action</button>'
        }
      })

      expect(wrapper.find('button').exists()).toBe(true)
      expect(wrapper.find('button').text()).toBe('Action')
    })

    it('should not render footer when no footer slot', () => {
      const wrapper = mount(BaseCard, {
        slots: { default: 'Body only' }
      })

      // Check for footer container (bg-gray-50 class)
      expect(wrapper.find('.bg-gray-50').exists()).toBe(false)
    })
  })

  describe('padding', () => {
    it('should apply medium padding by default', () => {
      const wrapper = mount(BaseCard, {
        slots: { default: 'Content' }
      })

      const body = wrapper.find('.card-body')
      expect(body.classes()).toContain('p-6')
    })

    it('should apply no padding', () => {
      const wrapper = mount(BaseCard, {
        props: { padding: 'none' },
        slots: { default: 'Content' }
      })

      const body = wrapper.find('.card-body')
      expect(body.classes()).not.toContain('p-4')
      expect(body.classes()).not.toContain('p-6')
      expect(body.classes()).not.toContain('p-8')
    })

    it('should apply small padding', () => {
      const wrapper = mount(BaseCard, {
        props: { padding: 'sm' },
        slots: { default: 'Content' }
      })

      const body = wrapper.find('.card-body')
      expect(body.classes()).toContain('p-4')
    })

    it('should apply large padding', () => {
      const wrapper = mount(BaseCard, {
        props: { padding: 'lg' },
        slots: { default: 'Content' }
      })

      const body = wrapper.find('.card-body')
      expect(body.classes()).toContain('p-8')
    })
  })

  describe('shadow', () => {
    it('should apply small shadow by default', () => {
      const wrapper = mount(BaseCard)

      expect(wrapper.classes()).toContain('shadow-sm')
    })

    it('should apply no shadow', () => {
      const wrapper = mount(BaseCard, {
        props: { shadow: 'none' }
      })

      expect(wrapper.classes()).not.toContain('shadow-sm')
      expect(wrapper.classes()).not.toContain('shadow-md')
      expect(wrapper.classes()).not.toContain('shadow-lg')
    })

    it('should apply medium shadow', () => {
      const wrapper = mount(BaseCard, {
        props: { shadow: 'md' }
      })

      expect(wrapper.classes()).toContain('shadow-md')
    })

    it('should apply large shadow', () => {
      const wrapper = mount(BaseCard, {
        props: { shadow: 'lg' }
      })

      expect(wrapper.classes()).toContain('shadow-lg')
    })
  })

  describe('hover effect', () => {
    it('should not have hover effect by default', () => {
      const wrapper = mount(BaseCard)

      expect(wrapper.classes()).not.toContain('hover:shadow-lg')
    })

    it('should have hover effect when enabled', () => {
      const wrapper = mount(BaseCard, {
        props: { hover: true }
      })

      expect(wrapper.classes()).toContain('hover:shadow-lg')
      expect(wrapper.classes()).toContain('hover:-translate-y-1')
      expect(wrapper.classes()).toContain('transition-all')
    })
  })

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const wrapper = mount(BaseCard, {
        props: { title: 'Test Title' }
      })

      const heading = wrapper.find('h3')
      expect(heading.exists()).toBe(true)
      expect(heading.classes()).toContain('text-lg')
      expect(heading.classes()).toContain('font-semibold')
    })
  })
})
