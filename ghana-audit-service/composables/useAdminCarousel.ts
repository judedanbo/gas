import type {
  AdminCarousel,
  AdminCarouselAlbumImage,
  AdminCarouselCandidate,
  CarouselConfigInput,
  CarouselItemConfig,
  CarouselItemType,
  CarouselSettings
} from '~/types/admin'

type ApiError = { data?: { message?: string; statusMessage?: string }; message?: string }

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiError
  return e?.data?.message || e?.data?.statusMessage || fallback
}

/**
 * Data layer for /admin/carousel. The server stores the carousel as a single
 * configuration (settings + per-item overrides); every action here sends the
 * whole updated configuration and takes the server's answer — configuration
 * plus the slides it now produces — as the new state.
 */
export function useAdminCarousel() {
  const { get, put, del } = useAdminApi()

  const carousel = ref<AdminCarousel | null>(null)
  const loading = ref(true)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      carousel.value = await get<AdminCarousel>('carousel')
    } catch (err) {
      error.value = errorMessage(err, 'Failed to load the carousel')
    } finally {
      loading.value = false
    }
  }

  function currentConfig(): CarouselConfigInput {
    const current = carousel.value
    if (!current) throw new Error('Carousel not loaded')
    return {
      settings: { ...current.settings },
      items: current.items.map(({ type, refId, mode, pinnedUntil, imageCount, imageIds }) => ({
        type,
        refId,
        mode,
        pinnedUntil,
        imageCount,
        imageIds: [...imageIds]
      }))
    }
  }

  /** Applies `change` to the configuration and saves. Throws a readable Error. */
  async function save(change: (config: CarouselConfigInput) => void) {
    const config = currentConfig()
    change(config)
    saving.value = true
    try {
      carousel.value = await put<AdminCarousel>('carousel', config)
    } catch (err) {
      throw new Error(errorMessage(err, 'Failed to save the carousel'), { cause: err })
    } finally {
      saving.value = false
    }
  }

  function upsert(config: CarouselConfigInput, item: CarouselItemConfig) {
    const index = config.items.findIndex((i) => i.type === item.type && i.refId === item.refId)
    if (index >= 0) config.items[index] = item
    else config.items.push(item)
  }

  function without(config: CarouselConfigInput, type: CarouselItemType, refId: number) {
    config.items = config.items.filter((i) => !(i.type === type && i.refId === refId))
  }

  /** Keep a news article, event or report on the carousel (optionally until a date). */
  function keepItem(type: CarouselItemType, refId: number, pinnedUntil: string | null) {
    return save((config) =>
      upsert(config, { type, refId, mode: 'pinned', pinnedUntil, imageCount: null, imageIds: [] })
    )
  }

  /** Take an item off the carousel and keep it off, even while it is among the latest. */
  function hideItem(type: CarouselItemType, refId: number) {
    return save((config) => {
      // Albums are never automatic, so dropping the entry is enough.
      if (type === 'gallery') without(config, type, refId)
      else {
        upsert(config, {
          type,
          refId,
          mode: 'hidden',
          pinnedUntil: null,
          imageCount: null,
          imageIds: []
        })
      }
    })
  }

  /** Drop the override: the item is automatic again (shown only while among the latest). */
  function clearItem(type: CarouselItemType, refId: number) {
    return save((config) => without(config, type, refId))
  }

  function saveAlbum(refId: number, imageCount: number, imageIds: number[]) {
    return save((config) =>
      upsert(config, {
        type: 'gallery',
        refId,
        mode: 'pinned',
        pinnedUntil: null,
        imageCount,
        imageIds
      })
    )
  }

  function saveSettings(settings: CarouselSettings) {
    return save((config) => {
      config.settings = { ...settings }
    })
  }

  async function reset() {
    saving.value = true
    try {
      carousel.value = await del<AdminCarousel>('carousel')
    } catch (err) {
      throw new Error(errorMessage(err, 'Failed to reset the carousel'), { cause: err })
    } finally {
      saving.value = false
    }
  }

  async function searchCandidates(type: CarouselItemType, search: string) {
    const { data } = await get<{ data: AdminCarouselCandidate[] }>('carousel/candidates', {
      type,
      search
    })
    return data
  }

  async function fetchAlbumImages(albumId: number) {
    const { data } = await get<{ data: AdminCarouselAlbumImage[] }>(
      `carousel/albums/${albumId}/images`
    )
    return data
  }

  return {
    carousel,
    loading,
    saving,
    error,
    load,
    keepItem,
    hideItem,
    clearItem,
    saveAlbum,
    saveSettings,
    reset,
    searchCandidates,
    fetchAlbumImages
  }
}
