<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Home Page Carousel</h1>
        <p class="mt-1 max-w-3xl text-gray-600 dark:text-gray-400">
          The carousel fills itself with the latest news, upcoming events and A-G reports. Here you
          can remove items, add others, keep an item for longer, and choose the photos shown from
          each gallery album. Changes reach the public home page within about 10 minutes.
        </p>
      </div>
      <div v-if="canEdit && carousel" class="flex flex-none flex-wrap gap-3">
        <button
          v-if="!carousel.isDefault"
          type="button"
          class="btn btn-ghost btn-sm whitespace-nowrap"
          :disabled="saving"
          @click="resetOpen = true"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm whitespace-nowrap"
          :disabled="saving"
          @click="addOpen = true"
        >
          Add item
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span class="sr-only">Loading</span>
    </div>

    <div
      v-else-if="error || !carousel"
      class="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
      role="alert"
    >
      {{ error || 'Failed to load the carousel' }}
    </div>

    <div v-else class="space-y-8">
      <p
        v-if="carousel.isDefault"
        class="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        The carousel is using its default settings. Nothing is changed until you make an edit.
      </p>

      <!-- Current slides -->
      <section
        aria-labelledby="carousel-slides-heading"
        class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2
            id="carousel-slides-heading"
            class="text-lg font-semibold text-gray-900 dark:text-white"
          >
            On the home page now
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ carousel.slides.length }} {{ carousel.slides.length === 1 ? 'slide' : 'slides' }}, in
            the order shown.
          </p>
        </div>

        <p
          v-if="carousel.slides.length === 0"
          class="px-6 py-8 text-sm text-gray-600 dark:text-gray-400"
        >
          Nothing is selected, so the home page shows its plain welcome banner. Add an item or raise
          the automatic numbers below.
        </p>

        <ol v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <li
            v-for="(slide, index) in carousel.slides"
            :key="slide.id"
            class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
          >
            <div class="flex min-w-0 flex-1 items-center gap-4">
              <span
                class="w-5 flex-none text-right text-sm tabular-nums text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              >
                {{ index + 1 }}
              </span>
              <img
                :src="slide.image"
                alt=""
                loading="lazy"
                class="h-14 w-24 flex-none rounded bg-gray-100 object-cover dark:bg-gray-700"
              />
              <div class="min-w-0">
                <p class="truncate font-medium text-gray-900 dark:text-white">{{ slide.title }}</p>
                <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  <span class="font-medium text-gray-700 dark:text-gray-300">
                    {{ CAROUSEL_TYPE_LABELS[slide.type] }}
                  </span>
                  · {{ slideStatus(slide) }}
                </p>
              </div>
            </div>

            <div v-if="canEdit" class="flex flex-none gap-2 pl-9 sm:pl-0">
              <button
                v-if="slide.type === 'gallery'"
                type="button"
                class="btn btn-outline btn-xs"
                :disabled="saving"
                :aria-label="`Choose photos from ${albumTitle(slide.refId)}`"
                @click="openAlbum(slide.refId)"
              >
                Choose photos
              </button>
              <button
                v-else
                type="button"
                class="btn btn-outline btn-xs"
                :disabled="saving"
                :aria-label="`${slide.source === 'pinned' ? 'Change how long to keep' : 'Keep'} ${slide.title}`"
                @click="openKeep(slide.type, slide.refId, slide.title)"
              >
                {{ slide.source === 'pinned' ? 'Change' : 'Keep' }}
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs text-red-700 dark:text-red-400"
                :disabled="saving"
                :aria-label="
                  slide.type === 'gallery'
                    ? `Remove album ${albumTitle(slide.refId)}`
                    : `Remove ${slide.title}`
                "
                @click="remove(slide.type, slide.refId)"
              >
                {{ slide.type === 'gallery' ? 'Remove album' : 'Remove' }}
              </button>
            </div>
          </li>
        </ol>
      </section>

      <!-- Kept but not showing -->
      <section
        v-if="dormantItems.length > 0"
        aria-labelledby="carousel-dormant-heading"
        class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2
            id="carousel-dormant-heading"
            class="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Selected but not showing
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            These were kept or added, but are not on the carousel at the moment.
          </p>
        </div>
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          <li
            v-for="item in dormantItems"
            :key="`${item.type}:${item.refId}`"
            class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-gray-900 dark:text-white">{{ item.title }}</p>
              <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                <span class="font-medium text-gray-700 dark:text-gray-300">
                  {{ CAROUSEL_TYPE_LABELS[item.type] }}
                </span>
                · {{ dormantReason(item) }}
              </p>
            </div>
            <div v-if="canEdit" class="flex flex-none gap-2">
              <button
                v-if="item.type === 'gallery' && item.available"
                type="button"
                class="btn btn-outline btn-xs"
                :disabled="saving"
                :aria-label="`Choose photos from ${item.title}`"
                @click="openAlbum(item.refId)"
              >
                Choose photos
              </button>
              <button
                v-else-if="item.available"
                type="button"
                class="btn btn-outline btn-xs"
                :disabled="saving"
                :aria-label="`Keep ${item.title} again`"
                @click="openKeep(item.type, item.refId, item.title)"
              >
                Keep again
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs text-red-700 dark:text-red-400"
                :disabled="saving"
                :aria-label="`Clear ${item.title} from this list`"
                @click="clear(item.type, item.refId)"
              >
                Clear
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Removed items -->
      <section
        v-if="hiddenItems.length > 0"
        aria-labelledby="carousel-hidden-heading"
        class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2
            id="carousel-hidden-heading"
            class="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Removed from the carousel
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            These are kept off the carousel. Restoring one lets it appear again while it is among
            the latest.
          </p>
        </div>
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          <li
            v-for="item in hiddenItems"
            :key="`${item.type}:${item.refId}`"
            class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-gray-900 dark:text-white">{{ item.title }}</p>
              <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                <span class="font-medium text-gray-700 dark:text-gray-300">
                  {{ CAROUSEL_TYPE_LABELS[item.type] }}
                </span>
                <template v-if="item.date"> · {{ formatCarouselDate(item.date) }}</template>
              </p>
            </div>
            <button
              v-if="canEdit"
              type="button"
              class="btn btn-outline btn-xs flex-none self-start sm:self-auto"
              :disabled="saving"
              :aria-label="`Restore ${item.title}`"
              @click="clear(item.type, item.refId, 'Restored')"
            >
              Restore
            </button>
          </li>
        </ul>
      </section>

      <!-- Automatic numbers -->
      <section
        aria-labelledby="carousel-auto-heading"
        class="rounded-lg bg-white shadow dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2
            id="carousel-auto-heading"
            class="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Automatic items
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            How many of the latest items are added automatically, on top of the ones you keep. Use 0
            to show only the items you choose.
          </p>
        </div>
        <form class="space-y-4 px-6 py-4" @submit.prevent="submitSettings">
          <div class="grid gap-4 sm:grid-cols-3">
            <div v-for="field in settingFields" :key="field.key">
              <label
                :for="`carousel-${field.key}`"
                class="mb-1 block text-sm font-medium text-gray-900 dark:text-white"
              >
                {{ field.label }}
              </label>
              <input
                :id="`carousel-${field.key}`"
                v-model.number="settingsForm[field.key]"
                type="number"
                min="0"
                max="10"
                required
                :disabled="!canEdit"
                class="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div v-if="canEdit" class="flex justify-end">
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              :disabled="saving || !settingsChanged"
            >
              Save numbers
            </button>
          </div>
        </form>
      </section>
    </div>

    <AdminCarouselAddDialog
      v-model="addOpen"
      :shown-keys="shownKeys"
      :saving="saving"
      :search-candidates="searchCandidates"
      @add="addCandidate"
    />

    <AdminCarouselKeepDialog
      v-model="keepOpen"
      :title="keepTarget?.title ?? ''"
      :pinned-until="keepTarget?.pinnedUntil ?? null"
      :is-kept="keepTarget?.isKept ?? false"
      :saving="saving"
      @save="submitKeep"
      @stop="stopKeeping"
    />

    <AdminCarouselGalleryDialog
      v-model="albumOpen"
      :album-id="albumTarget?.refId ?? null"
      :album-title="albumTarget?.title ?? ''"
      :image-count="albumTarget?.imageCount ?? null"
      :image-ids="albumTarget?.imageIds ?? []"
      :saving="saving"
      :fetch-album-images="fetchAlbumImages"
      @save="submitAlbum"
    />

    <AdminUiAdminConfirmDialog
      v-model="resetOpen"
      title="Reset the carousel?"
      message="This discards everything you kept, added or removed and returns the carousel to its default settings."
      confirm-text="Reset to defaults"
      variant="warning"
      :loading="saving"
      @confirm="confirmReset"
    />
  </div>
