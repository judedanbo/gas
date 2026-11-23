import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref, useId, onUnmounted, type Component } from 'vue'
import AdminFormGroup from '~/components/admin/form/AdminFormGroup.vue'
import AdminInput from '~/components/admin/form/AdminInput.vue'
import AdminTextarea from '~/components/admin/form/AdminTextarea.vue'
import AdminSelect from '~/components/admin/form/AdminSelect.vue'
import AdminSwitch from '~/components/admin/form/AdminSwitch.vue'
import AdminFileUpload from '~/components/admin/form/AdminFileUpload.vue'

// The components rely on Nuxt auto-imports; provide them as globals.
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('useId', useId)
vi.stubGlobal('onUnmounted', onUnmounted)
// AdminFileUpload only touches these when a file is chosen
vi.stubGlobal('useAdminApi', () => ({}))
vi.stubGlobal('useAdminNotifications', () => ({}))

function mountField(component: Component, props: Record<string, unknown>) {
  return mount(component, {
    attachTo: document.body,
    props,
    global: { components: { AdminFormGroup } }
  })
}

const fields: Array<{
  name: string
  component: Component
  control: string
  props?: Record<string, unknown>
}> = [
  { name: 'AdminInput', component: AdminInput, control: 'input' },
  { name: 'AdminTextarea', component: AdminTextarea, control: 'textarea' },
  { name: 'AdminSelect', component: AdminSelect, control: 'select', props: { options: [] } },
  {
    name: 'AdminSwitch',
    component: AdminSwitch,
    control: 'button[role="switch"]',
    props: { modelValue: false }
  },
  { name: 'AdminFileUpload', component: AdminFileUpload, control: 'input[type="file"]' }
]

describe('admin form controls: label association', () => {
  describe.each(fields)('$name', ({ component, control, props }) => {
    it('associates the label with the control when no id is passed', () => {
      const wrapper = mountField(component, { label: 'Title', ...props })

      const labelFor = wrapper.find('label').attributes('for')
      expect(labelFor).toBeTruthy()

      const target = wrapper.element.ownerDocument.getElementById(labelFor!)
      expect(target).toBe(wrapper.find(control).element)

      wrapper.unmount()
    })

    it('uses an explicit id for both the label and the control', () => {
      const wrapper = mountField(component, { label: 'Title', id: 'explicit-id', ...props })

      expect(wrapper.find('label').attributes('for')).toBe('explicit-id')
      expect(wrapper.find(control).attributes('id')).toBe('explicit-id')

      wrapper.unmount()
    })

    it('gives each instance its own id', () => {
      const Pair = {
        components: { Field: component },
        setup: () => ({ fieldProps: { label: 'Title', ...props } }),
        template: '<div><Field v-bind="fieldProps" /><Field v-bind="fieldProps" /></div>'
      }
      const wrapper = mountField(Pair, {})

      const ids = wrapper.findAll(control).map((c) => c.attributes('id'))
      expect(ids).toHaveLength(2)
      expect(ids[0]).toBeTruthy()
      expect(ids[0]).not.toBe(ids[1])

      wrapper.unmount()
    })
  })
})
