import type { HeroSlide } from '~/types'

const AUTOPLAY_INTERVAL = 7000

export function useHeroSlideshow() {
  const { data, pending, error } = useFetch<{ slides: HeroSlide[] }>('/api/slideshow', {
    key: 'hero-slideshow'
  })

  const slides = computed(() => data.value?.slides ?? [])
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

  watch(slideCount, (count) => {
    if (count <= 1) {
      pause()
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