</template>

<script setup lang="ts">
  import type {
    AdminCarouselCandidate,
    AdminCarouselItem,
    AdminCarouselSlide,
    CarouselItemType,
    CarouselSettings
  } from '~/types/admin'

  definePageMeta({ layout: 'admin' })

  const {
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
  } = useAdminCarousel()
  const { hasPermission } = useAdminAuth()
  const toast = useToast()

  const canEdit = computed(() => hasPermission('update'))

  const key = (type: CarouselItemType, refId: number) => `${type}:${refId}`

  const itemsByKey = computed(
    () => new Map((carousel.value?.items ?? []).map((item) => [key(item.type, item.refId), item]))
  )
  const shownKeys = computed(
    () => new Set((carousel.value?.slides ?? []).map((slide) => key(slide.type, slide.refId)))
  )

  const hiddenItems = computed(() =>
    (carousel.value?.items ?? []).filter((item) => item.mode === 'hidden')
  )
  /** Kept/added items that currently contribute no slide. */
  const dormantItems = computed(() =>
    (carousel.value?.items ?? []).filter(
      (item) => item.mode === 'pinned' && !shownKeys.value.has(key(item.type, item.refId))
    )
  )

  function albumTitle(refId: number) {
    return itemsByKey.value.get(key('gallery', refId))?.title ?? 'album'
  }

  const AUTO_STATUS: Record<CarouselItemType, string> = {
    news: 'Automatic — among the latest news',
    event: 'Automatic — upcoming event',
    report: 'Automatic — among the latest reports',
    gallery: ''
  }

  function slideStatus(slide: AdminCarouselSlide) {
    if (slide.type === 'gallery') return `From “${albumTitle(slide.refId)}”`
    if (slide.source === 'auto') return AUTO_STATUS[slide.type]
    return slide.pinnedUntil
      ? `Kept until ${formatCarouselDate(slide.pinnedUntil)}`
      : 'Kept until you remove it'
  }

  function dormantReason(item: AdminCarouselItem) {
    if (!item.available) return 'Unpublished or deleted'
    if (item.expired) return `Keep-until date passed (${formatCarouselDate(item.pinnedUntil)})`
    if (item.type === 'gallery') return 'The album has no photos'
    return 'Not showing'
  }

  /** Runs a save and reports the outcome; returns whether it succeeded. */
  async function run(action: () => Promise<void>, success: string) {
    try {
      await action()
      toast.success(success)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      return false
    }
  }

  // --- Remove / restore -----------------------------------------------------

  function remove(type: CarouselItemType, refId: number) {
    return run(() => hideItem(type, refId), 'Removed from the carousel')
  }

  function clear(type: CarouselItemType, refId: number, message = 'Cleared') {
    return run(() => clearItem(type, refId), message)
  }

  // --- Add --------------------------------------------------------------------

  const addOpen = ref(false)

  async function addCandidate(candidate: AdminCarouselCandidate) {
    if (candidate.type === 'gallery') {
      addOpen.value = false
      openAlbum(candidate.refId, candidate.title)
      return
    }
    const added = await run(
      () => keepItem(candidate.type, candidate.refId, null),
      'Added to the carousel'
    )
    if (added) addOpen.value = false
  }

  // --- Keep -------------------------------------------------------------------

  const keepOpen = ref(false)
  const keepTarget = ref<{
    type: CarouselItemType
    refId: number
    title: string
    pinnedUntil: string | null
    isKept: boolean
  } | null>(null)

  function openKeep(type: CarouselItemType, refId: number, title: string) {
    const existing = itemsByKey.value.get(key(type, refId))
    const isKept = existing?.mode === 'pinned' && !existing.expired
    keepTarget.value = {
      type,
      refId,
      title,
      pinnedUntil: isKept ? existing.pinnedUntil : null,
      isKept
    }
    keepOpen.value = true
  }

  async function submitKeep(pinnedUntil: string | null) {
    const target = keepTarget.value
    if (!target) return
    const saved = await run(
      () => keepItem(target.type, target.refId, pinnedUntil),
      pinnedUntil ? `Kept until ${formatCarouselDate(pinnedUntil)}` : 'Kept until you remove it'
    )
    if (saved) keepOpen.value = false
  }

  async function stopKeeping() {
    const target = keepTarget.value
    if (!target) return
    const saved = await run(() => clearItem(target.type, target.refId), 'No longer kept')
    if (saved) keepOpen.value = false
  }

  // --- Gallery albums ---------------------------------------------------------

  const albumOpen = ref(false)
  const albumTarget = ref<{
    refId: number
    title: string
    imageCount: number | null
    imageIds: number[]
  } | null>(null)

  function openAlbum(refId: number, title?: string) {
    const existing = itemsByKey.value.get(key('gallery', refId))
    albumTarget.value = {
      refId,
      title: title ?? existing?.title ?? 'album',
      imageCount: existing?.imageCount ?? null,
      imageIds: existing?.imageIds ?? []
    }
    albumOpen.value = true
  }

  async function submitAlbum(selection: { imageCount: number; imageIds: number[] }) {
    const target = albumTarget.value
    if (!target) return
    const saved = await run(
      () => saveAlbum(target.refId, selection.imageCount, selection.imageIds),
      'Album photos saved'
    )
    if (saved) albumOpen.value = false
  }

  // --- Automatic numbers ------------------------------------------------------

  const settingFields: Array<{ key: keyof CarouselSettings; label: string }> = [
    { key: 'newsCount', label: 'Latest news articles' },
    { key: 'eventsCount', label: 'Upcoming events' },
    { key: 'reportsCount', label: 'Latest A-G reports' }
  ]

  const settingsForm = reactive<CarouselSettings>({ newsCount: 2, eventsCount: 2, reportsCount: 2 })

  watch(
    () => carousel.value?.settings,
    (settings) => {
      if (settings) Object.assign(settingsForm, settings)
    },
    { immediate: true }
  )

  const settingsChanged = computed(() => {
    const saved = carousel.value?.settings
    return !!saved && settingFields.some(({ key: k }) => settingsForm[k] !== saved[k])
  })

  function submitSettings() {
    return run(() => saveSettings({ ...settingsForm }), 'Automatic items updated')
  }

  // --- Reset ------------------------------------------------------------------

  const resetOpen = ref(false)

  async function confirmReset() {
    const done = await run(() => reset(), 'Carousel reset to its defaults')
    if (done) resetOpen.value = false
  }

  onMounted(load)
</script>
