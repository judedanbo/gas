<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'News', path: '/media/news' },
        { label: article?.title || 'Article', path: `/media/news/${route.params.slug}` }
      ]"
    />

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container">
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="section">
      <div class="container text-center py-12">
        <Icon name="heroicons:newspaper" class="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
        <h2 class="text-display-md font-heading font-bold text-gray-900 dark:text-white mb-2">Article Not Found</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">The article you're looking for doesn't exist or has been removed.</p>
        <NuxtLink to="/media/news" class="btn-primary">
          Back to News
        </NuxtLink>
      </div>
    </div>

    <!-- Article Content -->
    <template v-else-if="article">
      <!-- Article Header -->
      <section class="bg-gradient-to-br from-primary to-primary-dark text-white py-12">
        <div class="container">
          <div class="max-w-3xl">
            <div class="flex items-center gap-3 mb-4">
              <UiBadge v-if="article.category" variant="accent" size="md">
                {{ article.category }}
              </UiBadge>
              <time class="text-white/80">{{ formatDate(article.publishedAt) }}</time>
            </div>

            <h1 class="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              {{ article.title }}
            </h1>

            <div v-if="article.author" class="flex items-center gap-2 text-white/80">
              <span>By {{ article.author }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Article Body -->
      <section class="section">
        <div class="container">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Main Content -->
            <div class="lg:col-span-2">
              <!-- Featured Image -->
              <div v-if="article.thumbnail" class="mb-8 rounded-lg overflow-hidden">
                <NuxtImg
                  :src="article.thumbnail"
                  :alt="article.title"
                  class="w-full"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 66vw, 800px"
                />
              </div>

              <!-- Article Content -->
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
                <div class="prose prose-lg dark:prose-invert max-w-none" v-html="article.content"></div>

                <!-- Tags -->
                <div v-if="article.tags?.length" class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Tags</h4>
                  <div class="flex flex-wrap gap-2">
                    <UiTag v-for="tag in article.tags" :key="tag">
                      {{ tag }}
                    </UiTag>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1">
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 sticky top-24">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Share This Article</h3>

                <div class="flex gap-2 mb-6">
                  <button class="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                    Facebook
                  </button>
                  <button class="flex-1 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors">
                    Twitter
                  </button>
                </div>

                <NuxtLink to="/media/news" class="btn-outline w-full justify-center">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to News
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Related News -->
      <section v-if="relatedNews.length > 0" class="section bg-gray-50 dark:bg-gray-900">
        <div class="container">
          <UiSectionHeader
            title="Related News"
            description="More news from the Ghana Audit Service"
            size="sm"
          />

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MediaNewsCard
              v-for="related in relatedNews"
              :key="related.id"
              :article="related"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { NewsArticle } from '~/types'

const route = useRoute()
const { getNewsArticleSchema, getBreadcrumbSchema } = useSchemaOrg()

// Fetch article
const { data: article, pending, error } = await useFetch<NewsArticle>(
  `/api/news/${route.params.slug}`
)

// Fetch related news
const relatedNews = ref<NewsArticle[]>([])

watchEffect(async () => {
  if (article.value) {
    try {
      const response = await $fetch<{ data: NewsArticle[] }>('/api/news', {
        query: { perPage: 3 }
      })
      relatedNews.value = response.data.filter(n => n.id !== article.value?.id).slice(0, 3)
    } catch {
      relatedNews.value = []
    }
  }
})

// SEO with structured data
watchEffect(() => {
  if (article.value) {
    const schemas = [
      getNewsArticleSchema({
        title: article.value.title,
        excerpt: article.value.excerpt,
        publishedAt: article.value.publishedAt,
        author: article.value.author,
        thumbnail: article.value.thumbnail,
        slug: article.value.slug
      }),
      getBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Media Centre', url: '/media' },
        { name: 'News', url: '/media/news' },
        { name: article.value.title, url: `/media/news/${article.value.slug}` }
      ])
    ]

    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schemas)
        }
      ]
    })
  }
})

useSeoMeta({
  title: () => article.value ? `${article.value.title} | Ghana Audit Service` : 'News | Ghana Audit Service',
  description: () => article.value?.excerpt || 'News from the Ghana Audit Service'
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
