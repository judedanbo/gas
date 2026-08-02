import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, watch } from 'vue'
import BaseImage from '~/components/ui/BaseImage.vue'

// Auto-imported in Nuxt; absent under plain Vitest.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)

const global = {
  stubs: {
    NuxtImg: { name: 'NuxtImg', props: ['src', 'alt'], template: '<img :src="src" :alt="alt" />' },
    Icon: { name: 'Icon', props: ['name'], template: '<span class="icon" :data-icon="name" />' }
  }
}

describe('UiBaseImage', () => {
  it('renders a root-relative src through NuxtImg so IPX can optimise it', () => {
    const wrapper = mount(BaseImage, { props: { src: '/img/news/a.jpg', alt: 'A' }, global })

    expect(wrapper.findComponent({ name: 'NuxtImg' }).exists()).toBe(true)
    expect(wrapper.find('.icon').exists()).toBe(false)
  })

  it.each([
    ['remote', 'https://i.ytimg.com/vi/abc/hqdefault.jpg'],
    ['blob preview', 'blob:http://localhost/9f8e-1234'],
    ['data URI', 'data:image/png;base64,iVBORw0KGgo=']
  ])('renders a %s src as a plain img, bypassing IPX', (_label, src) => {
    // IPX rejects non-root-relative sources: remote hosts are not in
    // image.domains, and blob:/data: cannot be fetched server-side at all.
    const wrapper = mount(BaseImage, { props: { src, alt: 'X' }, global })

    expect(wrapper.findComponent({ name: 'NuxtImg' }).exists()).toBe(false)
    expect(wrapper.find('img').attributes('src')).toBe(src)
  })

  it('shows the placeholder icon when there is no src', () => {
    const wrapper = mount(BaseImage, { props: { src: undefined, alt: 'Missing' }, global })

    expect(wrapper.find('.icon').exists()).toBe(true)
    expect(wrapper.find('.icon').attributes('data-icon')).toBe('heroicons:photo')
  })

  it('swaps to the placeholder when the image 404s', async () => {
    // The regression this guards: every other site in the app only checks that
    // the URL is non-empty, so a truthy-but-broken src showed a broken-image box.
    const wrapper = mount(BaseImage, {
      props: { src: '/uploads/images/gone.jpg', alt: 'G' },
      global
    })

    await wrapper.findComponent({ name: 'NuxtImg' }).trigger('error')

    expect(wrapper.find('.icon').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'NuxtImg' }).exists()).toBe(false)
  })

  it('tries fallbackSrc once before giving up on the placeholder', async () => {
    const wrapper = mount(BaseImage, {
      props: { src: '/uploads/images/gone.jpg', fallbackSrc: '/img/news/default-cover.png' },
      global
    })

    await wrapper.findComponent({ name: 'NuxtImg' }).trigger('error')
    expect(wrapper.findComponent({ name: 'NuxtImg' }).props('src')).toBe(
      '/img/news/default-cover.png'
    )

    await wrapper.findComponent({ name: 'NuxtImg' }).trigger('error')
    expect(wrapper.find('.icon').exists()).toBe(true)
  })

  it('uses fallbackSrc directly when src is empty', () => {
    const wrapper = mount(BaseImage, {
      props: { src: null, fallbackSrc: '/img/news/default-cover.png' },
      global
    })

    expect(wrapper.findComponent({ name: 'NuxtImg' }).props('src')).toBe(
      '/img/news/default-cover.png'
    )
  })

  it('recovers when src changes, so recycled list items do not stay broken', async () => {
    const wrapper = mount(BaseImage, { props: { src: '/uploads/images/gone.jpg' }, global })

    await wrapper.findComponent({ name: 'NuxtImg' }).trigger('error')
    expect(wrapper.find('.icon').exists()).toBe(true)

    await wrapper.setProps({ src: '/uploads/images/good.jpg' })

    expect(wrapper.findComponent({ name: 'NuxtImg' }).exists()).toBe(true)
    expect(wrapper.find('.icon').exists()).toBe(false)
  })

  it('passes layout classes through to every branch', () => {
    // Callers style this exactly as they styled the <img> it replaced, which
    // relies on attribute fallthrough. Vue disables that for multi-root
    // components, so the v-if/v-else-if/v-else chain must stay a single root.
    const cls = 'w-full h-full object-cover'

    const optimised = mount(BaseImage, { props: { src: '/img/a.jpg' }, attrs: { class: cls }, global })
    expect(optimised.findComponent({ name: 'NuxtImg' }).classes()).toEqual(expect.arrayContaining(cls.split(' ')))

    const raw = mount(BaseImage, { props: { src: 'https://x/y.jpg' }, attrs: { class: cls }, global })
    expect(raw.find('img').classes()).toEqual(expect.arrayContaining(cls.split(' ')))

    const placeholder = mount(BaseImage, { props: { src: null }, attrs: { class: cls }, global })
    expect(placeholder.find('div').classes()).toEqual(expect.arrayContaining(cls.split(' ')))
  })

  it('labels the placeholder for screen readers only when alt is meaningful', () => {
    const labelled = mount(BaseImage, { props: { src: undefined, alt: 'Portrait' }, global })
    expect(labelled.find('div').attributes('role')).toBe('img')
    expect(labelled.find('div').attributes('aria-label')).toBe('Portrait')

    const decorative = mount(BaseImage, { props: { src: undefined, alt: '' }, global })
    expect(decorative.find('div').attributes('role')).toBeUndefined()
    expect(decorative.find('div').attributes('aria-hidden')).toBe('true')
  })
})
