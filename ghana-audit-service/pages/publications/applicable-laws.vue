<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Publications', path: '/publications' },
        { label: 'Applicable Laws', path: '/publications/applicable-laws' }
      ]"
    />

    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Applicable Laws</h1>
        <p class="page-subtitle">
          Constitutional provisions and legislation governing the Ghana Audit Service.
        </p>
      </div>
    </div>

    <!-- Constitutional Provisions -->
    <section class="section">
      <div class="container">
        <div class="max-w-4xl mx-auto">
          <UiSectionHeader
            title="Constitutional Foundation"
            description="The Ghana Audit Service derives its mandate from the 1992 Constitution of Ghana"
            size="sm"
            :centered="false"
          />

          <div class="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-8 mb-8">
            <h3 class="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">
              Chapter 13 - Finance (Articles 187-189)
            </h3>
            <div class="prose prose-gray dark:prose-invert max-w-none">
              <p>
                <strong>Article 187</strong> establishes the Auditor-General as an independent
                officer responsible for auditing the public accounts of Ghana and all public
                offices.
              </p>
              <p>
                <strong>Article 188</strong> outlines the duties of the Auditor-General, including
                the auditing of all Ministries, Departments, and Agencies, District Assemblies, and
                other public institutions.
              </p>
              <p>
                <strong>Article 189</strong> provides for the independence of the Auditor-General
                and protection against interference in the discharge of duties.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Primary Legislation -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <div class="max-w-4xl mx-auto">
          <UiSectionHeader
            title="Primary Legislation"
            description="Key laws establishing and governing the Ghana Audit Service"
            size="sm"
            :centered="false"
          />

          <div class="space-y-6">
            <article
              v-for="law in primaryLaws"
              :key="law.title"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <div class="p-6">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-grow">
                    <UiBadge variant="warning" size="sm" class="mb-2">
                      Primary Legislation
                    </UiBadge>
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {{ law.title }}
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                      {{ law.description }}
                    </p>

                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="provision in law.keyProvisions"
                        :key="provision"
                        class="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded"
                      >
                        {{ provision }}
                      </span>
                    </div>
                  </div>

                  <a
                    v-if="law.fileUrl"
                    :href="law.fileUrl"
                    class="btn-primary btn-sm flex-shrink-0"
                    download
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download
                  </a>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <!-- Related Legislation -->
    <section class="section">
      <div class="container">
        <div class="max-w-4xl mx-auto">
          <UiSectionHeader
            title="Related Legislation"
            description="Other laws relevant to public financial management and accountability"
            size="sm"
            :centered="false"
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="law in relatedLaws"
              :key="law.title"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
            >
              <h4 class="font-semibold text-gray-900 dark:text-white mb-2">{{ law.title }}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ law.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Loading Publications from API -->
    <section v-if="publications.length > 0" class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <div class="max-w-4xl mx-auto">
          <UiSectionHeader
            title="Downloadable Documents"
            description="Access official copies of relevant legislation"
            size="sm"
            :centered="false"
          />

          <div class="space-y-4">
            <article
              v-for="publication in publications"
              :key="publication.id"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex items-center gap-6"
            >
              <div
                class="flex-shrink-0 w-12 h-12 bg-warning/20 dark:bg-warning/30 rounded-lg flex items-center justify-center"
              >
                <svg
                  class="w-6 h-6 text-warning"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                  />
                </svg>
              </div>

              <div class="flex-grow">
                <h4 class="font-semibold text-gray-900 dark:text-white">{{ publication.title }}</h4>
                <p v-if="publication.excerpt" class="text-sm text-gray-600 dark:text-gray-400">
                  {{ publication.excerpt }}
                </p>
              </div>

              <a
                v-if="publication.fileUrl"
                :href="publication.fileUrl"
                class="btn-outline btn-sm flex-shrink-0"
                download
              >
                Download
              </a>
            </article>
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
    title: 'Applicable Laws | Ghana Audit Service',
    description:
      'Constitutional provisions and legislation governing the Ghana Audit Service, including the Audit Service Act, 2000 (Act 584).'
  })

  const { publications, fetchPublications } = usePublications()

  // Fetch law publications
  onMounted(() => {
    fetchPublications({ type: 'law', perPage: 10 })
  })

  const primaryLaws = [
    {
      title: 'Audit Service Act, 2000 (Act 584)',
      description:
        'The principal legislation establishing the Ghana Audit Service, defining its mandate, powers, and operations.',
      fileUrl: '/documents/laws/audit-service-act-584.pdf',
      keyProvisions: [
        'Establishment of Service',
        'Functions of Auditor-General',
        'Independence provisions',
        'Reporting requirements',
        'Staff conditions'
      ]
    },
    {
      title: 'Public Financial Management Act, 2016 (Act 921)',
      description:
        'Provides the framework for public financial management, including budgeting, accounting, and audit requirements.',
      fileUrl: '/documents/laws/pfm-act-921.pdf',
      keyProvisions: [
        'Budget preparation',
        'Revenue management',
        'Expenditure control',
        'Financial reporting',
        'External audit'
      ]
    }
  ]

  const relatedLaws = [
    {
      title: 'Public Procurement Act, 2003 (Act 663)',
      description: 'Regulates public procurement and establishes the Public Procurement Authority.'
    },
    {
      title: 'Internal Audit Agency Act, 2003 (Act 658)',
      description:
        'Establishes the Internal Audit Agency and regulates internal audit in the public sector.'
    },
    {
      title: 'Financial Administration Act, 2003 (Act 654)',
      description:
        'Provides for the administration of public funds and accountability requirements.'
    },
    {
      title: 'Local Governance Act, 2016 (Act 936)',
      description:
        'Establishes the local government system and provides for audit of District Assemblies.'
    },
    {
      title: 'National Pensions Act, 2008 (Act 766)',
      description:
        'Establishes the pension scheme for public sector employees including audit service staff.'
    },
    {
      title: 'Whistle-blowers Act, 2006 (Act 720)',
      description:
        'Protects persons who disclose information about impropriety in public institutions.'
    }
  ]
</script>
