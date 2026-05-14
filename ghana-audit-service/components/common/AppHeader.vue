<template>
  <header
    class="sticky top-0 z-sticky bg-white dark:bg-gray-800 shadow-sm transition-all duration-normal"
    :class="{ 'shadow-md': isScrolled }"
  >
    <!-- Top Bar -->
    <div class="bg-primary text-white py-2 text-sm">
      <div class="container">
        <div class="flex justify-between items-center">
          <!-- Contact Info -->
          <div class="hidden md:flex gap-6">
            <a href="tel:+233302664929" class="no-underline hover:opacity-80 transition-opacity">
              <UiIconText icon="heroicons:phone" color="white">+233 (302) 664929</UiIconText>
            </a>
            <a
              href="mailto:info@audit.gov.gh"
              class="no-underline hover:opacity-80 transition-opacity"
            >
              <UiIconText icon="heroicons:envelope" color="white">info@audit.gov.gh</UiIconText>
            </a>
          </div>

          <!-- Right: Accessibility + Language + CitizensEye -->
          <div class="flex items-center gap-2 md:gap-3">
            <!-- Accessibility Controls -->
            <div
              class="hidden lg:flex items-center gap-0.5"
              role="group"
              aria-label="Accessibility controls"
            >
              <button
                class="touch-target-area p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center justify-center"
                :aria-pressed="colorMode.value === 'dark'"
                title="Toggle dark mode"
                :aria-label="
                  colorMode.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
                "
                @click="toggleDarkMode"
              >
                <ClientOnly>
                  <Icon
                    :name="colorMode.value === 'dark' ? 'heroicons:sun' : 'heroicons:moon'"
                    class="w-4 h-4"
                    aria-hidden="true"
                  />
                  <template #fallback>
                    <span class="w-4 h-4 inline-block"></span>
                  </template>
                </ClientOnly>
              </button>
              <button
                class="touch-target-area p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center justify-center"
                :class="{ 'bg-white/20 text-white': highContrast }"
                :aria-pressed="highContrast"
                title="Toggle high contrast mode"
                :aria-label="
                  highContrast ? 'Disable high contrast mode' : 'Enable high contrast mode'
                "
                @click="toggleHighContrast"
              >
                <span class="text-sm" aria-hidden="true">◐</span>
              </button>
              <button
                class="touch-target-area p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                :disabled="!canDecreaseText"
                title="Decrease text size"
                :aria-label="`Decrease text size, currently ${textScalePercent}%`"
                @click="decreaseTextSize"
              >
                <span class="text-xs font-bold" aria-hidden="true">A-</span>
              </button>
              <span
                class="text-xs text-white/70 min-w-[3.5ch] text-center tabular-nums px-1"
                aria-live="polite"
                aria-atomic="true"
                :aria-label="`Text size: ${textScalePercent}%`"
                role="status"
              >
                {{ textScalePercent }}%
              </span>
              <button
                class="touch-target-area p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                :disabled="!canIncreaseText"
                title="Increase text size"
                :aria-label="`Increase text size, currently ${textScalePercent}%`"
                @click="increaseTextSize"
              >
                <span class="text-xs font-bold" aria-hidden="true">A+</span>
              </button>
            </div>

            <!-- Language Switcher -->
            <!-- <div class="hidden lg:flex items-center">
              <select
                v-model="currentLocale"
                class="bg-white/10 border border-white/30 rounded px-2 py-0.5 text-xs text-white cursor-pointer hover:bg-white/20 focus:outline-none focus:border-white"
                aria-label="Select language"
                @change="switchLocale"
              >
                <option
                  v-for="loc in availableLocales"
                  :key="loc.code"
                  :value="loc.code"
                  class="text-gray-900"
                >
                  {{ loc.name }}
                </option>
              </select>
            </div> -->

            <!-- CitizensEye App -->
            <a
              href="https://www.appsheet.com/start/5b1b9364-12e7-4613-a082-26cebb71f29f"
              target="_blank"
              rel="noopener noreferrer"
              class="bg-accent text-gray-900 px-3 md:px-4 py-1 rounded-full font-semibold no-underline hover:bg-accent-dark transition-colors text-xs md:text-sm"
            >
              CitizensEye App
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Header -->
    <div class="py-4">
      <div class="container">
        <div class="flex items-center justify-between gap-6">
          <!-- Logo -->
          <NuxtLink
            to="/"
            class="flex items-center gap-3 no-underline text-gray-900 dark:text-white hover:no-underline"
            aria-label="Audit Service - Home"
          >
            <img
              src="/images/logo-no-bg.png"
              alt="Ghana Audit Service Logo"
              class="w-10 h-10 md:w-[50px] md:h-[50px] object-contain"
            />
            <div class="flex flex-col">
              <span
                class="font-heading text-xl md:text-xl font-bold text-primary dark:text-primary-light leading-tight"
                >Audit Service</span
              >
              <span
                class="hidden md:block text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide"
                >Good Governance & Accountability</span
              >
            </div>
          </NuxtLink>

          <!-- Desktop Navigation -->
          <CommonAppNavigation class="flex-1 hidden lg:flex justify-center" />

          <!-- Search Button -->
          <button
            class="touch-target bg-transparent border-none p-2 cursor-pointer text-gray-600 dark:text-gray-300 hover:text-primary transition-colors flex items-center justify-center"
            aria-label="Open search (Ctrl+K)"
            @click="openSearch"
          >
            <Icon name="heroicons:magnifying-glass" class="w-6 h-6" aria-hidden="true" />
          </button>

          <!-- Mobile Menu Toggle -->
          <button
            class="lg:hidden touch-target bg-transparent border-none p-2 cursor-pointer flex items-center justify-center"
            :aria-expanded="isMobileMenuOpen"
            :aria-label="isMobileMenuOpen ? 'Close menu' : 'Open menu'"
            @click="toggleMobileMenu"
          >
            <span
              class="flex flex-col gap-[5px] w-6"
              :class="{ 'hamburger-active': isMobileMenuOpen }"
            >
              <span
                class="block h-0.5 bg-primary dark:bg-primary-light transition-all hamburger-line-1"
              ></span>
              <span
                class="block h-0.5 bg-primary dark:bg-primary-light transition-all hamburger-line-2"
              ></span>
              <span
                class="block h-0.5 bg-primary dark:bg-primary-light transition-all hamburger-line-3"
              ></span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Menu -->
    <Transition name="slide-down">
      <CommonMobileMenu v-if="isMobileMenuOpen" @close="closeMobileMenu" />
    </Transition>
  </header>
  <SearchCommandPalette />
