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
