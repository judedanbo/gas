import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import StatsCounter from '~/components/home/StatsCounter.vue'

// StatsCounter uses Nuxt auto-imports (ref/computed/watch/onMounted) with no
// explicit import statements, so expose them as globals for the bare SFC.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onMounted', onMounted)

// Capture the IntersectionObserver callback so tests can trigger visibility.
let ioCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
class MockIntersectionObserver {
  constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
    ioCallback = cb
  }
  observe() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

// Drive each count-up to completion synchronously: setTimeout (the stagger) and
// requestAnimationFrame (the frame loop) both run immediately, and performance
// jumps past the duration so a single frame reaches the target.
vi.stubGlobal('performance', { now: () => 0 })
vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
  cb(1_000_000)
  return 0
})
vi.stubGlobal('setTimeout', (fn: () => void) => {
  fn()
  return 0
})

function reveal() {
  ioCallback?.([{ isIntersecting: true }])
}

describe('HomeStatsCounter', () => {
  it('animates to the initial targets once the section is revealed', async () => {
    const wrapper = mount(StatsCounter, {
      props: { stats: [{ label: 'Staff Members', value: 2295, suffix: '' }] }
    })
    reveal()
    await nextTick()

    expect(wrapper.text()).toContain('2295')
  })

  it('re-animates when a stat value changes after the section was revealed', async () => {
    const wrapper = mount(StatsCounter, {
      props: { stats: [{ label: 'Staff Members', value: 2295, suffix: '' }] }
    })
    reveal()
    await nextTick()
    expect(wrapper.text()).toContain('2295')

    // An admin edits the figure; the parent passes new props while mounted.
    // Before the fix the counter stayed frozen on 2295.
    await wrapper.setProps({ stats: [{ label: 'Staff Members', value: 2400, suffix: '' }] })
    await nextTick()

    expect(wrapper.text()).toContain('2400')
    expect(wrapper.text()).not.toContain('2295')
  })

  it('grows the animated buffer when stats arrive/expand after reveal', async () => {
    const wrapper = mount(StatsCounter, {
      props: { stats: [{ label: 'Staff Members', value: 2295, suffix: '' }] }
    })
    reveal()
    await nextTick()

    await wrapper.setProps({
      stats: [
        { label: 'Staff Members', value: 2295, suffix: '' },
        { label: 'Regions Covered', value: 16, suffix: '' }
      ]
    })
    await nextTick()

    expect(wrapper.text()).toContain('2295')
    expect(wrapper.text()).toContain('16')
    expect(wrapper.text()).toContain('Regions Covered')
  })
})
