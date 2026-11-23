import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, useId, type Component } from 'vue'
import AdminFormGroup from '~/components/admin/form/AdminFormGroup.vue'
import AdminInput from '~/components/admin/form/AdminInput.vue'
import AdminTextarea from '~/components/admin/form/AdminTextarea.vue'
import AdminSelect from '~/components/admin/form/AdminSelect.vue'
import AdminSwitch from '~/components/admin/form/AdminSwitch.vue'

// The components rely on Nuxt auto-imports; provide them as globals.
vi.stubGlobal('computed', computed)
vi.stubGlobal('useId', useId)

function mountField(component: Component, props: Record<string, unknown>) {
  return mount(component, { props, global: { components: { AdminFormGroup } } })
}

const cases: Array<[string, Component, string, Record<string, unknown>]> = [
  ['AdminInput', AdminInput, 'input', {}],
  ['AdminTextarea', AdminTextarea, 'textarea', {}],
  ['AdminSelect', AdminSelect, 'select', { options: [{ value: 'a', label: 'A' }] }],
  ['AdminSwitch', AdminSwitch, 'button[role="switch"]', { modelValue: false }]
]

describe('admin form fields tie their label to the control', () => {
  it.each(cases)('%s without an id generates one', (_name, component, selector, extra) => {
    const wrapper = mountField(component, { label: 'Title', ...extra })
    const id = wrapper.find(selector).attributes('id')
    expect(id).toBeTruthy()
    expect(wrapper.find('label').attributes('for')).toBe(id)
  })

  it.each(cases)('%s keeps an explicit id', (_name, component, selector, extra) => {
    const wrapper = mountField(component, { label: 'Title', id: 'my-field', ...extra })
    expect(wrapper.find(selector).attributes('id')).toBe('my-field')
    expect(wrapper.find('label').attributes('for')).toBe('my-field')
  })

  it('gives two fields on one page different ids', () => {
    const wrapper = mount(
      { template: '<div><AdminInput label="A" /><AdminInput label="B" /></div>' },
      { global: { components: { AdminFormGroup, AdminInput } } }
    )
    const [a, b] = wrapper.findAll('input').map((input) => input.attributes('id'))
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })
})
