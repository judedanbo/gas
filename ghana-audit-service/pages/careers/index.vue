<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb :crumbs="[{ label: 'Careers', path: '/careers' }]" />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Career Opportunities</h1>
        <p class="page-subtitle">
          Join the Ghana Audit Service and make a difference in public accountability.
        </p>
      </div>
    </div>

    <!-- Why Join Us -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Why Join the Ghana Audit Service?"
          description="Be part of an institution dedicated to promoting accountability and transparency"
          size="sm"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="benefit in benefits"
            :key="benefit.title"
            class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center"
          >
            <Icon
              :name="benefit.icon"
              class="w-10 h-10 text-primary dark:text-primary-light mb-4"
              aria-hidden="true"
            />
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">{{ benefit.title }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ benefit.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Current Vacancies -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Current Vacancies"
          description="Explore our open positions and find your next career opportunity"
          size="sm"
        />

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <template v-else>
          <!-- Empty State -->
          <div
            v-if="vacancies.length === 0"
            class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:briefcase"
              class="w-10 h-10 text-gray-400 mb-4"
              aria-hidden="true"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No vacancies available
            </h3>
            <p class="text-gray-600 dark:text-gray-400">Check back soon for new opportunities.</p>
          </div>

          <!-- Vacancies List -->
          <div v-else class="space-y-4">
            <CareersVacancyCard v-for="vacancy in vacancies" :key="vacancy.id" :vacancy="vacancy" />
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

    <!-- Application Process -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Application Process"
          description="How to apply for positions at the Ghana Audit Service"
          size="sm"
        />

        <div class="max-w-3xl mx-auto">
          <div class="relative">
            <div
              v-for="(step, index) in applicationSteps"
              :key="step.title"
              class="flex gap-4 mb-8 last:mb-0"
            >
              <div
                class="flex-shrink-0 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold"
              >
                {{ index + 1 }}
              </div>
              <div>
                <h4 class="font-semibold text-gray-900 dark:text-white mb-1">{{ step.title }}</h4>
                <p class="text-gray-600 dark:text-gray-400 text-sm">{{ step.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Other Opportunities -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container text-center">
        <UiSectionHeader
          title="Other Opportunities"
          description="Explore procurement and tender opportunities"
          size="sm"
        />
        <NuxtLink to="/careers/tenders" class="btn-primary"> View Tenders & Procurement </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { Vacancy, PaginatedResponse } from '~/types'

  // SEO
  useSeoMeta({
    title: 'Career Opportunities | Ghana Audit Service',
    description:
      'Join the Ghana Audit Service. Explore current job vacancies and career opportunities in public sector auditing.'
  })

  const benefits = [
    {
      icon: 'heroicons:academic-cap',
      title: 'Professional Development',
      description: 'Continuous learning and professional certification support'
    },
    {
      icon: 'heroicons:globe-americas',
      title: 'International Exposure',
      description: 'Work with international partners and attend global conferences'
    },
    {
      icon: 'heroicons:chart-bar',
      title: 'Career Growth',
      description: 'Clear career progression paths and promotion opportunities'
    },
    {
      icon: 'heroicons:scale',
      title: 'Meaningful Impact',
      description: 'Contribute to national accountability and good governance'
    }
  ]

  const applicationSteps = [
    {
      title: 'Review Job Requirements',
      description:
        'Carefully read the job description and ensure you meet the minimum qualifications.'
    },
    {
      title: 'Prepare Your Application',
      description:
        'Gather your CV, cover letter, academic certificates, and professional qualifications.'
    },
    {
      title: 'Submit Application',
      description: 'Submit your application through the specified channel before the deadline.'
    },
    {
      title: 'Assessment Process',
      description: 'Shortlisted candidates will undergo written tests and interviews.'
    },
    {
      title: 'Offer and Onboarding',
      description: 'Successful candidates receive offer letters and join our onboarding program.'
    }
  ]

  const vacancies = ref<Vacancy[]>([])
  const loading = ref(true)
  const meta = ref({
    total: 0,
    page: 1,
    perPage: 10,
    lastPage: 1
  })

  async function fetchVacancies(page = 1) {
    loading.value = true
    try {
      const response = await $fetch<PaginatedResponse<Vacancy>>('/api/vacancies', {
        query: { active: 'true', page, perPage: 10 }
      })
      vacancies.value = response.data
      meta.value = response.meta
    } catch (error) {
      console.error('Failed to fetch vacancies:', error)
    } finally {
      loading.value = false
    }
  }

  function goToPage(page: number) {
    meta.value.page = page
    fetchVacancies(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  onMounted(() => {
    fetchVacancies()
  })
</script>
