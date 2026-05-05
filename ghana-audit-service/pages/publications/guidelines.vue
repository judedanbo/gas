<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Publications', path: '/publications' },
        { label: 'Guidelines', path: '/publications/guidelines' }
      ]"
    />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Auditing Guidelines</h1>
        <p class="page-subtitle">
          Standards and procedures for auditing public sector entities in Ghana.
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <section class="section">
      <div class="container">
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Guidelines List -->
        <div v-else class="max-w-4xl mx-auto">
          <!-- Empty State -->
          <div
            v-if="publications.length === 0"
            class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:clipboard-document-list"
              class="w-10 h-10 text-primary dark:text-primary-light mb-4 mx-auto"
              aria-hidden="true"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No guidelines available
            </h3>
            <p class="text-gray-600 dark:text-gray-400">Check back soon for updates.</p>
          </div>

          <div v-else class="space-y-4">
            <article
              v-for="guideline in publications"
              :key="guideline.id"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all hover:border-primary hover:shadow-lg flex items-center gap-6"
            >
              <div
                class="flex-shrink-0 w-16 h-16 bg-accent/20 dark:bg-accent/30 rounded-lg flex items-center justify-center"
              >
                <svg
                  class="w-8 h-8 text-accent-dark dark:text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>

              <div class="flex-grow">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {{ guideline.title }}
                </h3>
                <p v-if="guideline.excerpt" class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {{ guideline.excerpt }}
                </p>
                <time class="text-xs text-gray-500 dark:text-gray-400">
                  Published: {{ formatDate(guideline.publishedAt) }}
                </time>
              </div>

              <a
                v-if="guideline.fileUrl"
                :href="guideline.fileUrl"
                class="btn-primary btn-sm flex-shrink-0"
                download
              >
                Download
              </a>
            </article>
          </div>
        </div>
      </div>
    </section>

    <!-- Additional Guidelines Info -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <div class="max-w-3xl mx-auto">
          <UiSectionHeader title="About Our Guidelines" size="sm" :centered="false" />

          <div class="prose prose-gray dark:prose-invert max-w-none">
            <p>
              The Ghana Audit Service develops auditing guidelines to ensure consistent,
              high-quality audits across all public sector entities. These guidelines are aligned
              with:
            </p>

            <ul>
              <li>International Standards of Supreme Audit Institutions (ISSAI)</li>
              <li>INTOSAI Framework of Professional Pronouncements</li>
              <li>AFROSAI-E Regional Guidelines</li>
              <li>Ghana's Public Financial Management Act</li>
              <li>The Audit Service Act, 2000 (Act 584)</li>
            </ul>

            <p>
              For questions about specific guidelines or their application, please contact our
              Quality Assurance Department.
            </p>
          </div>

          <div class="mt-6">
            <NuxtLink to="/contact" class="btn-outline"> Contact Us </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  // SEO
  useSeoMeta({
    title: 'Auditing Guidelines | Ghana Audit Service',
    description:
      'Standards and procedures for auditing public sector entities in Ghana, aligned with ISSAI and international best practices.'
  })

  const { publications, loading, fetchPublications } = usePublications()

  // Fetch guidelines on mount
  onMounted(() => {
    fetchPublications({ type: 'guideline', perPage: 20 })
  })

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
</script>
