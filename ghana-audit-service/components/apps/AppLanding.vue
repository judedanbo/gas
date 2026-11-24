<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">{{ app.name }}</h1>
        <p v-if="app.tagline" class="page-subtitle">{{ app.tagline }}</p>
      </div>
    </div>

    <CommonBreadcrumb
      :crumbs="[
        { label: $t('apps.title'), path: localePath('/apps') },
        { label: app.name, path: localePath(app.path) }
      ]"
    />

    <!-- Introduction -->
    <section class="section bg-white dark:bg-gray-800" aria-labelledby="app-intro-heading">
      <div class="container">
        <div class="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
          <div>
            <h2
              id="app-intro-heading"
              class="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-6"
            >
              {{ app.headline || app.name }}
            </h2>
            <!-- Rich text from the admin editor, sanitized in the script below. -->
            <!-- eslint-disable vue/no-v-html -->
            <div
              v-if="body"
              class="app-body text-lg text-gray-600 dark:text-gray-400 mb-8"
              v-html="body"
            />
            <!-- eslint-enable vue/no-v-html -->
            <p v-else class="text-lg text-gray-600 dark:text-gray-400 mb-8">{{ app.summary }}</p>
            <div class="flex flex-wrap gap-4">
              <a
                :href="app.url"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-primary inline-flex items-center gap-2"
              >
                {{ launchLabel }}
                <span aria-hidden="true">↗</span>
                <span class="sr-only">{{ $t('apps.opensInNewTab') }}</span>
              </a>
              <a v-if="hasSection('features')" href="#app-features" class="btn-outline">
                {{ $t('apps.learnMore') }}
              </a>
            </div>
          </div>
          <div class="mt-10 lg:mt-0">
            <img
              v-if="app.imageUrl"
              :src="app.imageUrl"
              :alt="app.imageAlt"
              class="w-full rounded-2xl shadow-lg"
              loading="lazy"
            />
            <div
              v-else
              class="bg-gradient-to-br from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20 rounded-2xl p-8 text-center"
            >
              <span
                class="w-28 h-28 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white shadow-sm p-3"
              >
                <!-- Decorative: the app's name follows. -->
                <img
                  :src="app.logoUrl"
                  alt=""
                  width="112"
                  height="112"
                  class="max-w-full max-h-full object-contain"
                />
              </span>
              <p class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {{ app.name }}
              </p>
              <p v-if="app.tagline" class="text-gray-600 dark:text-gray-400">{{ app.tagline }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <template v-for="(key, index) in visibleSections" :key="key">
      <section
        :id="`app-${key}`"
        class="section"
        :class="index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'"
      >
        <div class="container">
          <UiSectionHeader
            :badge="$t(`apps.sections.${key}.badge`)"
            :title="content[key].title || $t(`apps.sections.${key}.title`, { name: app.name })"
            :description="content[key].intro || undefined"
          />

          <!-- Features -->
          <ul
            v-if="key === 'features'"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0"
          >
            <li
              v-for="feature in content.features.items"
              :key="feature.title"
              class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
            >
              <Icon
                :name="feature.icon"
                class="w-10 h-10 text-primary dark:text-primary-200 mb-4"
                aria-hidden="true"
              />
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {{ feature.title }}
              </h3>
              <p v-if="feature.description" class="text-gray-600 dark:text-gray-400">
                {{ feature.description }}
              </p>
            </li>
          </ul>

          <!-- How it works -->
          <ol
            v-else-if="key === 'steps'"
            class="grid grid-cols-1 gap-8 list-none p-0 m-0"
            :class="stepColumns"
          >
            <li
              v-for="(step, stepIndex) in content.steps.items"
              :key="step.title"
              class="text-center"
            >
              <div
                class="w-16 h-16 mx-auto mb-4 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold"
                aria-hidden="true"
              >
                {{ stepIndex + 1 }}
              </div>
              <Icon
                v-if="step.icon"
                :name="step.icon"
                class="w-10 h-10 text-primary dark:text-primary-200 mb-4 mx-auto"
                aria-hidden="true"
              />
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                <span class="sr-only">{{ stepIndex + 1 }}. </span>{{ step.title }}
              </h3>
              <p v-if="step.description" class="text-gray-600 dark:text-gray-400">
                {{ step.description }}
              </p>
            </li>
          </ol>

          <!-- Benefits per audience -->
          <div
            v-else-if="key === 'audiences'"
            class="grid grid-cols-1 gap-8"
            :class="{ 'lg:grid-cols-2': content.audiences.items.length > 1 }"
          >
            <div
              v-for="audience in content.audiences.items"
              :key="audience.title"
              class="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700"
            >
              <div class="flex items-center gap-3 mb-6">
                <Icon
                  :name="audience.icon"
                  class="w-8 h-8 text-primary dark:text-primary-200"
                  aria-hidden="true"
                />
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                  {{ audience.title }}
                </h3>
              </div>
              <ul class="space-y-4 list-none p-0 m-0">
                <li v-for="point in audience.points" :key="point" class="flex items-start gap-3">
                  <Icon
                    name="heroicons:check"
                    class="w-5 h-5 text-primary dark:text-primary-200 flex-shrink-0 mt-1"
                    aria-hidden="true"
                  />
                  <span class="text-gray-600 dark:text-gray-400">{{ point }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Highlights -->
          <ul
            v-else-if="key === 'highlights'"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0"
          >
            <li
              v-for="item in content.highlights.items"
              :key="item.title"
              class="bg-white dark:bg-gray-700 rounded-lg p-5 border border-gray-200 dark:border-gray-600"
            >
              <Icon
                :name="item.icon"
                class="w-6 h-6 text-primary dark:text-primary-200 mb-2"
                aria-hidden="true"
              />
              <span class="block text-sm font-medium text-gray-900 dark:text-white">
                {{ item.title }}
              </span>
            </li>
          </ul>

          <!-- Questions and answers -->
          <div v-else-if="key === 'faqs'" class="max-w-3xl mx-auto space-y-4">
            <UiAccordionItem
              v-for="faq in content.faqs.items"
              :key="faq.question"
              :title="faq.question"
              variant="card"
            >
              <p class="text-gray-600 dark:text-gray-400 whitespace-pre-line">{{ faq.answer }}</p>
            </UiAccordionItem>
          </div>
        </div>
      </section>
    </template>

    <!-- Call to action -->
    <section class="section bg-primary text-white on-brand">
      <div class="container text-center">
        <h2 class="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
          {{ app.ctaTitle || $t('apps.ctaDefaultTitle') }}
        </h2>
        <p class="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          {{ app.ctaText || app.summary }}
        </p>
        <div class="flex flex-wrap justify-center gap-4">
          <a
            :href="app.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            {{ launchLabel }}
            <span aria-hidden="true">↗</span>
            <span class="sr-only">{{ $t('apps.opensInNewTab') }}</span>
          </a>
          <component
            :is="privacyLink.external ? 'a' : NuxtLink"
            v-if="privacyLink"
            v-bind="privacyLink.attrs"
            class="inline-flex items-center gap-2 px-6 py-3 bg-transparent text-white border-2 border-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            {{ $t('apps.privacyNotice') }}
            <span v-if="privacyLink.external" class="sr-only">{{ $t('apps.opensInNewTab') }}</span>
          </component>
        </div>
      </div>
    </section>

    <!-- Quick links -->
    <nav class="section-sm bg-gray-50 dark:bg-gray-900" :aria-label="$t('apps.quickLinks')">
      <ul class="container flex flex-wrap justify-center gap-4 list-none m-0">
        <li>
          <NuxtLink :to="localePath('/apps')" class="btn-outline">{{
            $t('apps.allApps')
          }}</NuxtLink>
        </li>
        <li>
          <NuxtLink :to="localePath('/contact')" class="btn-outline">
            {{ $t('common.contact') }}
          </NuxtLink>
        </li>
        <li>
          <NuxtLink :to="localePath('/about')" class="btn-outline">{{
            $t('apps.aboutGas')
          }}</NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup lang="ts">
  import { NuxtLink } from '#components'
  import type { ServiceApp } from '~/types'
  import { APP_SECTION_KEYS, type AppSectionKey } from '~/utils/serviceApps'
  import { sanitizeHtml } from '~/utils/sanitizeHtml'

  const props = defineProps<{ app: ServiceApp }>()

  const { t } = useI18n()
  const localePath = useLocalePath()

  const content = computed(() => props.app.content)
  const body = computed(() => sanitizeHtml(props.app.body))
  const launchLabel = computed(
    () => props.app.launchLabel || t('apps.open', { name: props.app.name })
  )

  function hasSection(key: AppSectionKey): boolean {
    return content.value[key].items.length > 0
  }

  const visibleSections = computed(() => APP_SECTION_KEYS.filter(hasSection))

  const stepColumns = computed(() => {
    const count = content.value.steps.items.length
    if (count >= 4) return 'md:grid-cols-2 lg:grid-cols-4'
    if (count === 3) return 'md:grid-cols-3'
    if (count === 2) return 'md:grid-cols-2'
    return ''
  })

  /** The privacy notice: a page on this site, or another website in a new tab. */
  const privacyLink = computed(() => {
    const url = props.app.privacyUrl
    if (!url) return null
    if (url.startsWith('/') && !url.startsWith('//')) {
      return { external: false, attrs: { to: localePath(url) } }
    }
    return {
      external: true,
      attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' }
    }
  })
</script>

<style scoped>
  .app-body :deep(p + p) {
    margin-top: 1.5rem;
  }
</style>
