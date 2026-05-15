<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'News', path: '/media/news' }
      ]"
    />

    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">News</h1>
        <p class="page-subtitle">Latest news and announcements from the Ghana Audit Service.</p>
      </div>
    </div>

    <!-- Main Content -->
    <section class="section">
      <div class="container">
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <template v-else>
          <!-- Featured Story -->
          <div v-if="featuredArticle && !searchQuery && !selectedYear" class="mb-10">
            <NuxtLink
              :to="`/media/news/${featuredArticle.slug}`"
              class="group grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-primary dark:hover:border-primary hover:shadow-lg transition-all"
            >
              <div class="aspect-video lg:aspect-auto lg:min-h-[320px] overflow-hidden">
                <img
                  v-if="featuredArticle.thumbnail"
                  :src="featuredArticle.thumbnail"
                  :alt="featuredArticle.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                >
                <div v-else class="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <Icon name="heroicons:newspaper" class="w-20 h-20 text-gray-400 opacity-50" aria-hidden="true" />
                </div>
              </div>
              <div class="p-6 lg:p-8 flex flex-col justify-center">
                <div class="flex items-center gap-3 mb-3">
                  <UiBadge variant="accent" size="sm">Latest</UiBadge>
                  <time class="text-sm text-gray-500 dark:text-gray-400">{{ formatDate(featuredArticle.publishedAt) }}</time>
                </div>
                <h2 class="text-2xl lg:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-3 group-hover:text-primary transition-colors">
                  {{ featuredArticle.title }}
                </h2>
                <p class="text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
                  {{ featuredArticle.excerpt }}
                </p>
                <span class="text-primary font-medium inline-flex items-center gap-1">
                  Read Full Story
                  <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </NuxtLink>
          </div>

          <!-- Search & Filter Bar -->
          <div class="flex flex-col sm:flex-row gap-3 mb-6">
            <div class="relative flex-1">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                v-model="searchInput"
                type="text"
                placeholder="Search articles..."
                class="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                @input="onSearchInput"
              >
              <button
                v-if="searchInput"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                @click="clearSearch"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button
                :class="!selectedYear ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
                @click="selectYear(null)"
              >
                All Years
              </button>
              <button
                v-for="year in availableYears"
                :key="year"
                :class="selectedYear === year ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
                @click="selectYear(year)"
              >
                {{ year }}
              </button>
            </div>
          </div>

          <!-- Results Count -->
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            <template v-if="searchQuery">
              {{ filteredArticles.length }} results for "{{ searchQuery }}"
            </template>
            <template v-else-if="selectedYear">
              {{ filteredArticles.length }} articles from {{ selectedYear }}
            </template>
            <template v-else>
              Showing {{ gridArticles.length }} of {{ meta.total }} articles
            </template>
          </p>

          <!-- Empty State -->
          <div
            v-if="filteredArticles.length === 0"
            class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon name="heroicons:magnifying-glass" class="w-10 h-10 text-gray-400 mx-auto mb-4" aria-hidden="true" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No articles found</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your search or filter.</p>
            <button class="btn-outline btn-sm" @click="clearFilters">Clear Filters</button>
          </div>

          <!-- News Grid -->
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MediaNewsCard
              v-for="article in gridArticles"
              :key="article.id"
              :article="article"
            />
          </div>

          <!-- Pagination -->
          <div v-if="!searchQuery && !selectedYear && meta.lastPage > 1" class="mt-8 flex justify-center gap-2">
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

useSeoMeta({
  title: 'News | Ghana Audit Service',
  description: 'Latest news and announcements from the Ghana Audit Service.'
})

const news = ref<NewsArticle[]>([])
const loading = ref(true)
const searchInput = ref('')
const searchQuery = ref('')
const selectedYear = ref<number | null>(null)
let searchTimeout: ReturnType<typeof setTimeout>

const meta = ref({
  total: 0,
  page: 1,
  perPage: 12,
  lastPage: 1
})

const availableYears = computed(() => {
  const years = new Set(news.value.map(a => new Date(a.publishedAt).getFullYear()))
  return [...years].sort((a, b) => b - a)
})

const filteredArticles = computed(() => {
  let result = news.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(
      a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q)
    )
  }

  if (selectedYear.value) {
    result = result.filter(
      a => new Date(a.publishedAt).getFullYear() === selectedYear.value
    )
  }

  return result
})

const featuredArticle = computed(() => news.value[0] || null)

const gridArticles = computed(() => {
  if (searchQuery.value || selectedYear.value) return filteredArticles.value
  return filteredArticles.value.slice(1)
})

function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchQuery.value = searchInput.value.trim()
  }, 300)
}

function clearSearch() {
  searchInput.value = ''
  searchQuery.value = ''
}

function selectYear(year: number | null) {
  selectedYear.value = year
}

function clearFilters() {
  searchInput.value = ''
  searchQuery.value = ''
  selectedYear.value = null
}

async function fetchNews(page = 1) {
  loading.value = true
  try {
    const response = await $fetch<PaginatedResponse<NewsArticle>>('/api/news', {
      query: { page, perPage: meta.value.perPage }
    })
    news.value = response.data
    meta.value = response.meta
  } catch {
    // fetch failed — page shows empty state
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
</script>
