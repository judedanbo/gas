<template>
  <!-- Loading skeleton -->
  <section
    v-if="pending"
    class="relative min-h-[60vh] animate-pulse bg-gradient-to-br from-primary to-primary-dark md:min-h-[70vh]"
    aria-hidden="true"
  >
    <div class="absolute bottom-0 left-0 right-0 p-8 md:p-12">
      <div class="container mx-auto">
        <div class="max-w-2xl space-y-4">
          <div class="h-6 w-20 rounded-full bg-white/20" />
          <div class="h-10 w-3/4 rounded bg-white/20" />
          <div class="h-6 w-1/2 rounded bg-white/20" />
          <div class="h-10 w-36 rounded-lg bg-white/20" />
        </div>
      </div>
    </div>
  </section>

  <!-- Fallback: static green hero (matches original HeroCarousel) -->
  <section
    v-else-if="error || slides.length === 0"
    class="bg-gradient-to-br from-primary to-primary-dark py-20 text-center text-white dark:text-gray-100"
  >
    <div class="container">
      <div class="mx-auto max-w-[800px]">
        <h1 class="mb-4 text-3xl text-white dark:text-white md:text-5xl">
          {{ $t('home.hero.title', 'Ghana Audit Service') }}
        </h1>
        <p class="mb-4 text-xl font-semibold text-accent dark:text-gray-200 md:text-2xl">
          {{
            $t(
              'home.hero.subtitle',
              'Protecting the Public Purse Through Accountability and Transparency'
            )
          }}
        </p>
        <p class="mb-8 text-lg leading-relaxed text-white/90 dark:text-gray-300">
          {{
            $t(
              'home.hero.description',
              'The Audit Service has a constitutional mandate to audit the accounts of all public offices and report to Parliament, ensuring accountability in the use of public resources.'
            )
          }}
        </p>
        <div class="flex flex-wrap justify-center gap-4">
          <NuxtLink to="/reports" class="btn-accent btn-lg">
            {{ $t('home.hero.viewReports', 'View Latest Reports') }}
          </NuxtLink>
          <NuxtLink
            to="/about"
            class="btn border-2 border-white text-white dark:text-white hover:bg-white hover:text-primary"
          >
            {{ $t('home.hero.learnMore', 'Learn More') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>

  <!-- Slideshow -->
  <section
    v-else
    ref="slideshowRef"
    role="region"
    :aria-roledescription="$t('slideshow.carouselLabel', 'carousel')"
    :aria-label="$t('slideshow.ariaLabel')"
    class="relative min-h-[60vh] overflow-hidden bg-gray-900 md:min-h-[70vh] lg:min-h-[75vh]"
    @keydown.left.prevent="prev"
    @keydown.right.prevent="next"
    @mouseenter="pauseAutoplay"
    @mouseleave="resumeAutoplay"
    @focusin="pauseAutoplay"
    @focusout="handleFocusOut"
  >
    <!-- Slides -->
    <div class="relative h-full min-h-[60vh] md:min-h-[70vh] lg:min-h-[75vh]">
      <HomeHeroSlide
        v-for="(slide, i) in slides"
        :key="slide.id"
        :slide="slide"
        :is-active="i === currentIndex"
        :is-first="i === 0"
        :index="i"
        :total-slides="slideCount"
      />
    </div>

    <!-- Navigation arrows -->
    <template v-if="slideCount > 1">
      <!-- Previous -->
      <button
        type="button"
        :aria-label="$t('slideshow.previous')"
        class="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white sm:left-4"
        @click="prev"
      >
        <Icon name="heroicons:chevron-left-20-solid" class="h-6 w-6" />
      </button>

      <!-- Next -->
      <button
        type="button"
        :aria-label="$t('slideshow.next')"
        class="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white sm:right-4"
        @click="next"
      >
        <Icon name="heroicons:chevron-right-20-solid" class="h-6 w-6" />
      </button>
    </template>

    <!-- Bottom controls: dots + play/pause -->
    <div
      v-if="slideCount > 1"
      class="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-4 sm:bottom-6"
    >
      <!-- Dot indicators -->
      <div class="flex items-center gap-2" role="tablist" :aria-label="$t('slideshow.ariaLabel')">
        <button
          v-for="(slide, i) in slides"
          :key="slide.id"
          type="button"
          role="tab"
          :aria-selected="i === currentIndex"
          :aria-label="$t('slideshow.goToSlide', { number: i + 1 })"
          class="h-2.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          :class="i === currentIndex ? 'w-8 bg-accent' : 'w-2.5 bg-white/50 hover:bg-white/80'"
          @click="goTo(i)"
        />
      </div>

      <!-- Play/pause button -->
      <button
        type="button"
        :aria-label="isPaused ? $t('slideshow.play') : $t('slideshow.pause')"
        class="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white"
        @click="toggleAutoplay"
      >
        <Icon :name="isPaused ? 'heroicons:play-solid' : 'heroicons:pause-solid'" class="h-4 w-4" />
      </button>
    </div>

    <!-- Screen reader live region -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {{ liveRegionText }}
    </div>
  </section>
</template>

<script setup lang="ts">
  const { t } = useI18n()

  const {
    slides,
    currentIndex,
    slideCount,
    pending,
    error,
    isPaused,
    next,
    prev,
    goTo,
    pauseAutoplay,
    resumeAutoplay,
    toggleAutoplay
  } = useHeroSlideshow()

  const slideshowRef = ref<HTMLElement | null>(null)

  // Touch swipe support
  const { direction } = useSwipe(slideshowRef, {
    onSwipeEnd() {
      if (direction.value === 'left') next()
      if (direction.value === 'right') prev()
    }
  })

  // Live region text for screen readers
  const liveRegionText = computed(() => {
    if (slides.value.length === 0) return ''
    const slide = slides.value[currentIndex.value]
    if (!slide) return ''
    return (
      t('slideshow.slideOf', {
        current: currentIndex.value + 1,
        total: slideCount.value
      }) +
      ': ' +
      slide.title
    )
  })

  function handleFocusOut(e: FocusEvent) {
    if (slideshowRef.value && !slideshowRef.value.contains(e.relatedTarget as Node)) {
      resumeAutoplay()
    }
  }
</script>
