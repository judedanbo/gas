<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">
          News
        </h1>
        <p class="page-subtitle">
          Latest news and announcements from the Ghana Audit Service.
        </p>
      </div>
    </div>

    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'News', path: '/media/news' }
      ]"
    />

    <!-- Main Content -->
    <section class="section">
      <div class="container">
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- News Grid -->
        <template v-else>
          <!-- Results Count -->
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Showing {{ news.length }} of {{ meta.total }} articles
          </p>

          <!-- Empty State -->
          <div v-if="news.length === 0" class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Icon name="heroicons:newspaper" class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" aria-hidden="true" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No news articles yet</h3>
            <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              News articles and announcements will appear here as they are published. Stay informed about the Ghana Audit Service's latest activities.
            </p>
            <div class="flex flex-wrap justify-center gap-3">
              <NuxtLink to="/publications/press-statements" class="btn-primary btn-sm">
                View Press Statements
              </NuxtLink>
              <NuxtLink to="/contact" class="btn-outline btn-sm">
                Contact Us
              </NuxtLink>
            </div>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MediaNewsCard
              v-for="article in news"
              :key="article.id"
              :article="article"
            />
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
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { NewsArticle, PaginatedResponse } from '~/types'

// SEO
useSeoMeta({
  title: 'News | Ghana Audit Service',
  description: 'Latest news and announcements from the Ghana Audit Service.'
})

const news = ref<NewsArticle[]>([])
const loading = ref(true)
const meta = ref({
  total: 0,
  page: 1,
  perPage: 9,
  lastPage: 1
})

async function fetchNews(page = 1) {
  loading.value = true
  try {
    const response = await $fetch<PaginatedResponse<NewsArticle>>('/api/news', {
      query: { page, perPage: 9 }
    })
    news.value = response.data
    meta.value = response.meta
  } catch (error) {
    console.error('Failed to fetch news:', error)
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  meta.value.page = page
  fetchNews(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  fetchNews()
})
</script>
