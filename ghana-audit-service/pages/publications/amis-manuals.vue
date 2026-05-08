<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Publications', path: '/publications' },
        { label: 'AMIS Manuals', path: '/publications/amis-manuals' }
      ]"
    />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">AMIS Audit Manuals</h1>
        <p class="page-subtitle">
          Comprehensive audit methodology guides developed under the Audit Management Information
          System (AMIS).
        </p>
      </div>
    </div>

    <!-- Introduction -->
    <section class="section">
      <div class="container">
        <div class="max-w-3xl mx-auto text-center mb-12">
          <p class="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            The Ghana Audit Service has developed standardized audit manuals aligned with
            International Standards of Supreme Audit Institutions (ISSAI). These manuals provide
            comprehensive guidance for conducting various types of audits in the public sector.
          </p>
        </div>

        <!-- Manuals Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <article
            v-for="manual in manuals"
            :key="manual.title"
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all hover:border-primary hover:shadow-lg"
          >
            <!-- Manual Header -->
            <div :class="`bg-gradient-to-br ${manual.gradient} text-white p-8`">
              <Icon :name="manual.icon" class="w-12 h-12 text-white mb-4" aria-hidden="true" />
              <h2 class="text-2xl font-heading font-bold">
                {{ manual.title }}
              </h2>
            </div>

            <!-- Manual Content -->
            <div class="p-6">
              <p class="text-gray-600 dark:text-gray-400 mb-6">
                {{ manual.description }}
              </p>

              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Key Topics:</h4>
              <ul class="space-y-2 mb-6">
                <li
                  v-for="topic in manual.topics"
                  :key="topic"
                  class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                >
                  <svg
                    class="w-5 h-5 text-primary dark:text-primary-light flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {{ topic }}
                </li>
              </ul>

              <a :href="manual.fileUrl" class="btn-primary w-full justify-center" download>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download Manual
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Standards Section -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Aligned with International Standards"
          description="Our audit manuals are developed in accordance with international best practices"
          size="sm"
        />

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div
            class="bg-white dark:bg-gray-800 rounded-lg p-6 text-center border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:globe-americas"
              class="w-8 h-8 text-primary dark:text-primary-light mb-2 mx-auto"
              aria-hidden="true"
            />
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">INTOSAI</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              International Organization of Supreme Audit Institutions
            </p>
          </div>
          <div
            class="bg-white dark:bg-gray-800 rounded-lg p-6 text-center border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:clipboard-document-list"
              class="w-8 h-8 text-primary dark:text-primary-light mb-2 mx-auto"
              aria-hidden="true"
            />
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">ISSAI</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              International Standards of Supreme Audit Institutions
            </p>
          </div>
          <div
            class="bg-white dark:bg-gray-800 rounded-lg p-6 text-center border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:globe-alt"
              class="w-8 h-8 text-primary dark:text-primary-light mb-2 mx-auto"
              aria-hidden="true"
            />
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">AFROSAI-E</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              African Organisation of Supreme Audit Institutions
            </p>
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
    title: 'AMIS Audit Manuals | Ghana Audit Service',
    description:
      'Download comprehensive audit methodology guides for Financial, Compliance, IT, and Performance audits from the Ghana Audit Service.'
  })

  const manuals = [
    {
      title: 'Financial Audit Manual',
      description:
        'Comprehensive guide for conducting financial audits in accordance with ISSAI standards. Covers audit planning, risk assessment, substantive procedures, and reporting.',
      icon: 'heroicons:currency-dollar',
      gradient: 'from-primary to-primary-dark',
      fileUrl: '/documents/manuals/financial-audit-manual.pdf',
      topics: [
        'Financial statement audit methodology',
        'Risk assessment and materiality',
        'Internal control evaluation',
        'Substantive audit procedures',
        'Audit documentation and reporting'
      ]
    },
    {
      title: 'Compliance Audit Manual',
      description:
        'Guidelines for assessing compliance with laws, regulations, and policies. Includes criteria development, evidence gathering, and deviation reporting.',
      icon: 'heroicons:check-circle',
      gradient: 'from-secondary to-secondary-dark',
      fileUrl: '/documents/manuals/compliance-audit-manual.pdf',
      topics: [
        'Compliance audit framework',
        'Criteria identification',
        'Testing methodology',
        'Non-compliance documentation',
        'Recommendations development'
      ]
    },
    {
      title: 'IT Audit Manual',
      description:
        'Technical guidance for auditing information systems, cybersecurity controls, and data management practices in public sector entities.',
      icon: 'heroicons:computer-desktop',
      gradient: 'from-info to-info/80',
      fileUrl: '/documents/manuals/it-audit-manual.pdf',
      topics: [
        'IT governance assessment',
        'System access controls',
        'Data integrity testing',
        'Cybersecurity evaluation',
        'Business continuity review'
      ]
    },
    {
      title: 'Performance Audit Manual',
      description:
        'Methodology for evaluating the economy, efficiency, and effectiveness of government programs and activities.',
      icon: 'heroicons:chart-bar',
      gradient: 'from-accent-dark to-accent',
      fileUrl: '/documents/manuals/performance-audit-manual.pdf',
      topics: [
        'Performance audit planning',
        'Economy, efficiency, effectiveness criteria',
        'Evidence collection and analysis',
        'Root cause analysis',
        'Impact assessment and recommendations'
      ]
    }
  ]
</script>
