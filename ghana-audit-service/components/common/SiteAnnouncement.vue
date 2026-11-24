<template>
  <Teleport to="body">
    <Transition name="announcement">
      <div
        v-if="popup && visible"
        class="fixed inset-0 z-modal flex items-center justify-center p-4"
        @keydown.esc="dismiss"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/70"
          data-testid="announcement-backdrop"
          @mousedown.prevent
          @click="dismiss"
        />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-label="popup.title"
          :aria-describedby="hintId"
          class="relative flex max-h-full w-full max-w-[min(48rem,150vh)] flex-col overflow-hidden rounded-lg bg-white shadow-2xl focus:outline-none dark:bg-gray-800"
        >
          <button
            v-if="popup.isDismissible"
            type="button"
            class="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            :aria-label="$t('common.close')"
            @click="dismiss"
          >
            <Icon name="heroicons:x-mark" class="h-6 w-6" aria-hidden="true" />
          </button>

          <a
            v-if="popup.linkUrl"
            :href="popup.linkUrl"
            :target="popup.openInNewTab ? '_blank' : undefined"
            :rel="popup.openInNewTab ? 'noopener noreferrer' : undefined"
            class="block min-h-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent"
            @click="follow"
          >
            <img
              :src="popup.imageUrl"
              :alt="popup.altText"
              :width="POPUP_IMAGE_WIDTH"
              :height="POPUP_IMAGE_HEIGHT"
              :class="imageClasses"
            />
            <span v-if="popup.openInNewTab" class="sr-only">
              {{ $t('announcement.opensInNewTab') }}
            </span>
          </a>
          <img
            v-else
            :src="popup.imageUrl"
            :alt="popup.altText"
            :width="POPUP_IMAGE_WIDTH"
            :height="POPUP_IMAGE_HEIGHT"
            :class="imageClasses"
          />

          <div class="flex-shrink-0">
            <p
              class="px-4 py-2 text-center text-sm text-gray-700 dark:text-gray-200"
              role="timer"
              data-testid="announcement-countdown"
            >
              {{ $t('announcement.closesIn', { seconds: remaining }) }}
            </p>
            <div class="h-1 bg-gray-200 dark:bg-gray-700" aria-hidden="true">
              <div
                class="h-full bg-primary transition-[width] duration-1000 ease-linear motion-reduce:transition-none dark:bg-accent"
                :style="{ width: `${progress}%` }"
              />
            </div>
          </div>

          <!-- Static (not live-updating) so screen readers hear it once on open -->
          <p :id="hintId" class="sr-only">
            {{ $t('announcement.autoCloseHint', { seconds: popup.displaySeconds }) }}
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { POPUP_IMAGE_HEIGHT, POPUP_IMAGE_WIDTH } from '~/utils/popupImage'

  /**
   * The pop-up managed at /admin/popups: an image (optionally a link) shown
   * once per page load, closing itself when its countdown ends. Visitors can
   * close it earlier only if the admin made it dismissible.
   */
  const { popup, visible, remaining, dismiss, follow } = useSiteAnnouncement()

  const hintId = `${useId()}-hint`
  const dialogRef = ref<HTMLElement | null>(null)

  // Pop-up images are always 1600 × 800, so the width/height attributes let
  // the dialog open at its final size before the image arrives. The dialog is
  // at most 150vh wide, which keeps a 2:1 image within 75vh of height; the cap
  // and object-contain only matter for images uploaded before the size rule.
  const imageClasses = 'block h-auto w-full max-h-[75vh] object-contain'

  const progress = computed(() => {
    const total = popup.value?.displaySeconds || 1
    return Math.min(100, Math.max(0, (remaining.value / total) * 100))
  })

  // Keep keyboard focus inside the dialog while it is up, and hand it back after.
  useFocusTrap(dialogRef, { active: visible })

  // Prevent the page behind from scrolling
  watch(visible, (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  })

  onUnmounted(() => {
    if (typeof document !== 'undefined' && visible.value) document.body.style.overflow = ''
  })
</script>

<style scoped>
  .announcement-enter-active,
  .announcement-leave-active {
    transition: opacity 0.2s ease;
  }

  .announcement-enter-from,
  .announcement-leave-to {
    opacity: 0;
  }
</style>
