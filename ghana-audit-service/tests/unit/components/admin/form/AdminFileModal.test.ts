import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('useAdminApi', () => ({
  post: vi.fn()
}))

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

describe('AdminFileModal', () => {
  describe('inline card display', () => {
    it('shows "Attach Report" when no file is attached', () => {
      const state = createModalState({})
      expect(state.cardFileUrl.value).toBeNull()
      expect(state.displayFilename.value).toBe('')
    })

    it('shows filename when file is attached', () => {
      const state = createModalState({
        fileUrl: '/pdf/reports/20260513-abc.pdf'
      })
      expect(state.displayFilename.value).toBe('20260513-abc.pdf')
    })
  })

  describe('modal open/close', () => {
    it('opens modal and copies props into local state', () => {
      const state = createModalState({
        fileUrl: '/pdf/reports/test.pdf',
        fileSize: 2048000,
        thumbnail: '/uploads/thumbnails/thumb.jpg'
      })

      state.openModal()

      expect(state.isOpen.value).toBe(true)
      expect(state.modalFileUrl.value).toBe('/pdf/reports/test.pdf')
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
        fileUrl: '/pdf/reports/test.pdf',
        fileSize: 1024
      })

      state.openModal()
      state.modalFileUrl.value = '/pdf/reports/different.pdf'
      state.handleCancel()

      expect(state.isOpen.value).toBe(false)
    })
  })

  describe('confirm', () => {
    it('returns current modal values on confirm', () => {
      const state = createModalState({})

      state.openModal()
      state.modalFileUrl.value = '/pdf/reports/new.pdf'
      state.modalFileSize.value = 5000000
      state.modalThumbnail.value = '/uploads/thumbnails/new.jpg'

      const result = state.handleConfirm()

      expect(result).toEqual({
        fileUrl: '/pdf/reports/new.pdf',
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
