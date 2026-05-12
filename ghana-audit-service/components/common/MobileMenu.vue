<template>
  <div class="fixed inset-0 z-modal">
    <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
    <nav
      class="absolute top-0 right-0 bottom-0 w-full max-w-[320px] bg-white dark:bg-gray-800 flex flex-col overflow-y-auto"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div
        class="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700"
      >
        <span class="text-lg font-semibold dark:text-white">{{ $t('common.menu') }}</span>
        <button
          class="bg-transparent border-none text-xl cursor-pointer text-gray-600 dark:text-gray-300 p-2"
          :aria-label="$t('common.closeMenu')"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Language Switcher -->
      <div
        class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
      >
        <div class="flex items-center gap-2">
          <Icon
            name="heroicons:language"
            class="w-5 h-5 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <div class="flex gap-2">
            <button
              v-for="loc in availableLocales"
              :key="loc.code"
              class="px-3 py-1 text-sm rounded-md transition-colors"
              :class="
                locale === loc.code
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              "
              @click="switchLocale(loc.code)"
            >
              {{ loc.name }}
            </button>
          </div>
        </div>
      </div>

      <ul class="list-none m-0 p-0 flex-1">
        <li
          v-for="item in navigationItems"
          :key="item.label"
          class="border-b border-gray-200 dark:border-gray-700"
        >
          <!-- Item without children -->
          <NuxtLink
            v-if="!item.children"
            :to="item.href"
            class="flex justify-between items-center w-full px-6 py-4 text-base font-medium text-gray-900 dark:text-white no-underline hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="$emit('close')"
          >
            {{ item.label }}
          </NuxtLink>

          <!-- Item with children (accordion) -->
          <div v-else>
            <div class="flex items-center">
              <NuxtLink
                :to="item.href"
                class="flex-1 px-6 py-4 text-base font-medium text-gray-900 dark:text-white no-underline hover:bg-gray-50 dark:hover:bg-gray-700"
                @click="$emit('close')"
              >
                {{ item.label }}
              </NuxtLink>
              <button
                class="px-4 py-4 text-gray-600 dark:text-gray-300 bg-transparent border-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                :aria-expanded="openAccordion === item.label"
                :aria-label="`Toggle ${item.label} submenu`"
                @click="toggleAccordion(item.label)"
              >
                <span
                  class="text-[10px] transition-transform inline-block"
                  :class="{ 'rotate-180': openAccordion === item.label }"
                >
                  ▼
                </span>
              </button>
            </div>

            <Transition name="accordion">
              <ul
                v-if="openAccordion === item.label"
                class="list-none m-0 p-0 bg-gray-50 dark:bg-gray-900"
              >
                <li
                  v-for="child in item.children"
                  :key="child.label"
                  class="border-t border-gray-200 dark:border-gray-700"
                >
                  <NuxtLink
                    v-if="!child.isExternal"
                    :to="child.href"
                    class="flex items-center gap-3 px-6 py-3 pl-8 text-sm text-gray-600 dark:text-gray-300 no-underline hover:text-primary dark:hover:text-primary-light"
                    @click="$emit('close')"
                  >
                    <Icon
                      v-if="child.icon"
                      :name="child.icon"
                      class="w-5 h-5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {{ child.label }}
                  </NuxtLink>
                  <a
                    v-else
                    :href="child.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-3 px-6 py-3 pl-8 text-sm text-gray-600 dark:text-gray-300 no-underline hover:text-primary dark:hover:text-primary-light"
                    @click="$emit('close')"
                  >
                    <Icon
                      v-if="child.icon"
                      :name="child.icon"
                      class="w-5 h-5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {{ child.label }}
                    <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">↗</span>
                  </a>
                </li>
              </ul>
            </Transition>
          </div>
        </li>
      </ul>

      <!-- Contact Info -->
      <div class="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div class="flex flex-col gap-3 mb-4">
          <a href="tel:+233302664929" class="no-underline hover:text-primary">
            <UiIconText icon="heroicons:phone" size="sm" color="default"
              >+233 (302) 664929</UiIconText
            >
          </a>
          <a href="mailto:info@audit.gov.gh" class="no-underline hover:text-primary">
            <UiIconText icon="heroicons:envelope" size="sm" color="default"
              >info@audit.gov.gh</UiIconText
            >
          </a>
        </div>
        <a
          href="https://www.appsheet.com/start/5b1b9364-12e7-4613-a082-26cebb71f29f"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-accent w-full"
        >
          {{ $t('common.launchCitizensEye') }}
        </a>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
  interface NavChild {
    labelKey: string
    href: string
    icon?: string
    isExternal?: boolean
  }

  interface NavItem {
    labelKey: string
    href: string
    children?: NavChild[]
  }

  defineEmits<{
    close: []
  }>()

  const { t, locale, setLocale } = useI18n()

  const availableLocales = [
    { code: 'en', name: 'English' },
    { code: 'ak', name: 'Akan' }
  ] as const

  const switchLocale = async (code: 'en' | 'ak') => {
    await setLocale(code)
  }

  const openAccordion = ref<string | null>(null)

  const navigationItemsConfig: NavItem[] = [
    {
      labelKey: 'common.about',
      href: '/about',
      children: [
        {
          labelKey: 'nav.theService',
          href: '/about/the-service',
          icon: 'heroicons:building-library'
        },
        {
          labelKey: 'nav.pastAuditorsGeneral',
          href: '/about/past-auditors-general',
          icon: 'heroicons:user'
        },
        {
          labelKey: 'nav.managementTeam',
          href: '/about/management-team',
          icon: 'heroicons:user-group'
        },
        {
          labelKey: 'nav.departmentalProfile',
          href: '/about/departmental-profile',
          icon: 'heroicons:building-office'
        }
      ]
    },
    {
      labelKey: 'common.reports',
      href: '/reports',
      children: [
        { labelKey: 'common.viewAll', href: '/reports', icon: 'heroicons:chart-bar' },
        {
          labelKey: 'reports.categories.financial',
          href: '/reports?category=financial',
          icon: 'heroicons:currency-dollar'
        },
        {
          labelKey: 'reports.categories.performance',
          href: '/reports?category=performance',
          icon: 'heroicons:chart-bar'
        },
        {
          labelKey: 'reports.categories.compliance',
          href: '/reports?category=compliance',
          icon: 'heroicons:check-circle'
        },
        {
          labelKey: 'reports.categories.special',
          href: '/reports?category=special',
          icon: 'heroicons:magnifying-glass-circle'
        }
      ]
    },
    {
      labelKey: 'common.publications',
      href: '/publications',
      children: [
        {
          labelKey: 'nav.pressStatements',
          href: '/publications/press-statements',
          icon: 'heroicons:newspaper'
        },
        {
          labelKey: 'nav.bulletins',
          href: '/publications/bulletins',
          icon: 'heroicons:document-text'
        },
        {
          labelKey: 'nav.guidelines',
          href: '/publications/guidelines',
          icon: 'heroicons:clipboard-document-list'
        },
        {
          labelKey: 'nav.amisManuals',
          href: '/publications/amis-manuals',
          icon: 'heroicons:book-open'
        },
        {
          labelKey: 'nav.applicableLaws',
          href: '/publications/applicable-laws',
          icon: 'heroicons:scale'
        }
      ]
    },
    {
      labelKey: 'common.media',
      href: '/media',
      children: [
        { labelKey: 'nav.news', href: '/media/news', icon: 'heroicons:newspaper' },
        { labelKey: 'nav.events', href: '/media/events', icon: 'heroicons:calendar' },
        { labelKey: 'nav.gallery', href: '/media/gallery', icon: 'heroicons:camera' },
        { labelKey: 'nav.videos', href: '/media/videos', icon: 'heroicons:video-camera' }
      ]
    },
    {
      labelKey: 'common.advertisement',
      href: '/advertisement',
      children: [
        { labelKey: 'nav.vacancies', href: '/careers', icon: 'heroicons:briefcase' },
        { labelKey: 'nav.tenders', href: '/careers/tenders', icon: 'heroicons:pencil-square' }
      ]
    },
    {
      labelKey: 'common.contact',
      href: '/contact'
    }
  ]

  // Transform config to have translated labels
  const navigationItems = computed(() =>
    navigationItemsConfig.map((item) => ({
      label: t(item.labelKey),
      href: item.href,
      children: item.children?.map((child) => ({
        label: t(child.labelKey),
        href: child.href,
        icon: child.icon,
        isExternal: child.isExternal
      }))
    }))
  )

  const toggleAccordion = (label: string) => {
    openAccordion.value = openAccordion.value === label ? null : label
  }
</script>

<style scoped>
  /* Accordion Animation */
  .accordion-enter-active,
  .accordion-leave-active {
    @apply transition-all duration-normal overflow-hidden;
  }

  .accordion-enter-from,
  .accordion-leave-to {
    @apply opacity-0;
    max-height: 0;
  }

  .accordion-enter-to,
  .accordion-leave-from {
    @apply opacity-100;
    max-height: 500px;
  }
</style>
