<template>
  <section class="section bg-gray-50 dark:bg-gray-900">
    <div class="container">
      <UiSectionHeader
        title="Latest Publications"
        description="Press statements, bulletins, and official documents"
        with-action
        action-text="View All Publications"
        action-to="/publications"
      />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <!-- Featured Publication -->
        <div>
          <article
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 h-full flex flex-col"
          >
            <div class="flex justify-between items-center mb-4">
              <UiBadge variant="primary" size="sm">Press Statement</UiBadge>
              <span class="text-sm text-gray-400">{{
                formatDate(featuredPublication.publishedAt)
              }}</span>
            </div>
            <h3 class="text-2xl font-bold leading-snug mb-4">
              <NuxtLink
                :to="`/publications/press-statements/${featuredPublication.slug}`"
                class="text-gray-900 dark:text-white no-underline hover:text-primary dark:hover:text-primary-light transition-colors"
              >
                {{ featuredPublication.title }}
              </NuxtLink>
            </h3>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 flex-grow">
              {{ featuredPublication.excerpt }}
            </p>
            <UiViewAllLink
              :to="`/publications/press-statements/${featuredPublication.slug}`"
              label="Read Full Statement"
              variant="text"
            />
          </article>
        </div>

        <!-- Recent Publications List -->
        <div class="flex flex-col gap-4">
          <article
            v-for="publication in recentPublications"
            :key="publication.id"
            class="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-all hover:border-primary hover:shadow-md"
          >
            <Icon
              :name="getTypeIcon(publication.type)"
              class="w-8 h-8 flex-shrink-0 text-primary dark:text-primary-light"
              aria-hidden="true"
            />
            <div class="flex-1 min-w-0">
              <span class="block text-xs text-gray-400 uppercase tracking-wider mb-1">{{
                formatType(publication.type)
              }}</span>
              <h4 class="text-base font-medium leading-snug m-0 mb-1">
                <NuxtLink
                  :to="getPublicationUrl(publication)"
                  class="text-gray-900 dark:text-white no-underline hover:text-primary dark:hover:text-primary-light transition-colors"
                >
                  {{ publication.title }}
                </NuxtLink>
              </h4>
              <span class="text-sm text-gray-400">{{ formatDate(publication.publishedAt) }}</span>
            </div>
            <a
              v-if="publication.fileUrl"
              :href="publication.fileUrl"
              class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-lg transition-all no-underline hover:bg-primary hover:text-white"
              download
              aria-label="Download PDF"
            >
              <Icon name="heroicons:arrow-down-tray" class="w-5 h-5" aria-hidden="true" />
            </a>
          </article>
        </div>
      </div>

      <!-- Publication Categories -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <UiInfoCard
          v-for="category in categories"
          :key="category.slug"
          :icon="category.icon"
          :title="category.name"
          :description="`${category.count} items`"
          :to="category.href"
          variant="centered"
          hover
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { Publication, PublicationType } from '~/types'

  // Featured publication (latest press statement)
  const featuredPublication = {
    id: '1',
    title: 'Audit Service Releases 2023 Annual Report on Public Accounts',
    slug: 'gas-2023-annual-report-release',
    type: 'press-statement' as PublicationType,
    publishedAt: '2024-07-15',
    excerpt:
      'The Audit Service has officially released its comprehensive 2023 Annual Report on the Public Accounts of Ghana. The report highlights key findings from audits conducted across all government ministries, departments, and agencies, with recommendations for improving public financial management.'
  }

  // Recent publications
  const recentPublications: Publication[] = [
    {
      id: '2',
      title: 'Quarterly Bulletin - Q2 2024',
      slug: 'quarterly-bulletin-q2-2024',
      type: 'bulletin',
      publishedAt: '2024-07-01',
      fileUrl: '/documents/bulletins/q2-2024.pdf'
    },
    {
      id: '3',
      title: 'Updated Financial Audit Guidelines 2024',
      slug: 'financial-audit-guidelines-2024',
      type: 'guideline',
      publishedAt: '2024-06-20',
      fileUrl: '/documents/guidelines/financial-audit-2024.pdf'
    },
    {
      id: '4',
      title: 'Statement on Audit of COVID-19 Expenditure',
      slug: 'covid-19-expenditure-audit-statement',
      type: 'press-statement',
      publishedAt: '2024-06-10'
    },
    {
      id: '5',
      title: 'Performance Audit Manual - Revised Edition',
      slug: 'performance-audit-manual-revised',
      type: 'manual',
      publishedAt: '2024-05-25',
      fileUrl: '/documents/manuals/performance-audit-manual.pdf'
    }
  ]

  // Publication categories
  const categories = [
    {
      name: 'Press Statements',
      slug: 'press-statements',
      href: '/publications/press-statements',
      icon: 'heroicons:newspaper',
      count: 45
    },
    {
      name: 'Bulletins',
      slug: 'bulletins',
      href: '/publications/bulletins',
      icon: 'heroicons:document-text',
      count: 24
    },
    {
      name: 'Audit Guidelines',
      slug: 'guidelines',
      href: '/publications/guidelines',
      icon: 'heroicons:clipboard-document-list',
      count: 12
    },
    {
      name: 'AMIS Manuals',
      slug: 'amis-manuals',
      href: '/publications/amis-manuals',
      icon: 'heroicons:document-text',
      count: 4
    }
  ]

  const getTypeIcon = (type: PublicationType): string => {
    const icons: Record<PublicationType, string> = {
      'press-statement': 'heroicons:newspaper',
      bulletin: 'heroicons:document-text',
      guideline: 'heroicons:clipboard-document-list',
      manual: 'heroicons:document-text',
      strategy: 'heroicons:flag',
      law: 'heroicons:scale'
    }
    return icons[type] || 'heroicons:document-text'
  }

  const formatType = (type: PublicationType): string => {
    const labels: Record<PublicationType, string> = {
      'press-statement': 'Press Statement',
      bulletin: 'Bulletin',
      guideline: 'Guideline',
      manual: 'Manual',
      strategy: 'Strategy',
      law: 'Law'
    }
    return labels[type] || type
  }

  const { formatDateShort: formatDate } = useLocaleDate()

  const getPublicationUrl = (publication: Publication): string => {
    const typeToPath: Record<PublicationType, string> = {
      'press-statement': '/publications/press-statements',
      bulletin: '/publications/bulletins',
      guideline: '/publications/guidelines',
      manual: '/publications/amis-manuals',
      strategy: '/publications/pfm-strategy',
      law: '/publications/applicable-laws'
    }
    return `${typeToPath[publication.type]}/${publication.slug}`
  }
</script>
