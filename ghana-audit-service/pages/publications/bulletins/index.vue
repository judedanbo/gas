<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Publications', path: '/publications' },
        { label: 'Bulletins', path: '/publications/bulletins' }
      ]"
    />

    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Quarterly Bulletins</h1>
        <p class="page-subtitle">
          Stay informed with quarterly updates on audit activities, capacity building, and
          stakeholder engagements.
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

        <!-- Bulletins Grid -->
        <template v-else>
          <!-- Empty State -->
          <div
            v-if="publications.length === 0"
            class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:newspaper"
              class="w-10 h-10 text-primary dark:text-primary-light mb-4 mx-auto"
              aria-hidden="true"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No bulletins available
            </h3>
            <p class="text-gray-600 dark:text-gray-400">Check back soon for quarterly updates.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <NuxtLink
              v-for="bulletin in publications"
              :key="bulletin.id"
              :to="`/publications/bulletins/${bulletin.slug}`"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all hover:border-info hover:shadow-lg group"
            >
              <!-- Bulletin Cover -->
              <div class="aspect-[4/3] w-full bg-gray-100 dark:bg-gray-700">
                <img
                  v-if="bulletin.thumbnail"
                  :src="bulletin.thumbnail"
                  :alt="bulletin.title"
                  class="w-full h-full object-cover object-top"
                />
                <div
                  v-else
                  class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-info to-info/80 text-white p-6"
                >
                  <Icon
                    name="heroicons:newspaper"
                    class="w-12 h-12 text-white mb-4 opacity-80"
                    aria-hidden="true"
                  />
                  <UiBadge variant="info" size="sm"> Bulletin </UiBadge>
                </div>
              </div>

              <!-- Bulletin Info -->
              <div class="p-6">
                <UiBadge variant="info" size="sm" class="mb-2"> Bulletin </UiBadge>
                <h3
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-info transition-colors"
                >
                  {{ bulletin.title }}
                </h3>
                <p
                  v-if="bulletin.excerpt"
                  class="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2"
                >
                  {{ bulletin.excerpt }}
                </p>

                <div class="flex items-center justify-between">
                  <time class="text-sm text-gray-500 dark:text-gray-400">
                    {{ formatDate(bulletin.publishedAt) }}
                  </time>
                  <span class="text-info text-sm font-medium group-hover:underline">
                    View &rarr;
                  </span>
                </div>
              </div>
            </NuxtLink>
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

    <!-- Subscribe Section -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container text-center max-w-2xl mx-auto">
        <UiSectionHeader
          title="Stay Updated"
          description="For inquiries about receiving our quarterly bulletins, please contact us."
          size="sm"
        />
        <NuxtLink to="/contact" class="btn-primary"> Contact Us </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  // SEO
  useSeoMeta({
    title: 'Quarterly Bulletins | Ghana Audit Service',
    description:
      'Quarterly updates on audit activities, capacity building initiatives, and stakeholder engagements from the Ghana Audit Service.'
  })

  const { publications, loading, meta, fetchPublications } = usePublications()

  // Fetch bulletins on mount
  onMounted(() => {
    fetchPublications({ type: 'bulletin', perPage: 9 })
  })

  function goToPage(page: number) {
    meta.value.page = page
    fetchPublications({ type: 'bulletin', page, perPage: 9 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric'
    })
  }
</script>
