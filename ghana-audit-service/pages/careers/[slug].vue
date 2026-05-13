<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Careers', path: '/careers' },
        { label: vacancy?.title || 'Vacancy', path: `/careers/${route.params.slug}` }
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
        <Icon name="heroicons:briefcase" class="w-16 h-16 text-primary dark:text-primary-light mb-4 mx-auto" aria-hidden="true" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Vacancy Not Found</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6">The position you're looking for doesn't exist or has been removed.</p>
        <NuxtLink to="/careers" class="btn-primary">
          View All Vacancies
        </NuxtLink>
      </div>
    </div>

    <!-- Vacancy Content -->
    <template v-else-if="vacancy">
      <!-- Vacancy Header -->
      <section class="bg-gradient-to-br from-primary to-primary-dark text-white py-12">
        <div class="container">
          <div class="max-w-3xl">
            <div class="flex items-center gap-2 mb-4">
              <UiBadge :variant="vacancy.isActive ? 'success' : 'gray'" size="md">
                {{ vacancy.isActive ? 'Active' : 'Closed' }}
              </UiBadge>
              <UiBadge variant="accent" size="md">
                {{ vacancy.type }}
              </UiBadge>
            </div>

            <h1 class="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              {{ vacancy.title }}
            </h1>

            <div class="flex flex-wrap gap-6 text-white/90">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {{ vacancy.department }}
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ vacancy.location }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Vacancy Details -->
      <section class="section">
        <div class="container">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Main Content -->
            <div class="lg:col-span-2">
              <!-- Job Description -->
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 mb-8">
                <h2 class="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">
                  Job Description
                </h2>
                <div class="prose prose-gray dark:prose-invert max-w-none" v-html="vacancy.description" />
              </div>

              <!-- Requirements -->
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
                <h2 class="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">
                  Requirements
                </h2>
                <ul class="space-y-3">
                  <li
                    v-for="requirement in vacancy.requirements"
                    :key="requirement"
                    class="flex items-start gap-3"
                  >
                    <svg class="w-5 h-5 text-primary dark:text-primary-light flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-gray-700 dark:text-gray-300">{{ requirement }}</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1">
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 sticky top-24">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Job Details
                </h3>

                <dl class="space-y-4 mb-6">
                  <div>
                    <dt class="text-sm text-gray-500 dark:text-gray-400">Department</dt>
                    <dd class="text-gray-900 dark:text-white font-medium">{{ vacancy.department }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-gray-500 dark:text-gray-400">Location</dt>
                    <dd class="text-gray-900 dark:text-white font-medium">{{ vacancy.location }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-gray-500 dark:text-gray-400">Employment Type</dt>
                    <dd class="text-gray-900 dark:text-white font-medium capitalize">{{ vacancy.type }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-gray-500 dark:text-gray-400">Application Deadline</dt>
                    <dd class="text-gray-900 dark:text-white font-medium">{{ formatDate(vacancy.deadline) }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-gray-500 dark:text-gray-400">Posted On</dt>
                    <dd class="text-gray-900 dark:text-white font-medium">{{ formatDate(vacancy.publishedAt) }}</dd>
                  </div>
                </dl>

                <div v-if="vacancy.isActive && !isPastDeadline" class="space-y-3">
                  <button class="btn-primary w-full justify-center">
                    Apply Now
                  </button>
                  <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Applications close on {{ formatDate(vacancy.deadline) }}
                  </p>
                </div>

                <div v-else class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p class="text-gray-600 dark:text-gray-400 text-sm">
                    {{ isPastDeadline ? 'Application deadline has passed' : 'This position is no longer available' }}
                  </p>
                </div>

                <NuxtLink to="/careers" class="btn-outline w-full justify-center mt-4">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Vacancies
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Vacancy } from '~/types'

const route = useRoute()

// Fetch vacancy
const { data: vacancy, pending, error } = await useFetch<Vacancy>(
  `/api/vacancies/${route.params.slug}`
)

const isPastDeadline = computed(() => {
  if (!vacancy.value) return false
  return new Date(vacancy.value.deadline) < new Date()
})

// SEO
useSeoMeta({
  title: () => vacancy.value ? `${vacancy.value.title} | Careers | Ghana Audit Service` : 'Vacancy | Ghana Audit Service',
  description: () => vacancy.value ? `Apply for ${vacancy.value.title} at the Ghana Audit Service. ${vacancy.value.department} - ${vacancy.value.location}` : 'Career opportunity at the Ghana Audit Service'
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