</template>

<script setup lang="ts">
  const isScrolled = ref(false)
  const isSearchPaletteOpen = useState('searchPalette', () => false)
  const isMobileMenuOpen = ref(false)

  // Color mode (dark mode)
  const colorMode = useColorMode()

  function toggleDarkMode() {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  }

  // Accessibility
  const {
    highContrast,
    textScalePercent,
    canIncreaseText,
    canDecreaseText,
    toggleHighContrast,
    increaseTextSize,
    decreaseTextSize
  } = useAccessibility()

  // i18n
  // const { locale, locales, setLocale } = useI18n()

  // const currentLocale = ref(locale.value)
  // const availableLocales = computed(() =>
  //   (locales.value as Array<{ code: string; name: string }>).map((l) => ({
  //     code: l.code,
  //     name: l.name
  //   }))
  // )

  // function switchLocale() {
  //   setLocale(currentLocale.value)
  // }

  // Handle scroll effect
  const handleScroll = () => {
    isScrolled.value = window.scrollY > 50
  }

  // Open command palette
  const openSearch = () => {
    isSearchPaletteOpen.value = true
    isMobileMenuOpen.value = false
  }

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    isMobileMenuOpen.value = !isMobileMenuOpen.value
    if (isMobileMenuOpen.value) {
      isSearchPaletteOpen.value = false
    }
  }

  // Close mobile menu
  const closeMobileMenu = () => {
    isMobileMenuOpen.value = false
  }

  // Close menu on route change
  const route = useRoute()
  watch(
    () => route.path,
    () => {
      isMobileMenuOpen.value = false
      isSearchPaletteOpen.value = false
    }
  )

  onMounted(() => {
    window.addEventListener('scroll', handleScroll)
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })
</script>

<style scoped>
  /* Hamburger animation - needs scoped styles for transform */
  .hamburger-active .hamburger-line-1 {
    transform: rotate(45deg) translate(5px, 5px);
  }

  .hamburger-active .hamburger-line-2 {
    opacity: 0;
  }

  .hamburger-active .hamburger-line-3 {
    transform: rotate(-45deg) translate(5px, -5px);
  }

  /* Transitions */
  .slide-down-enter-active,
  .slide-down-leave-active {
    @apply transition-all duration-normal;
  }

  .slide-down-enter-from,
  .slide-down-leave-to {
    @apply opacity-0 -translate-y-2.5;
  }
</style>
