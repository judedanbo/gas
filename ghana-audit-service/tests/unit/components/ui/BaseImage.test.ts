import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import BaseImage from '~/components/ui/BaseImage.vue'

// Auto-imported in Nuxt; absent under plain Vitest.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onMounted', onMounted)

const global = {
  stubs: {
    // Like the real NuxtImg, exposes its <img> as `imgEl`.
    NuxtImg: {
      name: 'NuxtImg',
      props: ['src', 'alt'],
      setup(_props: unknown, { expose }: { expose: (exposed: object) => void }) {
        const imgEl = ref<HTMLImageElement | null>(null)
        expose({ imgEl })
        return { imgEl }
      },
      template: '<img ref="imgEl" :src="src" :alt="alt" />'
    },
    Icon: { name: 'Icon', props: ['name'], template: '<span class="icon" :data-icon="name" />' }
  }
}

/** What is on screen: 'ipx <src>', 'img <src>' or 'placeholder'. */
function shown(wrapper: VueWrapper): string {
  const optimised = wrapper.findComponent({ name: 'NuxtImg' })
  if (optimised.exists()) return `ipx ${optimised.props('src')}`
  const img = wrapper.find('img')
  if (img.exists()) return `img ${img.attributes('src')}`
  return wrapper.find('.icon').exists() ? 'placeholder' : 'nothing'
}

async function fail(wrapper: VueWrapper) {
  await wrapper.find('img').trigger('error')
}

/**
 * Make every <img> report a finished load: broken (0) or fine (> 0). Images
 * otherwise report "still loading" (see tests/setup.ts).
 */
function stubImageState(naturalWidth: number) {
  const proto = HTMLImageElement.prototype
  const saved = ['complete', 'naturalWidth'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(proto, key)] as const
  )
  Object.defineProperty(proto, 'complete', { configurable: true, get: () => true })
  Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => naturalWidth })
  restoreImageState = () => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(proto, key, descriptor)
      else Reflect.deleteProperty(proto, key)
    }
  }
}
let restoreImageState = () => {}
afterEach(() => {
  restoreImageState()
  restoreImageState = () => {}
})

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

  it('loads a file directly when IPX cannot read it', async () => {
    // Runtime uploads IPX can't see: thumbnails kept in Azure Blob, or any
    // upload when the uploads folder isn't mounted into .output/public. The
    // direct URL is served by server/routes/uploads/** from disk or Blob.
    const wrapper = mount(BaseImage, { props: { src: '/uploads/images/logo.png' }, global })
    expect(shown(wrapper)).toBe('ipx /uploads/images/logo.png')

    await fail(wrapper)

    expect(shown(wrapper)).toBe('img /uploads/images/logo.png')
  })

  it('swaps to the placeholder when the file is really gone', async () => {
    // The regression this guards: every other site in the app only checks that
    // the URL is non-empty, so a truthy-but-broken src showed a broken-image box.
    const wrapper = mount(BaseImage, {
      props: { src: '/uploads/images/gone.jpg', alt: 'G' },
      global
    })

    await fail(wrapper) // through IPX
    await fail(wrapper) // directly

    expect(shown(wrapper)).toBe('placeholder')
  })

  it('tries fallbackSrc, the same two ways, before giving up on the placeholder', async () => {
    const wrapper = mount(BaseImage, {
      props: { src: '/uploads/images/gone.jpg', fallbackSrc: '/img/news/default-cover.png' },
      global
    })

    const seen = [shown(wrapper)]
    for (let i = 0; i < 4; i++) {
      await fail(wrapper)
      seen.push(shown(wrapper))
    }

    expect(seen).toEqual([
      'ipx /uploads/images/gone.jpg',
      'img /uploads/images/gone.jpg',
      'ipx /img/news/default-cover.png',
      'img /img/news/default-cover.png',
      'placeholder'
    ])
  })

  it('goes straight to the placeholder when a remote src fails', async () => {
    const wrapper = mount(BaseImage, { props: { src: 'https://x/y.jpg' }, global })
    await fail(wrapper)
    expect(shown(wrapper)).toBe('placeholder')
  })

  it('moves on from an image that failed before hydration', async () => {
    // No @error listener exists yet when a server-rendered image fails early,
    // and NuxtImg's inline onerror marker is blocked by the CSP.
    stubImageState(0)
    const wrapper = mount(BaseImage, { props: { src: '/uploads/thumbnails/cover.jpg' }, global })
    await nextTick()

    expect(shown(wrapper)).toBe('img /uploads/thumbnails/cover.jpg')
  })

  it('keeps an image that loaded before hydration', async () => {
    stubImageState(800)
    const wrapper = mount(BaseImage, { props: { src: '/img/news/a.jpg' }, global })
    await nextTick()

    expect(shown(wrapper)).toBe('ipx /img/news/a.jpg')
  })

  it('does not mistake an SVG without intrinsic size for a broken image', async () => {
    stubImageState(0)
    const wrapper = mount(BaseImage, { props: { src: '/images/emblem.svg' }, global })
    await nextTick()

    expect(shown(wrapper)).toBe('ipx /images/emblem.svg')
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

    await fail(wrapper)
    await fail(wrapper)
    expect(shown(wrapper)).toBe('placeholder')

    await wrapper.setProps({ src: '/uploads/images/good.jpg' })

    expect(shown(wrapper)).toBe('ipx /uploads/images/good.jpg')
  })

  it('passes layout classes through to every branch', () => {
    // Callers style this exactly as they styled the <img> it replaced, which
    // relies on attribute fallthrough. Vue disables that for multi-root
    // components, so the v-if/v-else-if/v-else chain must stay a single root.
    const cls = 'w-full h-full object-cover'

    const optimised = mount(BaseImage, {
      props: { src: '/img/a.jpg' },
      attrs: { class: cls },
      global
    })
    expect(optimised.findComponent({ name: 'NuxtImg' }).classes()).toEqual(
      expect.arrayContaining(cls.split(' '))
    )

    const raw = mount(BaseImage, {
      props: { src: 'https://x/y.jpg' },
      attrs: { class: cls },
      global
    })
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
