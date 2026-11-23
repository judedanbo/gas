import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  getCurrentInstance,
  useId
} from 'vue'
import SiteAnnouncement from '~/components/common/SiteAnnouncement.vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useSiteAnnouncement, resetSiteAnnouncement } from '~/composables/useSiteAnnouncement'
import type { SitePopup } from '~/types'

// The component and composable rely on Nuxt auto-imports; provide them as globals.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('getCurrentInstance', getCurrentInstance)
vi.stubGlobal('useId', useId)
vi.stubGlobal('useFocusTrap', useFocusTrap)
vi.stubGlobal('useSiteAnnouncement', useSiteAnnouncement)

const popup: SitePopup = {
  id: 4,
  title: 'Audit Week 2026',
  imageUrl: '/uploads/images/audit-week.png',
  altText: 'Audit Week runs 1–5 December',
  linkUrl: '/media/events',
  openInNewTab: false,
  displaySeconds: 30,
  isDismissible: false
}

let imageLoads = true

// happy-dom never fires image load events; resolve the preload deterministically.
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    queueMicrotask(() => (imageLoads ? this.onload?.() : this.onerror?.()))
  }
}

// tests/setup.ts stubs $fetch with vi.fn(). Cast rather than vi.mocked(): Nitro's
// typed-route $fetch is too deep for TypeScript to wrap in a mock type.
const fetchMock = $fetch as unknown as Mock

function mockApi(value: SitePopup | null) {
  fetchMock.mockResolvedValue({ popup: value })
}

async function mountAnnouncement() {
  const wrapper = mount(SiteAnnouncement, {
    attachTo: document.body,
    global: {
      mocks: {
        $t: (key: string, params?: Record<string, unknown>) =>
          params ? `${key}:${params.seconds}` : key
      },
      stubs: { Teleport: true, Icon: true }
    }
  })
  await flushPromises()
  return wrapper
}

describe('CommonSiteAnnouncement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('Image', FakeImage)
    imageLoads = true
    resetSiteAnnouncement()
    sessionStorage.clear()
    document.body.style.overflow = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('renders nothing when no pop-up is live', async () => {
    mockApi(null)
    const wrapper = await mountAnnouncement()
    expect(fetchMock).toHaveBeenCalledWith('/api/announcement')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the image as a link inside a labelled modal dialog', async () => {
    mockApi(popup)
    const wrapper = await mountAnnouncement()

    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-label')).toBe('Audit Week 2026')

    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('/media/events')
    expect(link.attributes('target')).toBeUndefined()
    expect(link.find('img').attributes('src')).toBe('/uploads/images/audit-week.png')
    expect(link.find('img').attributes('alt')).toBe('Audit Week runs 1–5 December')
    expect(document.body.style.overflow).toBe('hidden')
    wrapper.unmount()
  })

  it('counts down and closes itself when the display time runs out', async () => {
    mockApi({ ...popup, displaySeconds: 3 })
    const wrapper = await mountAnnouncement()
    const countdown = () => wrapper.find('[data-testid="announcement-countdown"]').text()

    expect(countdown()).toBe('announcement.closesIn:3')
    await vi.advanceTimersByTimeAsync(1000)
    expect(countdown()).toBe('announcement.closesIn:2')
    await vi.advanceTimersByTimeAsync(2000)

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('cannot be closed early by default', async () => {
    mockApi(popup)
    const wrapper = await mountAnnouncement()

    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.find('[data-testid="announcement-backdrop"]').trigger('click')
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('offers a close button, Escape and backdrop click when dismissible', async () => {
    mockApi({ ...popup, isDismissible: true })

    let wrapper = await mountAnnouncement()
    await wrapper.find('button[aria-label="common.close"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()

    resetSiteAnnouncement()
    wrapper = await mountAnnouncement()
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()

    resetSiteAnnouncement()
    wrapper = await mountAnnouncement()
    await wrapper.find('[data-testid="announcement-backdrop"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders a plain image when there is no link', async () => {
    mockApi({ ...popup, linkUrl: undefined })
    const wrapper = await mountAnnouncement()
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens external links in a new tab safely when asked to', async () => {
    mockApi({ ...popup, linkUrl: 'https://example.com', openInNewTab: true })
    const wrapper = await mountAnnouncement()
    const link = wrapper.find('a')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.text()).toContain('announcement.opensInNewTab')
    wrapper.unmount()
  })

  it('stays hidden when the image fails to load', async () => {
    imageLoads = false
    mockApi(popup)
    const wrapper = await mountAnnouncement()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('stays hidden when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const wrapper = await mountAnnouncement()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows once per page load, not again on in-app navigation', async () => {
    mockApi({ ...popup, isDismissible: true })
    const first = await mountAnnouncement()
    expect(first.find('[role="dialog"]').exists()).toBe(true)
    first.unmount()

    // Same page load (no reset): e.g. the layout remounting after navigation
    const second = await mountAnnouncement()
    expect(second.find('[role="dialog"]').exists()).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    second.unmount()
  })

  it('skips the page load that follows a click on its own link', async () => {
    mockApi(popup)
    const first = await mountAnnouncement()
    // Stop happy-dom from trying to navigate
    first.find('a').element.addEventListener('click', (e) => e.preventDefault())
    await first.find('a').trigger('click')
    expect(first.find('[role="dialog"]').exists()).toBe(false)
    first.unmount()

    // The destination page load
    resetSiteAnnouncement()
    const second = await mountAnnouncement()
    expect(second.find('[role="dialog"]').exists()).toBe(false)
    second.unmount()

    // Any later load shows it again
    resetSiteAnnouncement()
    const third = await mountAnnouncement()
    expect(third.find('[role="dialog"]').exists()).toBe(true)
    third.unmount()
  })
})
