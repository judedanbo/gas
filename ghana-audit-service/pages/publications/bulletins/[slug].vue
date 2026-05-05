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
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Bulletin Not Found</h1>
        <p class="text-gray-600 mb-6">The bulletin you're looking for doesn't exist.</p>
        <NuxtLink to="/publications/bulletins" class="btn-primary"> Back to Bulletins </NuxtLink>
      </div>
    </div>

    <!-- Content -->
    <template v-else-if="publication">
      <!-- Page Header -->
      <div class="page-header">
        <div class="container">
          <UiBadge variant="info" size="sm" class="mb-4">Bulletin</UiBadge>
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
          { label: 'Bulletins', path: '/publications/bulletins' },
          { label: publication.title, path: `/publications/bulletins/${publication.slug}` }
        ]"
      />

      <!-- Content Section -->
      <section class="section">
        <div class="container">
          <div class="max-w-3xl mx-auto">
            <!-- Excerpt -->
            <p v-if="publication.excerpt" class="text-xl text-gray-600 mb-8 leading-relaxed">
              {{ publication.excerpt }}
            </p>

            <!-- Download Section -->
            <div v-if="publication.fileUrl" class="bg-gray-50 rounded-lg p-8 text-center">
              <Icon
                name="heroicons:document-text"
                class="w-12 h-12 text-primary mb-4 mx-auto"
                aria-hidden="true"
              />
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Download Bulletin</h3>
              <p class="text-gray-600 mb-6">Get the full bulletin in PDF format.</p>
              <a :href="publication.fileUrl" class="btn-primary" download> Download PDF </a>
            </div>

            <!-- No File -->
            <div v-else class="bg-gray-50 rounded-lg p-8 text-center">
              <p class="text-gray-600">PDF download will be available soon.</p>
            </div>

            <!-- Back Link -->
            <div class="mt-8 pt-8 border-t border-gray-200">
              <NuxtLink to="/publications/bulletins" class="btn-outline">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Bulletins
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

      useSeoMeta({
        title: `${publication.value.title} | Ghana Audit Service`,
        description: publication.value.excerpt || `Quarterly bulletin from the Ghana Audit Service`
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
