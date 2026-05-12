<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      v-if="publication"
      :crumbs="[
        { label: 'Publications', path: '/publications' },
        { label: 'Press Statements', path: '/publications/press-statements' },
        { label: publication.title, path: `/publications/press-statements/${publication.slug}` }
      ]"
    />

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container">
        <div class="flex justify-center py-12">
          <UiLoadingSpinner />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="section">
      <div class="container text-center py-12">
        <Icon
          name="heroicons:megaphone"
          class="w-16 h-16 text-primary mb-4 mx-auto"
          aria-hidden="true"
        />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Press Statement Not Found
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          The press statement you're looking for doesn't exist or has been removed.
        </p>
        <NuxtLink to="/publications/press-statements" class="btn-primary">
          Back to Press Statements
        </NuxtLink>
      </div>
    </div>

    <!-- Content -->
    <template v-else-if="publication">
      <!-- Header -->
      <section class="bg-gradient-to-br from-primary to-primary-dark text-white py-12">
        <div class="container">
          <div class="max-w-4xl">
            <UiBadge
              :variant="getPublicationTypeVariant('press-statement')"
              size="md"
              class="mb-4"
            >
              Press Statement
            </UiBadge>

            <h1 class="text-3xl md:text-4xl font-heading font-bold text-white mb-6">
              {{ publication.title }}
            </h1>

            <div class="flex flex-wrap gap-6 text-white/90">
              <UiIconText icon="calendar" size="md" color="white" gap="sm">
                Published: {{ formatDate(publication.publishedAt) }}
              </UiIconText>
            </div>
          </div>
        </div>
      </section>

      <!-- Detail Section -->
      <section class="section">
        <div class="container">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- PDF Reader -->
            <div class="lg:col-span-2">
              <template v-if="publication.fileUrl">
                <ClientOnly>
                  <ReportsPdfReader :file-url="publication.fileUrl" :title="publication.title" viewer-title="Press Statement Viewer" />
                  <template #fallback>
                    <div
                      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 min-h-[70vh] flex items-center justify-center"
                    >
                      <UiLoadingSpinner />
                    </div>
                  </template>
                </ClientOnly>
              </template>

              <!-- Content fallback when no file -->
              <div
                v-else-if="publication.content"
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8"
              >
                <div
                  class="prose prose-lg dark:prose-invert max-w-none"
                  v-html="publication.content"
                ></div>
              </div>

              <div
                v-else
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 min-h-[50vh] flex items-center justify-center"
              >
                <div class="text-center">
                  <Icon
                    name="heroicons:document-text"
                    class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4 mx-auto"
                    aria-hidden="true"
                  />
                  <p class="text-gray-600 dark:text-gray-400">
                    Full content will be available soon.
                  </p>
                </div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1">
              <div
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-24"
              >
                <!-- Thumbnail -->
                <div class="aspect-[4/3] w-full bg-gray-100 dark:bg-gray-700">
                  <img
                    v-if="publication.thumbnail"
                    :src="publication.thumbnail"
                    :alt="publication.title"
                    class="w-full h-full object-cover object-top"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5"
                  >
                    <Icon
                      name="heroicons:megaphone"
                      class="w-16 h-16 text-primary/30"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div class="p-6">
                  <!-- Excerpt -->
                  <p
                    v-if="publication.excerpt"
                    class="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed"
                  >
                    {{ publication.excerpt }}
                  </p>

                  <!-- Download -->
                  <a
                    v-if="publication.fileUrl"
                    :href="publication.fileUrl"
                    class="btn-primary w-full justify-center mb-4"
                    download
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download PDF
                  </a>

                  <!-- Details -->
                  <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Details
                    </h4>
                    <dl class="space-y-2 text-sm">
                      <div class="flex justify-between">
                        <dt class="text-gray-500 dark:text-gray-400">Type:</dt>
                        <dd class="text-gray-900 dark:text-white font-medium">Press Statement</dd>
                      </div>
                      <div class="flex justify-between">
                        <dt class="text-gray-500 dark:text-gray-400">Published:</dt>
                        <dd class="text-gray-900 dark:text-white font-medium">
                          {{ formatDate(publication.publishedAt) }}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <NuxtLink
                    to="/publications/press-statements"
                    class="btn-outline w-full justify-center mt-4"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          </div>
        </div>
      </section>

      <!-- Related Press Statements -->
      <section class="section bg-gray-50 dark:bg-gray-900">
        <div class="container">
          <UiSectionHeader
            title="More Press Statements"
            description="Other official announcements from the Auditor-General"
            size="sm"
          />

          <div
            v-if="relatedPublications.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <NuxtLink
              v-for="related in relatedPublications"
              :key="related.id"
              :to="`/publications/press-statements/${related.slug}`"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all hover:border-primary hover:shadow-lg group"
            >
              <div class="aspect-[16/9] w-full bg-gray-100 dark:bg-gray-700">
                <img
                  v-if="related.thumbnail"
                  :src="related.thumbnail"
                  :alt="related.title"
                  class="w-full h-full object-cover object-top"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5"
                >
                  <Icon
                    name="heroicons:megaphone"
                    class="w-10 h-10 text-primary/30"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div class="p-4">
                <h3
                  class="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors"
                >
                  {{ related.title }}
                </h3>
                <time class="text-sm text-gray-500 dark:text-gray-400">
                  {{ formatDate(related.publishedAt) }}
                </time>
              </div>
            </NuxtLink>
          </div>

          <div v-else class="text-center py-8 text-gray-600 dark:text-gray-400">
            No related press statements found.
          </div>

          <div class="text-center mt-8">
            <NuxtLink to="/publications/press-statements" class="btn-outline">
              View All Press Statements
            </NuxtLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { Publication, PaginatedResponse } from '~/types'

  const route = useRoute()
  const slug = route.params.slug as string
  const { getPublicationTypeVariant } = useCategoryBadge()

  const {
    data: publication,
    pending,
    error
  } = await useFetch<Publication>(`/api/publications/${slug}`)

  const relatedPublications = ref<Publication[]>([])

  watchEffect(async () => {
    if (publication.value) {
      try {
        const response = await $fetch<PaginatedResponse<Publication>>('/api/publications', {
          query: { type: 'press-statement', perPage: 3 }
        })
        relatedPublications.value = response.data
          .filter((p) => p.slug !== publication.value?.slug)
          .slice(0, 3)
      } catch {
        relatedPublications.value = []
      }
    }
  })

  useSeoMeta({
    title: () =>
      publication.value
        ? `${publication.value.title} | Ghana Audit Service`
        : 'Press Statement | Ghana Audit Service',
    description: () =>
      publication.value?.excerpt || 'Press statement from the Ghana Audit Service'
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
