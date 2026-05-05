<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Publications', path: '/publications' },
        { label: 'Press Statements', path: '/publications/press-statements' }
      ]"
    />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Press Statements</h1>
        <p class="page-subtitle">
          Official announcements and press releases from the Auditor-General of Ghana.
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

        <!-- Statements List -->
        <div v-else class="max-w-4xl mx-auto">
          <!-- Empty State -->
          <div
            v-if="publications.length === 0"
            class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:megaphone"
              class="w-10 h-10 text-primary dark:text-primary-light mb-4 mx-auto"
              aria-hidden="true"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No press statements available
            </h3>
            <p class="text-gray-600 dark:text-gray-400">Check back soon for updates.</p>
          </div>

          <!-- Statements -->
          <div v-else class="space-y-6">
            <article
              v-for="statement in publications"
              :key="statement.id"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all hover:border-primary hover:shadow-lg"
            >
              <div class="flex items-start justify-between gap-4 mb-4">
                <div>
                  <UiBadge variant="primary" size="sm" class="mb-2"> Press Statement </UiBadge>
                  <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                    {{ statement.title }}
                  </h2>
                </div>
                <time class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {{ formatDate(statement.publishedAt) }}
                </time>
              </div>

              <p v-if="statement.excerpt" class="text-gray-600 dark:text-gray-300 mb-4">
                {{ statement.excerpt }}
              </p>

              <div
                v-if="statement.content"
                class="prose prose-gray dark:prose-invert max-w-none mb-4"
              >
                <div v-html="statement.content"></div>
              </div>

              <div
                v-if="statement.fileUrl"
                class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <a
                  :href="statement.fileUrl"
                  class="btn-outline btn-sm inline-flex items-center gap-2"
                  download
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Download PDF
                </a>
              </div>
            </article>
          </div>

          <!-- Pagination -->
          <div v-if="meta.lastPage > 1" class="mt-8 flex justify-center gap-2">
            <button
              :disabled="meta.page === 1"
              class="btn-outline btn-sm"
              @click="goToPage(meta.page - 1)"
            >
              Previous
            </button>
            <span class="px-4 py-2 text-gray-600 dark:text-gray-400">
              Page {{ meta.page }} of {{ meta.lastPage }}
            </span>
            <button
              :disabled="meta.page === meta.lastPage"
              class="btn-outline btn-sm"
              @click="goToPage(meta.page + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Back to Publications -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container text-center">
        <NuxtLink to="/publications" class="btn-outline">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Publications
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  // SEO
  useSeoMeta({
    title: 'Press Statements | Ghana Audit Service',
    description: 'Official announcements and press releases from the Auditor-General of Ghana.'
  })

  const { publications, loading, meta, fetchPublications } = usePublications()

  // Fetch press statements on mount
  onMounted(() => {
    fetchPublications({ type: 'press-statement', perPage: 10 })
  })

  function goToPage(page: number) {
    meta.value.page = page
    fetchPublications({ type: 'press-statement', page, perPage: 10 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
