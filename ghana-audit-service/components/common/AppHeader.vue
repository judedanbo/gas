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
            <!-- Accessibility Controls (desktop; also available inside the mobile menu) -->
            <CommonAccessibilityControls variant="on-brand" class="hidden lg:flex" />

            <!-- Language Switcher -->
            <CommonLanguageSwitcher variant="on-brand" />

            <!-- CitizensEye App -->
            <a
              href="https://www.appsheet.com/start/5b1b9364-12e7-4613-a082-26cebb71f29f"
              target="_blank"
              rel="noopener noreferrer"
              class="bg-accent text-gray-900 px-3 md:px-4 py-1 rounded-full font-semibold no-underline hover:bg-accent-dark transition-colors text-xs md:text-sm"
            >
              {{ $t('common.citizensEyeApp') }}
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
            :aria-label="`${$t('home.title')} - ${$t('common.home')}`"
          >
            <img
              src="/images/logo-no-bg.png"
              alt="Ghana Audit Service Logo"
              class="w-10 h-10 md:w-[50px] md:h-[50px] object-contain"
            />
            <div class="flex flex-col">
              <span
                class="font-heading text-xl md:text-xl font-bold text-primary dark:text-primary-200 leading-tight"
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
            :aria-label="$t('common.openSearch')"
            aria-haspopup="dialog"
            @click="openSearch"
          >
            <Icon name="heroicons:magnifying-glass" class="w-6 h-6" aria-hidden="true" />
          </button>

          <!-- Mobile Menu Toggle -->
          <button
            class="lg:hidden touch-target bg-transparent border-none p-2 cursor-pointer flex items-center justify-center"
            :aria-expanded="isMobileMenuOpen"
            :aria-label="isMobileMenuOpen ? $t('common.closeMenu') : $t('common.openMenu')"
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
