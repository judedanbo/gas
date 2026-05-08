<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb :crumbs="[{ label: 'Media Centre', path: '/media' }]" />

    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Media Centre</h1>
        <p class="page-subtitle">News, events, photos, and videos from the Ghana Audit Service.</p>
      </div>
    </div>

    <!-- Media Categories -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <NuxtLink
            v-for="category in categories"
            :key="category.path"
            :to="category.path"
            class="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center transition-all hover:border-primary hover:shadow-lg no-underline"
          >
            <div class="w-14 h-14 mx-auto mb-4 bg-primary/10 dark:bg-primary/20 rounded-xl flex items-center justify-center">
              <Icon
                :name="category.icon"
                class="w-7 h-7 text-primary dark:text-primary-light"
                aria-hidden="true"
              />
            </div>
            <h3
              class="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary dark:group-hover:text-primary-light transition-colors"
            >
              {{ category.title }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {{ category.description }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Latest News -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Latest News"
          description="Stay updated with the latest news from the Ghana Audit Service"
          size="sm"
        />

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- News Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MediaNewsCard v-for="article in news" :key="article.id" :article="article" />
        </div>

        <div class="text-center mt-8">
          <NuxtLink to="/media/news" class="btn-primary"> View All News </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Social Media -->
    <section class="section">
      <div class="container text-center max-w-2xl mx-auto">
        <UiSectionHeader
          title="Connect With Us"
          description="Follow the Ghana Audit Service on social media for updates and announcements"
          size="sm"
        />

        <div class="flex justify-center gap-4">
          <a
            v-for="social in socialLinks"
            :key="social.name"
            :href="social.url"
            target="_blank"
            rel="noopener noreferrer"
            class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-2xl hover:bg-primary hover:text-white transition-colors"
            :aria-label="social.name"
          >
            <Icon :name="social.icon" class="w-6 h-6" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { NewsArticle } from '~/types'

  // SEO
  useSeoMeta({
    title: 'Media Centre | Ghana Audit Service',
    description: 'News, events, photos, and videos from the Ghana Audit Service.'
  })

  const categories = [
    {
      title: 'News',
      description: 'Stay updated with latest news, announcements, and press coverage',
      icon: 'heroicons:newspaper',
      path: '/media/news'
    },
    {
      title: 'Events',
      description: 'Upcoming conferences, workshops, and institutional engagements',
      icon: 'heroicons:calendar',
      path: '/media/events'
    },
    {
      title: 'Photo Gallery',
      description: 'Browse photos from events, ceremonies, and official activities',
      icon: 'heroicons:camera',
      path: '/media/gallery'
    },
    {
      title: 'Videos',
      description: 'Watch recordings of hearings, presentations, and media briefings',
      icon: 'heroicons:video-camera',
      path: '/media/videos'
    }
  ]

  const socialLinks = [
    { name: 'Facebook', icon: 'heroicons:globe-alt', url: '#' },
    { name: 'Twitter', icon: 'heroicons:chat-bubble-left', url: '#' },
    { name: 'LinkedIn', icon: 'heroicons:briefcase', url: '#' },
    { name: 'YouTube', icon: 'heroicons:play-circle', url: '#' }
  ]

  // Fetch latest news
  const news = ref<NewsArticle[]>([])
  const loading = ref(true)

  onMounted(async () => {
    try {
      const response = await $fetch<{ data: NewsArticle[] }>('/api/news', {
        query: { perPage: 3 }
      })
      news.value = response.data
    } catch (error) {
      console.error('Failed to fetch news:', error)
    } finally {
      loading.value = false
    }
  })
</script>
