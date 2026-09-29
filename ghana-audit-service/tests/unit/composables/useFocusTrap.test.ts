import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { useFocusTrap, getFocusableElements } from '~/composables/useFocusTrap'

function pressTab(shiftKey = false) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
  )
}

const TrapHost = defineComponent({
  props: { active: { type: Boolean, default: true } },
  setup(props) {
    const container = ref<HTMLElement | null>(null)
    const active = ref(props.active)
    useFocusTrap(container, { active })
    return { container, active }
  },
  template: `
    <div>
      <button id="outside" type="button">outside</button>
      <div ref="container" tabindex="-1" id="trap">
        <button id="first" type="button">first</button>
        <a id="middle" href="#">middle</a>
        <button id="last" type="button">last</button>
      </div>
    </div>
  `
})

describe('useFocusTrap', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('lists focusable elements inside a container', () => {
    const div = document.createElement('div')
    div.innerHTML = `
      <button>a</button>
      <button disabled>b</button>
      <a>no href</a>
      <a href="#">c</a>
      <input type="hidden" />
      <div tabindex="0">d</div>
      <div tabindex="-1">e</div>
    `
    document.body.appendChild(div)
    expect(getFocusableElements(div).map((el) => el.textContent?.trim())).toEqual(['a', 'c', 'd'])
  })

  it('moves focus into the container on mount and restores it on unmount', async () => {
    const opener = document.createElement('button')
    opener.id = 'opener'
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    wrapper = mount(TrapHost, { attachTo: document.body })
    await nextTick()
    await nextTick()
    expect(document.activeElement?.id).toBe('first')

    wrapper.unmount()
    wrapper = null
    expect(document.activeElement).toBe(opener)
  })

  it('wraps Tab from the last element to the first, and Shift+Tab from first to last', async () => {
    wrapper = mount(TrapHost, { attachTo: document.body })
    await nextTick()
    await nextTick()

    const last = document.getElementById('last') as HTMLElement
    last.focus()
    pressTab()
    expect(document.activeElement?.id).toBe('first')

    pressTab(true)
    expect(document.activeElement?.id).toBe('last')
  })

  it('pulls focus back inside when it has escaped the container', async () => {
    wrapper = mount(TrapHost, { attachTo: document.body })
    await nextTick()
    await nextTick()

    const outside = document.getElementById('outside') as HTMLElement
    outside.focus()
    pressTab()
    expect(document.activeElement?.id).toBe('first')
  })

  it('does nothing while inactive', async () => {
    wrapper = mount(TrapHost, { props: { active: false }, attachTo: document.body })
    await nextTick()
    await nextTick()

    const outside = document.getElementById('outside') as HTMLElement
    outside.focus()
    pressTab()
    expect(document.activeElement).toBe(outside)
  })
})
