import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import LiveEventBanner from '../../../../components/home/LiveEventBanner.vue'
import type { LiveEvent } from '../../../../types'

// LiveEventBanner relies on Nuxt's auto-imported `computed` (resolved at
// mount time, so stubbing after the import is fine)
vi.stubGlobal('computed', computed)

const NuxtLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const liveEvent: LiveEvent = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Auditor-General press briefing',
  url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
}

function mountBanner(events: LiveEvent[]) {
  return mount(LiveEventBanner, {
    props: { events },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { NuxtLink: NuxtLinkStub }
    }
  })
}

describe('HomeLiveEventBanner', () => {
  it('renders nothing when no event is live', () => {
    const wrapper = mountBanner([])
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('renders an announced status bar with the event title when live', () => {
    const wrapper = mountBanner([liveEvent])

    const section = wrapper.find('section')
    expect(section.exists()).toBe(true)
    expect(section.attributes('role')).toBe('status')
    expect(section.attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).toContain('home.liveBanner.label')
    expect(wrapper.text()).toContain('Auditor-General press briefing')
  })

  it('links to the videos page with a play deep link', () => {
    const wrapper = mountBanner([liveEvent])

    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('/media/videos?play=dQw4w9WgXcQ')
    expect(link.text()).toContain('home.liveBanner.watchNow')
  })

  it('shows only the first event when multiple are live', () => {
    const second: LiveEvent = { ...liveEvent, videoId: 'aaaaaaaaaaa', title: 'Second stream' }
    const wrapper = mountBanner([liveEvent, second])

    expect(wrapper.text()).toContain('Auditor-General press briefing')
    expect(wrapper.text()).not.toContain('Second stream')
  })
})
