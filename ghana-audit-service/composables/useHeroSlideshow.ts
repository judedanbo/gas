import type { HeroSlide } from '~/types'

const AUTOPLAY_INTERVAL = 7000

/**
 * State and controls for the home page carousel. By default the slides come
 * from /api/slideshow; pass `provided` to drive it with slides the caller
 * already has (the admin preview), in which case nothing is fetched.
 */
export function useHeroSlideshow(provided?: () => HeroSlide[] | undefined) {
  const fetched = provided
    ? null
    : useFetch<{ slides: HeroSlide[] }>('/api/slideshow', { key: 'hero-slideshow' })

  const pending = computed(() => fetched?.pending.value ?? false)
  const error = computed(() => fetched?.error.value ?? null)
  const slides = computed(() => (provided ? provided() : fetched?.data.value?.slides) ?? [])
  const slideCount = computed(() => slides.value.length)
  const currentIndex = ref(0)
  const isPaused = ref(false)

  function next() {
    if (slideCount.value <= 1) return
    currentIndex.value = (currentIndex.value + 1) % slideCount.value
  }

  function prev() {
    if (slideCount.value <= 1) return
    currentIndex.value = (currentIndex.value - 1 + slideCount.value) % slideCount.value
  }

  function goTo(index: number) {
    if (index >= 0 && index < slideCount.value) {
      currentIndex.value = index
    }
  }

  const { pause, resume } = useIntervalFn(
    () => {
      if (!isPaused.value) next()
    },
    AUTOPLAY_INTERVAL,
    { immediate: false }
  )

  function pauseAutoplay() {
    isPaused.value = true
    pause()
  }

  function resumeAutoplay() {
    isPaused.value = false
    resume()
  }

  function toggleAutoplay() {
    if (isPaused.value) {
      resumeAutoplay()
    } else {
      pauseAutoplay()
    }
  }

  onMounted(() => {
    if (slideCount.value > 1) {
      resume()
    }
  })

  // The slide list can change under a mounted carousel (admin preview)
  watch(slideCount, (count) => {
    if (currentIndex.value >= count) currentIndex.value = 0
    if (count <= 1) {
      pause()
    } else if (!isPaused.value) {
      resume()
    }
  })

  return {
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
  }
}
