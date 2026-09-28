<template>
  <section class="section bg-gray-50 dark:bg-gray-900">
    <div class="container">
      <UiSectionHeader
        title="Latest Publications"
        description="Press statements, bulletins, and official documents"
      >
        <template #action>
          <NuxtLink to="/publications" class="btn-primary btn-sm">View All Publications</NuxtLink>
        </template>
      </UiSectionHeader>

      <!-- Loading skeleton -->
      <div v-if="pending" class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10" aria-hidden="true">
        <div
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 animate-pulse space-y-4"
        >
          <div class="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-7 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div class="flex flex-col gap-4">
          <div
            v-for="n in 4"
            :key="n"
            class="h-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse"
          />
        </div>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="text-center py-12 mb-10 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <Icon
          name="heroicons:exclamation-triangle"
          class="w-12 h-12 text-gray-400 mx-auto mb-4"
          aria-hidden="true"
        />
        <p class="text-gray-600 dark:text-gray-400">Unable to load publications right now.</p>
      </div>

      <!-- Empty -->
      <div
        v-else-if="!featuredPublication"
        class="text-center py-12 mb-10 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <Icon
          name="heroicons:document-text"
          class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4"
          aria-hidden="true"
        />
        <p class="text-gray-600 dark:text-gray-400">
          No publications have been published yet. Browse the archive for earlier documents.
        </p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <!-- Featured (most recent) publication -->
        <div>
          <article
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 h-full flex flex-col"
          >
            <div class="flex justify-between items-center gap-4 mb-4">
              <UiBadge variant="primary" size="sm">{{
                formatType(featuredPublication.type)
              }}</UiBadge>
              <time
                :datetime="featuredPublication.publishedAt"
                class="text-sm text-gray-500 dark:text-gray-400"
              >
                {{ formatDate(featuredPublication.publishedAt) }}
              </time>
            </div>
            <h3 class="text-2xl font-bold leading-snug mb-4">
              <NuxtLink
                :to="getPublicationUrl(featuredPublication)"
                class="text-gray-900 dark:text-white no-underline hover:text-primary dark:hover:text-primary-200 transition-colors"
              >
                {{ featuredPublication.title }}
              </NuxtLink>
            </h3>
            <p
              v-if="featuredPublication.excerpt"
              class="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 flex-grow line-clamp-4"
            >
              {{ featuredPublication.excerpt }}
            </p>
            <UiViewAllLink
              :to="getPublicationUrl(featuredPublication)"
              label="Read More"
              variant="text"
              class="mt-auto"
            />
          </article>
        </div>

        <!-- Recent publications list -->
        <div class="flex flex-col gap-4">
          <article
            v-for="publication in recentPublications"
            :key="publication.id"
            class="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-all hover:border-primary hover:shadow-md"
          >
            <Icon
              :name="getTypeIcon(publication.type)"
              class="w-8 h-8 flex-shrink-0 text-primary dark:text-primary-200"
              aria-hidden="true"
            />
            <div class="flex-1 min-w-0">
              <span
                class="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1"
              >
                {{ formatType(publication.type) }}
              </span>
              <h4 class="text-base font-medium leading-snug m-0 mb-1">
                <NuxtLink
                  :to="getPublicationUrl(publication)"
                  class="text-gray-900 dark:text-white no-underline hover:text-primary dark:hover:text-primary-200 transition-colors"
                >
                  {{ publication.title }}
                </NuxtLink>
              </h4>
              <time
                :datetime="publication.publishedAt"
                class="text-sm text-gray-500 dark:text-gray-400"
              >
                {{ formatDate(publication.publishedAt) }}
              </time>
            </div>
            <a
              v-if="publication.fileUrl"
              :href="publication.fileUrl"
              class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full transition-all no-underline hover:bg-primary hover:text-white"
              download
              :aria-label="`Download PDF: ${publication.title}`"
            >
              <Icon name="heroicons:arrow-down-tray" class="w-5 h-5" aria-hidden="true" />
            </a>
          </article>
        </div>
      </div>

      <!-- Publication categories -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <UiInfoCard
          v-for="category in categories"
          :key="category.slug"
          :icon="category.icon"
          :title="category.name"
          :description="category.description"
          :to="category.href"
          variant="centered"
          hover
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { Publication, PublicationType, PaginatedResponse } from '~/types'

  // Most recent publications across all types (same fetch pattern as HomeLatestReports)
  const { data, pending, error } = await useFetch<PaginatedResponse<Publication>>(
    '/api/publications',
    { query: { perPage: 5 } }
  )

  const publications = computed(() => data.value?.data ?? [])
  const featuredPublication = computed(() => publications.value[0] ?? null)
  const recentPublications = computed(() => publications.value.slice(1, 5))

  const categories = [
    {
      name: 'Press Statements',
      slug: 'press-statements',
      href: '/publications/press-statements',
      icon: 'heroicons:newspaper',
      description: 'Official announcements'
    },
    {
      name: 'Bulletins',
      slug: 'bulletins',
      href: '/publications/bulletins',
      icon: 'heroicons:document-text',
      description: 'Quarterly publications'
    },
    {
      name: 'Audit Guidelines',
      slug: 'guidelines',
      href: '/publications/guidelines',
      icon: 'heroicons:clipboard-document-list',
      description: 'Standards and procedures'
    },
    {
      name: 'AMIS Manuals',
      slug: 'amis-manuals',
      href: '/publications/amis-manuals',
      icon: 'heroicons:book-open',
      description: 'Audit management manuals'
    }
  ]

  const getTypeIcon = (type: PublicationType): string => {
    const icons: Record<PublicationType, string> = {
      'press-statement': 'heroicons:newspaper',
      bulletin: 'heroicons:document-text',
      guideline: 'heroicons:clipboard-document-list',
      manual: 'heroicons:book-open',
      strategy: 'heroicons:flag',
      law: 'heroicons:scale'
    }
    return icons[type] || 'heroicons:document-text'
  }

  const formatType = (type: PublicationType): string => {
    const labels: Record<PublicationType, string> = {
      'press-statement': 'Press Statement',
      bulletin: 'Bulletin',
      guideline: 'Guideline',
      manual: 'Manual',
      strategy: 'Strategy',
      law: 'Law'
    }
    return labels[type] || type
  }

  const { formatDateShort: formatDate } = useLocaleDate()

  const getPublicationUrl = (publication: Publication): string => {
    const typeToPath: Record<PublicationType, string> = {
      'press-statement': '/publications/press-statements',
      bulletin: '/publications/bulletins',
      guideline: '/publications/guidelines',
      manual: '/publications/amis-manuals',
      strategy: '/publications/pfm-strategy',
      law: '/publications/applicable-laws'
    }
    return `${typeToPath[publication.type]}/${publication.slug}`
  }
</script>
