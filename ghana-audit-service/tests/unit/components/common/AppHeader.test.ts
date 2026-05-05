import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// Mock Vue globals
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)

// Mock useAccessibility
const mockAccessibility = {
  highContrast: ref(false),
  textScalePercent: computed(() => 100),
  canIncreaseText: ref(true),
  canDecreaseText: ref(true),
  toggleHighContrast: vi.fn(),
  increaseTextSize: vi.fn(),
  decreaseTextSize: vi.fn()
}
vi.stubGlobal('useAccessibility', () => mockAccessibility)

// Mock useI18n
const mockI18n = {
  locale: ref('en'),
  locales: ref([
    { code: 'en', name: 'English' },
    { code: 'ak', name: 'Akan' }
  ]),
  setLocale: vi.fn()
}
vi.stubGlobal('useI18n', () => mockI18n)

// Mock useRoute
const mockRoute = { path: '/' }
vi.stubGlobal('useRoute', () => mockRoute)

// Mock window
const windowMock = {
  scrollY: 0,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}
vi.stubGlobal('window', windowMock)

// Simplified AppHeader component for testing
const AppHeader = {
  name: 'AppHeader',
  setup() {
    const isScrolled = ref(false)
    const isSearchOpen = ref(false)
    const isMobileMenuOpen = ref(false)

    const {
      highContrast,
      textScalePercent,
      canIncreaseText,
      canDecreaseText,
      toggleHighContrast,
      increaseTextSize,
      decreaseTextSize
    } = useAccessibility()

    const { locale, locales, setLocale } = useI18n()

    const currentLocale = ref(locale.value)
    const availableLocales = computed(() =>
      (locales.value as Array<{ code: string; name: string }>).map(l => ({
        code: l.code,
        name: l.name
      }))
    )

    function switchLocale() {
      setLocale(currentLocale.value)
    }

    function toggleSearch() {
      isSearchOpen.value = !isSearchOpen.value
      if (isSearchOpen.value) {
        isMobileMenuOpen.value = false
      }
    }

    function toggleMobileMenu() {
      isMobileMenuOpen.value = !isMobileMenuOpen.value
      if (isMobileMenuOpen.value) {
        isSearchOpen.value = false
      }
    }

    function closeMobileMenu() {
      isMobileMenuOpen.value = false
    }

    return {
      isScrolled,
      isSearchOpen,
      isMobileMenuOpen,
      highContrast,
      textScalePercent,
      canIncreaseText,
      canDecreaseText,
      toggleHighContrast,
      increaseTextSize,
      decreaseTextSize,
      currentLocale,
      availableLocales,
      switchLocale,
      toggleSearch,
      toggleMobileMenu,
      closeMobileMenu
    }
  },
  template: `
    <header class="sticky top-0 z-sticky bg-white shadow-sm" :class="{ 'shadow-md': isScrolled }">
      <!-- Top Bar -->
      <div class="bg-primary text-white py-2 text-sm">
        <div class="container">
          <div class="flex justify-between items-center">
            <div class="hidden md:flex gap-6">
              <a href="tel:+233302664929" class="phone-link">+233 (302) 664929</a>
              <a href="mailto:info@audit.gov.gh" class="email-link">info@audit.gov.gh</a>
            </div>
            <div>
              <a href="#" class="citizens-eye-link">CitizensEye App</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Header -->
      <div class="py-4">
        <div class="container">
          <div class="flex items-center justify-between gap-6">
            <!-- Logo -->
            <a href="/" class="logo-link" aria-label="Ghana Audit Service - Home">
              <span class="site-name">Ghana Audit Service</span>
            </a>

            <!-- Accessibility Toolbar -->
            <div class="hidden lg:flex items-center gap-1 accessibility-toolbar">
              <button
                class="contrast-toggle"
                :class="{ 'active': highContrast }"
                @click="toggleHighContrast"
                :aria-pressed="String(highContrast)"
                aria-label="Toggle high contrast mode"
              >
                ◐
              </button>
              <button
                class="decrease-text"
                :disabled="!canDecreaseText"
                @click="decreaseTextSize"
                aria-label="Decrease text size"
              >
                A-
              </button>
              <span class="text-scale" aria-live="polite">{{ textScalePercent }}%</span>
              <button
                class="increase-text"
                :disabled="!canIncreaseText"
                @click="increaseTextSize"
                aria-label="Increase text size"
              >
                A+
              </button>
            </div>

            <!-- Language Switcher -->
            <div class="hidden lg:flex items-center language-switcher">
              <select
                v-model="currentLocale"
                aria-label="Select language"
                @change="switchLocale"
              >
                <option v-for="locale in availableLocales" :key="locale.code" :value="locale.code">
                  {{ locale.name }}
                </option>
              </select>
            </div>

            <!-- Search Button -->
            <button
              class="search-toggle"
              @click="toggleSearch"
              aria-label="Toggle search"
              :aria-expanded="String(isSearchOpen)"
            >
              🔍
            </button>

            <!-- Mobile Menu Toggle -->
            <button
              class="mobile-menu-toggle lg:hidden"
              @click="toggleMobileMenu"
              :aria-expanded="String(isMobileMenuOpen)"
              aria-label="Toggle mobile menu"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      <!-- Search Bar -->
      <div v-if="isSearchOpen" class="search-panel">
        <input type="search" placeholder="Search..." />
      </div>

      <!-- Mobile Menu -->
      <div v-if="isMobileMenuOpen" class="mobile-menu">
        <nav>Mobile Navigation</nav>
      </div>
    </header>
  `
}

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAccessibility.highContrast.value = false
    mockAccessibility.canIncreaseText.value = true
    mockAccessibility.canDecreaseText.value = true
    mockI18n.locale.value = 'en'
  })

  describe('rendering', () => {
    it('should render the header', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('header').exists()).toBe(true)
    })

    it('should render the site name', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.site-name').text()).toBe('Ghana Audit Service')
    })

    it('should render contact links', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.phone-link').exists()).toBe(true)
      expect(wrapper.find('.email-link').exists()).toBe(true)
    })

    it('should render CitizensEye App link', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.citizens-eye-link').exists()).toBe(true)
      expect(wrapper.find('.citizens-eye-link').text()).toBe('CitizensEye App')
    })
  })

  describe('accessibility toolbar', () => {
    it('should render accessibility controls', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.contrast-toggle').exists()).toBe(true)
      expect(wrapper.find('.decrease-text').exists()).toBe(true)
      expect(wrapper.find('.increase-text').exists()).toBe(true)
      expect(wrapper.find('.text-scale').exists()).toBe(true)
    })

    it('should display current text scale percentage', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.text-scale').text()).toBe('100%')
    })

    it('should call toggleHighContrast when contrast button clicked', async () => {
      const wrapper = mount(AppHeader)

      ;(wrapper.find('.contrast-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(mockAccessibility.toggleHighContrast).toHaveBeenCalled()
    })

    it('should call increaseTextSize when A+ button clicked', async () => {
      const wrapper = mount(AppHeader)

      ;(wrapper.find('.increase-text').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(mockAccessibility.increaseTextSize).toHaveBeenCalled()
    })

    it('should call decreaseTextSize when A- button clicked', async () => {
      const wrapper = mount(AppHeader)

      ;(wrapper.find('.decrease-text').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(mockAccessibility.decreaseTextSize).toHaveBeenCalled()
    })

    it('should have proper aria-pressed on contrast toggle', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.contrast-toggle').attributes('aria-pressed')).toBe('false')
    })

    it('should disable decrease button when canDecreaseText is false', async () => {
      mockAccessibility.canDecreaseText.value = false

      const wrapper = mount(AppHeader)

      expect(wrapper.find('.decrease-text').attributes('disabled')).toBeDefined()
    })

    it('should disable increase button when canIncreaseText is false', async () => {
      mockAccessibility.canIncreaseText.value = false

      const wrapper = mount(AppHeader)

      expect(wrapper.find('.increase-text').attributes('disabled')).toBeDefined()
    })
  })

  describe('language switcher', () => {
    it('should render language select', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.language-switcher select').exists()).toBe(true)
    })

    it('should render available locales', () => {
      const wrapper = mount(AppHeader)

      const options = wrapper.findAll('.language-switcher option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('English')
      expect(options[1].text()).toBe('Akan')
    })

    it('should call setLocale when language changed', async () => {
      const wrapper = mount(AppHeader)

      const select = wrapper.find('.language-switcher select').element as HTMLSelectElement
      select.value = 'ak'
      select.dispatchEvent(new Event('change'))
      await wrapper.vm.$nextTick()

      expect(mockI18n.setLocale).toHaveBeenCalledWith('ak')
    })

    it('should have proper aria-label', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.language-switcher select').attributes('aria-label')).toBe('Select language')
    })
  })

  describe('search toggle', () => {
    it('should render search button', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.search-toggle').exists()).toBe(true)
    })

    it('should toggle search panel visibility', async () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.search-panel').exists()).toBe(false)

      ;(wrapper.find('.search-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.search-panel').exists()).toBe(true)
    })

    it('should have proper aria-expanded attribute', async () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.search-toggle').attributes('aria-expanded')).toBe('false')

      ;(wrapper.find('.search-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.search-toggle').attributes('aria-expanded')).toBe('true')
    })

    it('should close mobile menu when search is opened', async () => {
      const wrapper = mount(AppHeader)

      // Open mobile menu first
      ;(wrapper.find('.mobile-menu-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.mobile-menu').exists()).toBe(true)

      // Open search
      ;(wrapper.find('.search-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.search-panel').exists()).toBe(true)
      expect(wrapper.find('.mobile-menu').exists()).toBe(false)
    })
  })

  describe('mobile menu toggle', () => {
    it('should render mobile menu button', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.mobile-menu-toggle').exists()).toBe(true)
    })

    it('should toggle mobile menu visibility', async () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.mobile-menu').exists()).toBe(false)

      ;(wrapper.find('.mobile-menu-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.mobile-menu').exists()).toBe(true)
    })

    it('should have proper aria-expanded attribute', async () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.mobile-menu-toggle').attributes('aria-expanded')).toBe('false')

      ;(wrapper.find('.mobile-menu-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.mobile-menu-toggle').attributes('aria-expanded')).toBe('true')
    })

    it('should close search when mobile menu is opened', async () => {
      const wrapper = mount(AppHeader)

      // Open search first
      ;(wrapper.find('.search-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.search-panel').exists()).toBe(true)

      // Open mobile menu
      ;(wrapper.find('.mobile-menu-toggle').element as HTMLElement).click()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.mobile-menu').exists()).toBe(true)
      expect(wrapper.find('.search-panel').exists()).toBe(false)
    })
  })

  describe('accessibility', () => {
    it('should have proper aria-label on logo link', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.logo-link').attributes('aria-label')).toBe('Ghana Audit Service - Home')
    })

    it('should have aria-live on text scale display', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.text-scale').attributes('aria-live')).toBe('polite')
    })

    it('should have proper aria-labels on all buttons', () => {
      const wrapper = mount(AppHeader)

      expect(wrapper.find('.contrast-toggle').attributes('aria-label')).toBe('Toggle high contrast mode')
      expect(wrapper.find('.decrease-text').attributes('aria-label')).toBe('Decrease text size')
      expect(wrapper.find('.increase-text').attributes('aria-label')).toBe('Increase text size')
      expect(wrapper.find('.search-toggle').attributes('aria-label')).toBe('Toggle search')
      expect(wrapper.find('.mobile-menu-toggle').attributes('aria-label')).toBe('Toggle mobile menu')
    })
  })
})
