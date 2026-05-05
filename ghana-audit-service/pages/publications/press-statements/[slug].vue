<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="text-6xl mb-4">404</div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Publication Not Found</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          The press statement you're looking for doesn't exist.
        </p>
        <NuxtLink to="/publications/press-statements" class="btn-primary">
          Back to Press Statements
        </NuxtLink>
      </div>
    </div>

    <!-- Content -->
    <template v-else-if="publication">
      <!-- Page Header -->
      <div class="page-header">
        <div class="container">
          <UiBadge variant="primary" size="sm" class="mb-4">Press Statement</UiBadge>
          <h1 class="text-3xl md:text-4xl font-heading font-bold mb-4">
            {{ publication.title }}
          </h1>
          <p class="page-subtitle">Published {{ formatDate(publication.publishedAt) }}</p>
        </div>
      </div>

      <!-- Breadcrumb -->
      <CommonBreadcrumb
        :crumbs="[
          { label: 'Publications', path: '/publications' },
          { label: 'Press Statements', path: '/publications/press-statements' },
          { label: publication.title, path: `/publications/press-statements/${publication.slug}` }
        ]"
      />

      <!-- Content Section -->
      <section class="section">
        <div class="container">
          <div class="max-w-3xl mx-auto">
            <!-- Excerpt -->
            <p
              v-if="publication.excerpt"
              class="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed"
            >
              {{ publication.excerpt }}
            </p>

            <!-- Main Content -->
            <div
              v-if="publication.content"
              class="prose prose-lg dark:prose-invert max-w-none"
              v-html="publication.content"
            ></div>

            <!-- No Content -->
            <div v-else class="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
              <p class="text-gray-600 dark:text-gray-400">Full content will be available soon.</p>
            </div>

            <!-- Download Button -->
            <div
              v-if="publication.fileUrl"
              class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700"
            >
              <a :href="publication.fileUrl" class="btn-primary" download> Download PDF </a>
            </div>

            <!-- Share & Actions -->
            <div
              class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4"
            >
              <NuxtLink to="/publications/press-statements" class="btn-outline">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Press Statements
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { Publication } from '~/types'

  const route = useRoute()
  const slug = route.params.slug as string

  const publication = ref<Publication | null>(null)
  const loading = ref(true)
  const error = ref(false)

  onMounted(async () => {
    try {
      publication.value = await $fetch<Publication>(`/api/publications/${slug}`)

      // Set SEO
      useSeoMeta({
        title: `${publication.value.title} | Ghana Audit Service`,
        description: publication.value.excerpt || `Press statement from the Ghana Audit Service`
      })
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
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

<style scoped>
  .prose :deep(ul) {
    @apply list-disc list-inside space-y-2;
  }
  .prose :deep(p) {
    @apply mb-4;
  }
</style>
