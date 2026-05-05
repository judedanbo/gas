<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Publications', path: '/publications' },
        { label: 'PFM Strategy', path: '/publications/pfm-strategy' }
      ]"
    />

    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">PFM Strategy 2022-2026</h1>
        <p class="page-subtitle">
          Ghana Audit Service's Public Financial Management Strategy for strengthening
          accountability and transparency.
        </p>
      </div>
    </div>

    <!-- Strategy Overview -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Main Content -->
          <div class="lg:col-span-2">
            <div
              class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8"
            >
              <h2 class="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">
                Strategic Overview
              </h2>

              <div class="prose prose-gray dark:prose-invert max-w-none">
                <p>
                  The Public Financial Management (PFM) Strategy 2022-2026 outlines the Ghana Audit
                  Service's roadmap for enhancing public sector accountability and strengthening the
                  external audit function in Ghana.
                </p>

                <p>
                  This five-year strategy is aligned with national development objectives,
                  international best practices, and the requirements of the Audit Service Act, 2000
                  (Act 584).
                </p>

                <h3>Vision</h3>
                <p>
                  To be a world-class Supreme Audit Institution that promotes accountability,
                  transparency, and good governance in the management of public resources.
                </p>

                <h3>Mission</h3>
                <p>
                  To audit and report on the management of public funds and resources to enhance
                  accountability and promote efficiency in the public sector.
                </p>
              </div>
            </div>

            <!-- Strategic Pillars -->
            <div
              class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 mt-8"
            >
              <h2 class="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">
                Strategic Pillars
              </h2>

              <div class="space-y-6">
                <div
                  v-for="(pillar, index) in strategicPillars"
                  :key="pillar.title"
                  class="flex gap-4"
                >
                  <div
                    class="flex-shrink-0 w-12 h-12 bg-primary text-white rounded-lg flex items-center justify-center font-bold text-lg"
                  >
                    {{ index + 1 }}
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {{ pillar.title }}
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400">
                      {{ pillar.description }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="lg:col-span-1">
            <!-- Download Card -->
            <div
              class="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-6 sticky top-24"
            >
              <div class="text-center mb-6">
                <Icon
                  name="heroicons:chart-bar"
                  class="w-12 h-12 text-primary dark:text-primary-light mb-4 mx-auto"
                  aria-hidden="true"
                />
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                  PFM Strategy Document
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  2022-2026 Strategic Plan
                </p>
              </div>

              <a
                href="/documents/publications/pfm-strategy-2022-2026.pdf"
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
                Download Full Strategy
              </a>

              <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Document Details
                </h4>
                <dl class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-gray-500 dark:text-gray-400">Published:</dt>
                    <dd class="text-gray-900 dark:text-white">March 2022</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-gray-500 dark:text-gray-400">Period:</dt>
                    <dd class="text-gray-900 dark:text-white">2022-2026</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-gray-500 dark:text-gray-400">Format:</dt>
                    <dd class="text-gray-900 dark:text-white">PDF</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Key Objectives -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Key Objectives"
          description="The strategy aims to achieve the following objectives by 2026"
          size="sm"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="objective in keyObjectives"
            :key="objective.title"
            class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div
              :class="`w-12 h-12 ${objective.bgColor} rounded-lg flex items-center justify-center mb-4`"
            >
              <Icon
                :name="objective.icon"
                class="w-6 h-6 text-gray-700 dark:text-gray-300"
                aria-hidden="true"
              />
            </div>
            <h4 class="font-semibold text-gray-900 dark:text-white mb-2">{{ objective.title }}</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ objective.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Back to Publications -->
    <section class="section bg-white dark:bg-gray-800">
      <div class="container text-center">
        <NuxtLink to="/publications" class="btn-outline">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Publications
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  // SEO
  useSeoMeta({
    title: 'PFM Strategy 2022-2026 | Ghana Audit Service',
    description:
      "Ghana Audit Service's Public Financial Management Strategy for strengthening accountability and transparency in public resource management."
  })

  const strategicPillars = [
    {
      title: 'Strengthening Audit Quality',
      description:
        'Enhancing audit methodologies, capacity building, and quality assurance processes to deliver high-quality audit reports.'
    },
    {
      title: 'Expanding Audit Coverage',
      description:
        'Increasing the scope of audits to cover more public entities and ensuring comprehensive oversight of public funds.'
    },
    {
      title: 'Enhancing Stakeholder Engagement',
      description:
        'Building stronger relationships with Parliament, civil society, and the public to promote accountability.'
    },
    {
      title: 'Modernizing Operations',
      description:
        'Leveraging technology and digital tools to improve audit efficiency and organizational effectiveness.'
    },
    {
      title: 'Strengthening Institutional Capacity',
      description:
        'Developing human resources, infrastructure, and systems to support the delivery of the audit mandate.'
    }
  ]

  const keyObjectives = [
    {
      icon: 'heroicons:chart-bar',
      title: 'Audit Coverage',
      description: 'Achieve 100% audit coverage of all auditable entities by 2026.',
      bgColor: 'bg-primary/10'
    },
    {
      icon: 'heroicons:clock',
      title: 'Timely Reporting',
      description: 'Submit all audit reports within 6 months of financial year-end.',
      bgColor: 'bg-secondary/10'
    },
    {
      icon: 'heroicons:flag',
      title: 'Recommendation Implementation',
      description: 'Achieve 80% implementation rate of audit recommendations.',
      bgColor: 'bg-accent/20'
    },
    {
      icon: 'heroicons:trophy',
      title: 'International Standards',
      description: 'Maintain full compliance with ISSAI standards across all audit types.',
      bgColor: 'bg-info/10'
    }
  ]
</script>
