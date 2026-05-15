<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Careers', path: '/careers' },
        { label: 'Tenders', path: '/careers/tenders' }
      ]"
    />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Tenders & Procurement</h1>
        <p class="page-subtitle">
          Current procurement opportunities and tender notices from the Ghana Audit Service.
        </p>
      </div>
    </div>

    <!-- Filter Section -->
    <section
      class="section-sm bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="container">
        <div class="flex flex-wrap gap-2">
          <button
            :class="selectedStatus === '' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
            @click="selectedStatus = ''"
          >
            All Tenders
          </button>
          <button
            :class="selectedStatus === 'open' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
            @click="selectedStatus = 'open'"
          >
            Open
          </button>
          <button
            :class="selectedStatus === 'closed' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
            @click="selectedStatus = 'closed'"
          >
            Closed
          </button>
          <button
            :class="selectedStatus === 'awarded' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
            @click="selectedStatus = 'awarded'"
          >
            Awarded
          </button>
        </div>
      </div>
    </section>

    <!-- Tenders List -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <template v-else>
          <!-- Results Count -->
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Showing {{ filteredTenders.length }} tenders
          </p>

          <!-- Empty State -->
          <div
            v-if="filteredTenders.length === 0"
            class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:clipboard-document-list"
              class="w-10 h-10 text-primary dark:text-primary-light mb-4 mx-auto"
              aria-hidden="true"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No tenders found
            </h3>
            <p class="text-gray-600 dark:text-gray-400">
              {{
                selectedStatus
                  ? 'No ' + selectedStatus + ' tenders available.'
                  : 'Check back soon for new opportunities.'
              }}
            </p>
          </div>

          <!-- Tenders List -->
          <div v-else class="space-y-4">
            <CareersTenderCard
              v-for="tender in filteredTenders"
              :key="tender.id"
              :tender="tender"
            />
          </div>
        </template>
      </div>
    </section>

    <!-- Procurement Guidelines -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Procurement Guidelines"
          description="Important information for prospective bidders"
          size="sm"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div
            class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">How to Participate</h3>
            <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <span class="text-primary dark:text-primary-light">1.</span>
                Download the tender document
              </li>
              <li class="flex items-start gap-2">
                <span class="text-primary dark:text-primary-light">2.</span>
                Review all requirements carefully
              </li>
              <li class="flex items-start gap-2">
                <span class="text-primary dark:text-primary-light">3.</span>
                Prepare your bid/proposal
              </li>
              <li class="flex items-start gap-2">
                <span class="text-primary dark:text-primary-light">4.</span>
                Submit before the deadline
              </li>
            </ul>
          </div>

          <div
            class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Contact Procurement</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              For inquiries about specific tenders or procurement processes:
            </p>
            <div class="space-y-2 text-sm">
              <p class="flex items-center gap-2">
                <span class="text-gray-400">Email:</span>
                <a
                  href="mailto:procurement@audit.gov.gh"
                  class="text-primary dark:text-primary-light"
                  >procurement@audit.gov.gh</a
                >
              </p>
              <p class="flex items-center gap-2">
                <span class="text-gray-400">Phone:</span>
                <span class="text-gray-900 dark:text-white">+233 (302) 664929</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Back to Careers -->
    <section class="section-sm bg-gray-50 dark:bg-gray-900">
      <div class="container text-center">
        <NuxtLink to="/careers" class="btn-outline">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Careers
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { Tender } from '~/types'

  // SEO
  useSeoMeta({
    title: 'Tenders & Procurement | Ghana Audit Service',
    description:
      'View current procurement opportunities and tender notices from the Ghana Audit Service.'
  })

  const tenders = ref<Tender[]>([])
  const loading = ref(true)
  const selectedStatus = ref('')

  const filteredTenders = computed(() => {
    if (!selectedStatus.value) return tenders.value
    return tenders.value.filter((t) => t.status === selectedStatus.value)
  })

  onMounted(async () => {
    try {
      const response = await $fetch<{ data: Tender[] }>('/api/tenders')
      tenders.value = response.data
    } catch {
      // fetch failed — page shows empty state
    } finally {
      loading.value = false
    }
  })
</script>
