import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, watch, nextTick, onUnmounted, useId, defineComponent } from 'vue'
import BaseModal from '~/components/ui/BaseModal.vue'
import { useFocusTrap } from '~/composables/useFocusTrap'

// The component relies on Nuxt auto-imports; provide them as globals.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('useId', useId)
vi.stubGlobal('useFocusTrap', useFocusTrap)

type ModalProps = InstanceType<typeof BaseModal>['$props']

function mountModal(options: { props: ModalProps; slots?: Record<string, string> }) {
  return mount(BaseModal, {
    attachTo: document.body,
    props: options.props,
    slots: options.slots,
    global: {
      mocks: { $t: (key: string) => key },
      // Render teleported content inline so it can be queried through the wrapper
      stubs: { Teleport: true, Icon: true, Transition: false }
    }
  })
}

describe('BaseModal (real component)', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  describe('visibility', () => {
    it('does not render when modelValue is false', () => {
      const wrapper = mountModal({ props: { modelValue: false } })
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('renders when modelValue is true', () => {
      const wrapper = mountModal({ props: { modelValue: true } })
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      expect(wrapper.find('[role="dialog"]').attributes('aria-modal')).toBe('true')
      wrapper.unmount()
    })
  })

  describe('labelling', () => {
    it('links the dialog to its title with a unique id per instance', () => {
      // Two modals inside one app (as on a real page) must not share an id
      const Host = defineComponent({
        components: { BaseModal },
        template: `<div>
          <BaseModal :model-value="true" title="First" />
          <BaseModal :model-value="true" title="Second" />
        </div>`
      })
      const wrapper = mount(Host, {
        attachTo: document.body,
        global: {
          mocks: { $t: (key: string) => key },
          stubs: { Teleport: true, Icon: true, Transition: false }
        }
      })

      const dialogs = wrapper.findAll('[role="dialog"]')
      const idA = dialogs[0]!.attributes('aria-labelledby')
      const idB = dialogs[1]!.attributes('aria-labelledby')

      expect(idA).toBeTruthy()
      expect(idB).toBeTruthy()
      expect(idA).not.toBe(idB)
      expect(wrapper.find(`#${CSS.escape(idA!)}`).text()).toBe('First')
      expect(wrapper.find(`#${CSS.escape(idB!)}`).text()).toBe('Second')

      wrapper.unmount()
    })

    it('has no aria-labelledby without a title', () => {
      const wrapper = mountModal({ props: { modelValue: true } })
      expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBeUndefined()
      wrapper.unmount()
    })
  })

  describe('closing', () => {
    it('emits update:modelValue=false from the close button', async () => {
      const wrapper = mountModal({ props: { modelValue: true } })
      await wrapper.find('button[aria-label="common.close"]').trigger('click')
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
      wrapper.unmount()
    })

    it('closes on backdrop click by default and not when closeOnBackdrop is false', async () => {
      const open = mountModal({ props: { modelValue: true } })
      await open.find('.absolute.inset-0').trigger('click')
      expect(open.emitted('update:modelValue')?.[0]).toEqual([false])
      open.unmount()

      const locked = mountModal({ props: { modelValue: true, closeOnBackdrop: false } })
      await locked.find('.absolute.inset-0').trigger('click')
      expect(locked.emitted('update:modelValue')).toBeFalsy()
      locked.unmount()
    })

    it('closes on Escape', async () => {
      const wrapper = mountModal({ props: { modelValue: true } })
      await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
      wrapper.unmount()
    })
  })

  describe('focus management', () => {
    it('moves focus into the dialog when opened and returns it when closed', async () => {
      const opener = document.createElement('button')
      opener.id = 'opener'
      document.body.appendChild(opener)
      opener.focus()

      const wrapper = mountModal({ props: { modelValue: false, title: 'Focus' } })
      await wrapper.setProps({ modelValue: true })
      await nextTick()
      await nextTick()

      const dialog = wrapper.find('[role="dialog"]').element as HTMLElement
      expect(dialog.contains(document.activeElement)).toBe(true)
      expect(document.body.style.overflow).toBe('hidden')

      await wrapper.setProps({ modelValue: false })
      await nextTick()
      expect(document.activeElement).toBe(opener)
      expect(document.body.style.overflow).toBe('')
      wrapper.unmount()
    })

    it('keeps Tab inside the dialog', async () => {
      const wrapper = mountModal({
        props: { modelValue: true, title: 'Trap' },
        slots: {
          default: '<input id="field" />',
          footer: '<button id="save" type="button">Save</button>'
        }
      })
      await nextTick()
      await nextTick()

      const save = document.getElementById('save') as HTMLElement
      save.focus()
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      )
      // First focusable element is the close button
      expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe(
        'common.close'
      )
      wrapper.unmount()
    })
  })

  describe('slots and sizes', () => {
    it('renders header, default and footer slots', () => {
      const wrapper = mountModal({
        props: { modelValue: true },
        slots: {
          header: '<span class="custom-header">Custom</span>',
          default: '<p>Body</p>',
          footer: '<button class="footer-btn">Save</button>'
        }
      })
      expect(wrapper.find('.custom-header').exists()).toBe(true)
      expect(wrapper.find('p').text()).toBe('Body')
      expect(wrapper.find('.footer-btn').exists()).toBe(true)
      wrapper.unmount()
    })

    it.each([
      ['sm', 'max-w-sm'],
      ['md', 'max-w-md'],
      ['lg', 'max-w-lg'],
      ['xl', 'max-w-xl'],
      ['full', 'max-w-4xl']
    ])('applies the %s size', (size, cls) => {
      const wrapper = mountModal({ props: { modelValue: true, size: size as never } })
      expect(wrapper.find('[role="dialog"]').classes()).toContain(cls)
      wrapper.unmount()
    })

    it('applies maxHeight to the body', () => {
      const wrapper = mountModal({ props: { modelValue: true, maxHeight: '50vh' } })
      expect(wrapper.find('.overflow-y-auto').attributes('style')).toContain('max-height: 50vh')
      wrapper.unmount()
    })
  })
})
