<template>
  <div>
    <CommonBreadcrumb :crumbs="breadcrumbs" />

    <!-- Page Header -->
    <section class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">The Service</h1>
        <p class="max-w-[600px] mx-auto text-lg text-white/90">
          Over a century of excellence in public sector auditing and accountability
        </p>
      </div>
    </section>

    <!-- Introduction -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10 items-center">
          <div>
            <h2 class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-4">Our Story</h2>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              The Ghana Audit Service traces its origins to 1910, when the colonial
              administration established the Audit Department to oversee the accounts
              of the Gold Coast. Since then, we have evolved into a modern, independent
              Supreme Audit Institution that plays a critical role in Ghana's governance
              framework.
            </p>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Through periods of colonial rule, various governments, and constitutional
              changes, the Audit Service has remained steadfast in its commitment to
              safeguarding public resources and promoting accountability.
            </p>
          </div>
          <div>
            <div class="bg-gradient-to-br from-primary to-primary-dark text-white p-10 rounded-lg text-center">
              <span class="block text-6xl font-bold text-accent leading-none mb-2">115+</span>
              <span class="text-lg text-white/90">Years of Service to Ghana</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Historical Timeline -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Our Historical Journey"
          description="Key milestones in the evolution of the Ghana Audit Service"
        />
        <div class="timeline">
          <div
            v-for="(event, index) in timeline"
            :key="event.year"
            class="timeline-item"
            :class="{ 'timeline-item-right': index % 2 !== 0 }"
          >
            <div class="timeline-marker">
              <span class="timeline-year">{{ event.year }}</span>
            </div>
            <div class="timeline-content">
              <h3 class="text-primary dark:text-primary-light text-lg font-semibold mb-2">{{ event.title }}</h3>
              <p class="text-gray-600 dark:text-gray-400 m-0 text-sm">{{ event.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Core Functions -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Core Functions"
          description="The fundamental activities that define our work"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div v-for="func in coreFunctions" :key="func.title" class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
            <Icon :name="func.icon" class="w-10 h-10 text-primary dark:text-primary-light mb-4" aria-hidden="true" />
            <h3 class="text-base text-primary dark:text-primary-light mb-2 font-semibold">{{ func.title }}</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">{{ func.description }}</p>
            <UiCheckList
              :items="func.items"
              icon="bullet"
              spacing="sm"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Types of Audits -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Types of Audits We Conduct"
          description="Comprehensive audit coverage across all aspects of public financial management"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <UiInfoCard
            v-for="audit in auditTypes"
            :key="audit.title"
            :icon="audit.icon"
            :title="audit.title"
            :description="audit.description"
            variant="centered"
            hover
          />
        </div>
      </div>
    </section>

    <!-- Audit Universe -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Our Audit Universe"
          description="The scope of entities we audit across Ghana"
        />
        <UiStatGrid
          :stats="universeStats"
          :columns="4"
          class="mb-10"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="category in entityCategories" :key="category.title" class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
            <h4 class="text-primary dark:text-primary-light text-base font-semibold mb-4">{{ category.title }}</h4>
            <UiCheckList
              :items="category.entities"
              icon="bullet"
              spacing="sm"
              icon-color="gray"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Independence -->
    <section class="section bg-gradient-to-br from-primary to-primary-dark">
      <div class="container">
        <div class="text-center max-w-[900px] mx-auto">
          <h2 class="text-2xl md:text-3xl font-heading font-bold text-white mb-4">Our Independence</h2>
          <p class="text-white/90 text-lg leading-relaxed mb-10">
            The independence of the Auditor-General and the Ghana Audit Service is
            guaranteed under the 1992 Constitution. This constitutional protection
            ensures that we can carry out our mandate without fear or favor,
            reporting objectively on the stewardship of public resources.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div v-for="item in independencePoints" :key="item.title" class="bg-white/10 rounded-lg p-6 text-center">
              <Icon :name="item.icon" class="w-10 h-10 text-accent mx-auto mb-3" aria-hidden="true" />
              <h4 class="text-sm text-accent mb-2 font-semibold">{{ item.title }}</h4>
              <p class="text-white/80 text-sm m-0">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Strategic Plan -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <h2 class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-4">Strategic Direction</h2>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              Our current Strategic Plan (2022-2026) outlines our commitment to
              becoming a world-class Supreme Audit Institution. Key strategic
              objectives include:
            </p>
            <UiCheckList
              :items="strategicObjectives"
              icon="check"
              divided
            />
            <NuxtLink to="/publications/pfm-strategy" class="btn-primary mt-6 inline-block">
              View PFM Strategy 2022-2026
            </NuxtLink>
          </div>
          <div>
            <div class="w-full aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-4">
              <Icon name="heroicons:chart-bar" class="w-24 h-24 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              <span class="text-gray-400 dark:text-gray-500 text-sm">Strategic Vision</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Page meta
useHead({
  title: 'The Service'
})

useSeoMeta({
  title: 'The Service - Ghana Audit Service',
  description: 'Learn about the history, core functions, and mandate of the Ghana Audit Service - over 115 years of public sector auditing excellence.',
  ogTitle: 'The Service - Ghana Audit Service',
  ogDescription: 'Over a century of excellence in public sector auditing and accountability.'
})

// Breadcrumbs
const breadcrumbs = [
  { label: 'About Us', path: '/about' },
  { label: 'The Service', path: '/about/the-service' }
]

// Historical timeline
const timeline = [
  { year: '1910', title: 'Establishment', description: 'The Audit Department was established under the colonial administration of the Gold Coast.' },
  { year: '1957', title: 'Independence Era', description: 'Ghana gained independence. The Audit Department continued its work under the new nation.' },
  { year: '1969', title: 'Constitutional Recognition', description: 'The 1969 Constitution established the office of the Auditor-General as a constitutional position.' },
  { year: '1992', title: 'Fourth Republic', description: 'The 1992 Constitution strengthened the independence of the Auditor-General under Articles 187-189.' },
  { year: '2000', title: 'Audit Service Act', description: 'The Audit Service Act (Act 584) was enacted, establishing the Ghana Audit Service as a body corporate.' },
  { year: '2016', title: 'PFM Act', description: 'The Public Financial Management Act (Act 921) further strengthened the audit framework.' },
  { year: '2020', title: 'Digital Transformation', description: 'Launch of the Audit Management Information System (AMIS) for modern audit operations.' },
  { year: 'Present', title: 'Continued Excellence', description: 'Continuing to uphold the highest standards of public sector auditing aligned with ISSAI standards.' }
]

// Core functions
const coreFunctions = [
  { icon: 'heroicons:chart-bar', title: 'Financial Auditing', description: 'Examining financial statements and records to ensure accuracy and compliance.', items: ['Verification of financial statements', 'Assessment of internal controls', 'Evaluation of accounting systems', 'Testing of transactions'] },
  { icon: 'heroicons:scale', title: 'Compliance Auditing', description: 'Ensuring adherence to laws, regulations, and established procedures.', items: ['Legal compliance review', 'Regulatory adherence assessment', 'Policy compliance verification', 'Procurement process review'] },
  { icon: 'heroicons:chart-bar', title: 'Performance Auditing', description: 'Evaluating economy, efficiency, and effectiveness of government programs.', items: ['Value-for-money assessments', 'Program effectiveness review', 'Resource utilization analysis', 'Outcome measurement'] },
  { icon: 'heroicons:computer-desktop', title: 'IT Auditing', description: 'Assessing information technology systems, controls, and cybersecurity.', items: ['IT systems evaluation', 'Cybersecurity assessment', 'Data integrity verification', 'IT governance review'] }
]

// Types of audits
const auditTypes = [
  { icon: 'heroicons:document-duplicate', title: 'Financial Audit', description: 'Examination of financial statements to express an opinion on their fairness and compliance with accounting standards.' },
  { icon: 'heroicons:check-circle', title: 'Compliance Audit', description: 'Assessment of whether activities, financial transactions, and information comply with applicable laws and regulations.' },
  { icon: 'heroicons:flag', title: 'Performance Audit', description: 'Evaluation of whether programs and activities are achieving economy, efficiency, and effectiveness.' },
  { icon: 'heroicons:computer-desktop', title: 'IT Audit', description: 'Review of information technology systems, infrastructure, and controls for security and reliability.' },
  { icon: 'heroicons:wrench-screwdriver', title: 'Technical Audit', description: 'Specialized audit of engineering projects, infrastructure development, and technical systems.' },
  { icon: 'heroicons:clipboard-document-list', title: 'Follow-up Review', description: 'Assessment of actions taken by entities in response to previous audit recommendations.' }
]

// Universe statistics (admin-managed via /admin/site-stats)
const { stats: universeStats } = useSiteStats('about_service')

// Entity categories
const entityCategories = [
  { title: 'Central Government', entities: ['Ministries', 'Departments', 'Agencies', 'Commissions', 'Secretariats'] },
  { title: 'Local Government', entities: ['Metropolitan Assemblies', 'Municipal Assemblies', 'District Assemblies', 'Regional Coordinating Councils'] },
  { title: 'Public Enterprises', entities: ['State-Owned Enterprises', 'Public Boards', 'Statutory Corporations', 'Joint Venture Companies'] },
  { title: 'Special Funds', entities: ['Consolidated Fund', 'Contingency Fund', 'District Assemblies Common Fund', 'Ghana Education Trust Fund'] }
]

// Independence points
const independencePoints = [
  { icon: 'heroicons:shield-check', title: 'Constitutional Protection', description: 'Independence guaranteed under Articles 187-189' },
  { icon: 'heroicons:chart-bar', title: 'Direct Reporting', description: 'Reports directly to Parliament, not the Executive' },
  { icon: 'heroicons:currency-dollar', title: 'Financial Autonomy', description: 'Budget charged directly to the Consolidated Fund' }
]

// Strategic objectives
const strategicObjectives = [
  'Enhancing audit quality and impact',
  'Strengthening institutional capacity',
  'Improving stakeholder engagement',
  'Leveraging technology for efficient auditing',
  'Promoting transparency and good governance'
]
</script>

<style scoped>
/* Timeline - needs scoped styles for positioning */
.timeline {
  @apply relative max-w-[900px] mx-auto;
}

.timeline::before {
  content: '';
  @apply absolute w-1 h-full bg-primary;
  left: 50%;
  transform: translateX(-50%);
}

.timeline-item {
  @apply flex justify-start py-6 relative;
}

.timeline-item-right {
  @apply justify-end;
}

.timeline-marker {
  @apply absolute z-10;
  left: 50%;
  transform: translateX(-50%);
}

.timeline-year {
  @apply flex items-center justify-center w-[70px] h-[70px] bg-primary text-white rounded-full font-bold text-sm;
}

.timeline-content {
  @apply w-[calc(50%-60px)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6;
}

.timeline-item-right .timeline-content {
  @apply ml-auto;
}

@media (max-width: 767px) {
  .timeline::before {
    left: 35px;
  }

  .timeline-marker {
    left: 35px;
  }

  .timeline-year {
    @apply w-[50px] h-[50px] text-xs;
  }

  .timeline-content {
    width: calc(100% - 80px);
    margin-left: auto !important;
  }
}
</style>
