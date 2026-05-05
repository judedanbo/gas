<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb :crumbs="[{ label: 'Publications', path: '/publications' }]" />

    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Publications</h1>
        <p class="page-subtitle">
          Access official documents, press statements, manuals, and guidelines from the Ghana Audit
          Service.
        </p>
      </div>
    </div>

    <!-- Publication Categories -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Browse by Category"
          description="Select a category to view related publications"
          size="sm"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="category in categories"
            :key="category.path"
            :to="category.path"
            class="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all hover:border-primary hover:shadow-lg no-underline"
          >
            <Icon
              :name="category.icon"
              class="w-10 h-10 text-primary dark:text-primary-light mb-4"
              aria-hidden="true"
            />
            <h3
              class="text-xl font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary dark:group-hover:text-primary-light transition-colors"
            >
              {{ category.title }}
            </h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
              {{ category.description }}
            </p>
            <span
              class="text-primary dark:text-primary-light font-medium text-sm inline-flex items-center gap-1"
            >
              View Publications
              <svg
                class="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Recent Publications -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Recent Publications"
          description="Latest documents and resources from the Ghana Audit Service"
          size="sm"
        />

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Publications Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <PublicationsPublicationCard
            v-for="publication in publications"
            :key="publication.id"
            :publication="publication"
            @read-more="openPublication"
          />
        </div>
      </div>
    </section>

    <!-- Quick Links -->
    <section class="section bg-white dark:bg-gray-800">
      <div class="container">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- AMIS Manuals Highlight -->
          <div class="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-8">
            <h3 class="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">
              AMIS Audit Manuals
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Access our comprehensive Audit Management Information System manuals covering
              Financial, Compliance, IT, and Performance audits.
            </p>
            <NuxtLink to="/publications/amis-manuals" class="btn-primary btn-sm">
              View Manuals
            </NuxtLink>
          </div>

          <!-- Applicable Laws Highlight -->
          <div
            class="bg-secondary/5 dark:bg-secondary/10 border border-secondary/20 rounded-lg p-8"
          >
            <h3 class="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">
              Legal Framework
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Review the constitutional provisions and legislation governing the Ghana Audit
              Service.
            </p>
            <NuxtLink to="/publications/applicable-laws" class="btn-secondary btn-sm">
              View Laws
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Publication Modal -->
    <Teleport to="body">
      <div
        v-if="selectedPublication"
        class="fixed inset-0 z-modal bg-black/50 flex items-center justify-center p-4"
        @click.self="closePublication"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div
            class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center"
          >
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ selectedPublication.title }}
            </h2>
            <button
              type="button"
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              @click="closePublication"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div class="px-6 py-4">
            <div class="mb-4">
              <UiBadge :variant="getPublicationTypeVariant(selectedPublication.type)" size="sm">
                {{ getPublicationTypeLabel(selectedPublication.type) }}
              </UiBadge>
              <span class="text-sm text-gray-500 dark:text-gray-400 ml-2">
                {{ formatDate(selectedPublication.publishedAt) }}
              </span>
            </div>
            <div
              class="prose prose-gray dark:prose-invert max-w-none"
              v-html="selectedPublication.content || selectedPublication.excerpt"
            ></div>
          </div>
          <div
            class="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4"
          >
            <button type="button" class="btn-outline btn-sm" @click="closePublication">
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import type { Publication } from '~/types'

  // SEO
  useSeoMeta({
    title: 'Publications | Ghana Audit Service',
    description:
      'Access official documents, press statements, audit manuals, and guidelines from the Ghana Audit Service.'
  })

  const { publications, loading, fetchPublications } = usePublications()
  const { getPublicationTypeVariant, getPublicationTypeLabel } = useCategoryBadge()

  const categories = [
    {
      title: 'Press Statements',
      description: 'Official announcements and press releases from the Auditor-General.',
      icon: 'heroicons:megaphone',
      path: '/publications/press-statements'
    },
    {
      title: 'Bulletins',
      description: 'Quarterly newsletters and updates on audit activities.',
      icon: 'heroicons:newspaper',
      path: '/publications/bulletins'
    },
    {
      title: 'AMIS Manuals',
      description: 'Audit Management Information System manuals and technical guides.',
      icon: 'heroicons:book-open',
      path: '/publications/amis-manuals'
    },
    {
      title: 'Auditing Guidelines',
      description: 'Standards and procedures for public sector auditing.',
      icon: 'heroicons:clipboard-document-list',
      path: '/publications/guidelines'
    },
    {
      title: 'PFM Strategy',
      description: 'Public Financial Management Strategy 2022-2026.',
      icon: 'heroicons:chart-bar',
      path: '/publications/pfm-strategy'
    },
    {
      title: 'Applicable Laws',
      description: 'Constitutional provisions and legislation governing the Service.',
      icon: 'heroicons:scale',
      path: '/publications/applicable-laws'
    }
  ]

  // Fetch recent publications on mount
  onMounted(() => {
    fetchPublications({ perPage: 6 })
  })

  // Publication modal
  const selectedPublication = ref<Publication | null>(null)

  function openPublication(publication: Publication) {
    selectedPublication.value = publication
    document.body.style.overflow = 'hidden'
  }

  function closePublication() {
    selectedPublication.value = null
    document.body.style.overflow = ''
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
</script>
