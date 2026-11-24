import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref, computed, onUnmounted, useId } from 'vue'
import AdminFileUpload from '~/components/admin/form/AdminFileUpload.vue'

// Auto-imported in Nuxt; absent under plain Vitest.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('useId', useId)

const upload = vi.fn()
vi.stubGlobal('useAdminApi', () => ({ upload, uploadReport: vi.fn() }))
vi.stubGlobal('useAdminNotifications', () => ({ startTask: vi.fn(), trackUploadJob: vi.fn() }))

const global = {
  stubs: {
    AdminFormGroup: { template: '<div><slot /></div>' },
    UiBaseImage: { name: 'UiBaseImage', props: ['src', 'alt'], template: '<img :src="src" />' }
  }
}

const SERVER_URL = '/uploads/images/abc.png'

function pickFile(wrapper: ReturnType<typeof mount>) {
  const file = new File(['png-bytes'], 'photo.png', { type: 'image/png' })
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  return input.trigger('change')
}

/** Waits for the FileReader in readPreview to produce the local preview. */
async function previewRead(wrapper: ReturnType<typeof mount>) {
  await vi.waitFor(() => {
    if (!wrapper.find('img').exists()) throw new Error('preview not read yet')
  })
}

describe('AdminFileUpload', () => {
  beforeEach(() => {
    upload.mockReset()
    vi.spyOn(URL, 'createObjectURL')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('previews the picked image as a data: URL while uploading, then the server URL', async () => {
    let finish!: (value: unknown) => void
    upload.mockReturnValue(new Promise((resolve) => (finish = resolve)))

    const wrapper = mount(AdminFileUpload, {
      props: {
        modelValue: '',
        type: 'image' as const,
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value })
      },
      global
    })

    await pickFile(wrapper)
    await previewRead(wrapper)

    // In flight: local preview only, in a scheme the CSP's img-src allows.
    const inFlight = wrapper.find('img')
    expect(inFlight.exists()).toBe(true)
    expect(inFlight.attributes('src')).toMatch(/^data:image\/png;base64,/)

    finish({
      url: SERVER_URL,
      filename: 'abc.png',
      originalName: 'photo.png',
      size: 9,
      mimeType: 'image/png'
    })
    await flushPromises()

    // Done: the preview is the uploaded file itself.
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([SERVER_URL])
    const images = wrapper.findAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].attributes('src')).toBe(SERVER_URL)

    // blob: is not in img-src, so no object URL may back a preview.
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('drops the local preview when the upload fails', async () => {
    let fail!: (reason: unknown) => void
    upload.mockReturnValue(new Promise((_resolve, reject) => (fail = reject)))

    const wrapper = mount(AdminFileUpload, { props: { modelValue: '', type: 'image' }, global })

    await pickFile(wrapper)
    await previewRead(wrapper)
    expect(wrapper.find('img').exists()).toBe(true)

    fail(new Error('Upload failed'))
    await flushPromises()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('AdminFileUpload: pop-up images', () => {
  // happy-dom does not decode images: report the size each test sets instead.
  let decoded: { width: number; height: number } | null = null
  class FakeImage {
    naturalWidth = 0
    naturalHeight = 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      queueMicrotask(() => {
        if (!decoded) return this.onerror?.()
        this.naturalWidth = decoded.width
        this.naturalHeight = decoded.height
        this.onload?.()
      })
    }
  }
  const OriginalImage = globalThis.Image

  // Renders the field error, which the shared stub drops.
  const withErrors = {
    stubs: {
      ...global.stubs,
      AdminFormGroup: {
        props: ['error'],
        template: '<div><p v-if="error" role="alert">{{ error }}</p><slot /></div>'
      }
    }
  }

  beforeEach(() => {
    upload.mockReset()
    upload.mockResolvedValue({
      url: '/uploads/popups/abc.png',
      filename: 'abc.png',
      originalName: 'photo.png',
      size: 9,
      mimeType: 'image/png'
    })
    globalThis.Image = FakeImage as unknown as typeof Image
  })

  afterEach(() => {
    globalThis.Image = OriginalImage
    decoded = null
  })

  it('says which size it needs', () => {
    const wrapper = mount(AdminFileUpload, { props: { type: 'popup' }, global: withErrors })
    expect(wrapper.text()).toContain('JPG, PNG, WebP or GIF, exactly 1600 × 800 pixels')
  })

  it('turns away an image of any other size without uploading it', async () => {
    decoded = { width: 1200, height: 600 }
    const wrapper = mount(AdminFileUpload, { props: { type: 'popup' }, global: withErrors })

    await pickFile(wrapper)
    await vi.waitFor(() => {
      if (!wrapper.find('[role="alert"]').exists()) throw new Error('no error yet')
    })

    expect(wrapper.find('[role="alert"]').text()).toBe(
      'The image must be exactly 1600 × 800 pixels. This one is 1200 × 600.'
    )
    expect(upload).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('uploads a 1600 × 800 image as a pop-up image', async () => {
    decoded = { width: 1600, height: 800 }
    const wrapper = mount(AdminFileUpload, { props: { type: 'popup' }, global: withErrors })

    await pickFile(wrapper)
    await vi.waitFor(() => {
      if (!wrapper.emitted('update:modelValue')) throw new Error('not uploaded yet')
    })

    expect(upload).toHaveBeenCalledWith(expect.any(File), 'popup', expect.any(Object))
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['/uploads/popups/abc.png'])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('leaves an image it cannot decode to the server to measure', async () => {
    decoded = null
    const wrapper = mount(AdminFileUpload, { props: { type: 'popup' }, global: withErrors })

    await pickFile(wrapper)
    await vi.waitFor(() => {
      if (!upload.mock.calls.length) throw new Error('not uploaded yet')
    })

    expect(upload).toHaveBeenCalledWith(expect.any(File), 'popup', expect.any(Object))
  })

  it('does not measure general images', async () => {
    decoded = { width: 1200, height: 600 }
    const wrapper = mount(AdminFileUpload, { props: { type: 'image' }, global: withErrors })

    await pickFile(wrapper)
    await vi.waitFor(() => {
      if (!upload.mock.calls.length) throw new Error('not uploaded yet')
    })

    expect(upload).toHaveBeenCalledWith(expect.any(File), 'image', expect.any(Object))
  })
})
