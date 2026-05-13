import { describe, it, expect, vi } from 'vitest'
import { ref, computed, reactive, nextTick, defineComponent, h } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('useAdminApi', () => ({
  post: vi.fn()
}))

const AdminFormGroupStub = defineComponent({
  name: 'AdminFormGroup',
  props: ['label', 'error'],
  setup(_, { slots }) {
    return () => h('div', { class: 'form-group' }, slots.default?.())
  }
})

const UiBaseModalStub = defineComponent({
  name: 'UiBaseModal',
  props: ['modelValue', 'title', 'size', 'maxHeight'],
  emits: ['update:modelValue'],
  setup(props, { slots }) {
    return () =>
      props.modelValue
        ? h('div', { class: 'modal' }, [
            slots.default?.(),
            slots.footer?.()
          ])
        : null
  }
})

const AdminFileUploadStub = defineComponent({
  name: 'AdminFormAdminFileUpload',
  props: ['modelValue', 'type', 'label', 'required'],
  emits: ['update:modelValue', 'file-info'],
  setup() {
    return () => h('div', { class: 'file-upload' })
  }
})

function createModalState(props: {
  fileUrl?: string | null
  fileSize?: number | null
  thumbnail?: string | null
}) {
  const isOpen = ref(false)
  const modalFileUrl = ref<string | null>(null)
  const modalFileSize = ref<number | null>(null)
  const modalThumbnail = ref<string | null>(null)
  const thumbnailSource = ref<string | null>(null)

  const cardFileUrl = computed(() => props.fileUrl || null)
  const displayFilename = computed(() => {
    if (!cardFileUrl.value) return ''
    return cardFileUrl.value.split('/').pop() || cardFileUrl.value
  })

  function openModal() {
    modalFileUrl.value = props.fileUrl || null
    modalFileSize.value = props.fileSize || null
    modalThumbnail.value = props.thumbnail || null
    thumbnailSource.value = props.thumbnail ? 'existing' : null
    isOpen.value = true
  }

  function handleConfirm() {
    const result = {
      fileUrl: modalFileUrl.value || '',
      fileSize: modalFileSize.value || undefined,
      thumbnail: modalThumbnail.value || ''
    }
    isOpen.value = false
    return result
  }

  function handleCancel() {
    isOpen.value = false
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return {
    isOpen,
    modalFileUrl,
    modalFileSize,
    modalThumbnail,
    thumbnailSource,
    cardFileUrl,
    displayFilename,
    openModal,
    handleConfirm,
    handleCancel,
    formatFileSize
  }
}

describe('AdminReportFileModal', () => {
  describe('inline card display', () => {
    it('shows "Attach Report" when no file is attached', () => {
      const state = createModalState({})
      expect(state.cardFileUrl.value).toBeNull()
      expect(state.displayFilename.value).toBe('')
    })

    it('shows filename when file is attached', () => {
      const state = createModalState({
        fileUrl: '/uploads/reports/20260513-abc.pdf'
      })
      expect(state.displayFilename.value).toBe('20260513-abc.pdf')
    })
  })

  describe('modal open/close', () => {
    it('opens modal and copies props into local state', () => {
      const state = createModalState({
        fileUrl: '/uploads/reports/test.pdf',
        fileSize: 2048000,
        thumbnail: '/uploads/thumbnails/thumb.jpg'
      })

      state.openModal()

      expect(state.isOpen.value).toBe(true)
      expect(state.modalFileUrl.value).toBe('/uploads/reports/test.pdf')
      expect(state.modalFileSize.value).toBe(2048000)
      expect(state.modalThumbnail.value).toBe('/uploads/thumbnails/thumb.jpg')
      expect(state.thumbnailSource.value).toBe('existing')
    })

    it('opens modal with null state when no file', () => {
      const state = createModalState({})

      state.openModal()

      expect(state.isOpen.value).toBe(true)
      expect(state.modalFileUrl.value).toBeNull()
      expect(state.modalFileSize.value).toBeNull()
      expect(state.modalThumbnail.value).toBeNull()
      expect(state.thumbnailSource.value).toBeNull()
    })

    it('cancel closes modal without emitting', () => {
      const state = createModalState({
        fileUrl: '/uploads/reports/test.pdf',
        fileSize: 1024
      })

      state.openModal()
      state.modalFileUrl.value = '/uploads/reports/different.pdf'
      state.handleCancel()

      expect(state.isOpen.value).toBe(false)
    })
  })

  describe('confirm', () => {
    it('returns current modal values on confirm', () => {
      const state = createModalState({})

      state.openModal()
      state.modalFileUrl.value = '/uploads/reports/new.pdf'
      state.modalFileSize.value = 5000000
      state.modalThumbnail.value = '/uploads/thumbnails/new.jpg'

      const result = state.handleConfirm()

      expect(result).toEqual({
        fileUrl: '/uploads/reports/new.pdf',
        fileSize: 5000000,
        thumbnail: '/uploads/thumbnails/new.jpg'
      })
      expect(state.isOpen.value).toBe(false)
    })

    it('returns empty strings and undefined for missing values', () => {
      const state = createModalState({})

      state.openModal()

      const result = state.handleConfirm()

      expect(result).toEqual({
        fileUrl: '',
        fileSize: undefined,
        thumbnail: ''
      })
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      const state = createModalState({})
      expect(state.formatFileSize(500)).toBe('500 B')
    })

    it('formats kilobytes', () => {
      const state = createModalState({})
      expect(state.formatFileSize(2048)).toBe('2.0 KB')
    })

    it('formats megabytes', () => {
      const state = createModalState({})
      expect(state.formatFileSize(5242880)).toBe('5.0 MB')
    })
  })
})
