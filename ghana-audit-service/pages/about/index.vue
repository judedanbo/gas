<template>
  <div>
    <CommonBreadcrumb :crumbs="breadcrumbs" />

    <!-- Page Header -->
    <section class="page-header">
      <div class="container">
        <h1>About Ghana Audit Service</h1>
        <p class="max-w-[700px] mx-auto text-lg text-white/90 leading-relaxed">
          Ghana's Supreme Audit Institution, established by the Constitution to ensure
          accountability and transparency in the management of public resources.
        </p>
      </div>
    </section>

    <!-- Overview Section -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <h2 class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-4">Who We Are</h2>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              The Ghana Audit Service (GAS) is Ghana's Supreme Audit Institution (SAI),
              established under Article 187 of the 1992 Constitution. For over 115 years,
              we have been the guardians of the public purse, ensuring that public funds
              are used efficiently, effectively, and in accordance with the law.
            </p>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              As an independent constitutional body, we audit the accounts of all public
              offices including Ministries, Departments, Agencies, Metropolitan, Municipal
              and District Assemblies, public boards, corporations, and other public institutions.
            </p>
            <div class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <UiStatGrid
                :stats="overviewStats"
                :columns="4"
                variant="transparent"
              />
            </div>
          </div>
          <div class="flex justify-center">
            <div class="w-full max-w-[400px] aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-4">
              <Icon name="heroicons:building-library" class="w-16 h-16 text-primary dark:text-primary-light" aria-hidden="true" />
              <span class="text-gray-400 dark:text-gray-500 text-sm">GAS Headquarters</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Mission, Vision, Values -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Our Purpose"
          description="Guided by our commitment to public accountability"
        />
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UiInfoCard
            icon="heroicons:flag"
            title="Our Mission"
            description="To promote good governance, accountability and transparency in the management of public resources through quality auditing and reporting to Parliament."
            variant="centered"
          />
          <UiInfoCard
            icon="heroicons:eye"
            title="Our Vision"
            description="To be a world-class Supreme Audit Institution that contributes to improved public financial management for national development."
            variant="centered"
          />
          <UiInfoCard icon="heroicons:scale" title="Our Core Values" variant="centered">
            <UiCheckList
              :items="coreValues"
              icon="dot"
              divided
              spacing="sm"
            />
          </UiInfoCard>
        </div>
      </div>
    </section>

    <!-- Constitutional Mandate -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10">
          <div>
            <h2 class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-4">Constitutional Mandate</h2>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              Under Article 187 of the 1992 Constitution of Ghana, the Auditor-General
              is mandated to audit and report on the public accounts of Ghana and all
              public offices. This includes:
            </p>
            <UiCheckList
              :items="mandateItems"
              icon="check"
              divided
            />
          </div>
          <div>
            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
              <h4 class="mb-4 font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <Icon name="heroicons:document" class="w-5 h-5" aria-hidden="true" />
                Legal Framework
              </h4>
              <UiCheckList
                :items="legalFramework"
                icon="bullet"
                spacing="sm"
                icon-color="gray"
              />
              <UiViewAllLink
                to="/publications/applicable-laws"
                label="View All Applicable Laws"
                size="sm"
                class="mt-6"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- About Navigation Cards -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Learn More About Us"
          description="Explore our history, leadership, and organizational structure"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <UiInfoCard
            v-for="nav in aboutNavigation"
            :key="nav.title"
            :icon="nav.icon"
            :title="nav.title"
            :description="nav.description"
            :to="nav.to"
            hover
          />
        </div>
      </div>
    </section>

    <!-- International Affiliations -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="International Affiliations"
          description="We work with global organizations to uphold international auditing standards"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <UiInfoCard
            v-for="affiliation in affiliations"
            :key="affiliation.name"
            :icon="affiliation.icon"
            :title="affiliation.name"
            :description="affiliation.description"
            variant="centered"
            :bordered="false"
            class="bg-gray-100 dark:bg-gray-800"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Page meta
useHead({
  title: 'About Us'
})

useSeoMeta({
  title: 'About Ghana Audit Service',
  description: 'Learn about the Ghana Audit Service - Ghana\'s Supreme Audit Institution with over 115 years of service, ensuring accountability and transparency in public financial management.',
  ogTitle: 'About Ghana Audit Service',
  ogDescription: 'Ghana\'s Supreme Audit Institution ensuring accountability and transparency in public financial management.'
})

// Breadcrumbs
const breadcrumbs = [
  { label: 'About Us', path: '/about' }
]

// Overview statistics
const overviewStats = [
  { value: 115, label: 'Years of Service', suffix: '+' },
  { value: 2295, label: 'Staff Members' },
  { value: 16, label: 'Regions' },
  { value: 95, label: 'Districts' }
]

// Core values
const coreValues = ['Independence', 'Integrity', 'Professionalism', 'Excellence', 'Innovation']

// Constitutional mandate items
const mandateItems = [
  'Central government ministries, departments and agencies',
  'Regional coordinating councils',
  'Metropolitan, Municipal and District Assemblies',
  'Public boards, corporations, and other public institutions',
  'Bodies or organizations established by Act of Parliament',
  'Bodies receiving government subventions'
]

// Legal framework
const legalFramework = [
  '1992 Constitution of Ghana (Article 187-189)',
  'Audit Service Act, 2000 (Act 584)',
  'Public Financial Management Act, 2016 (Act 921)',
  'Internal Audit Agency Act, 2003 (Act 658)'
]

// About navigation
const aboutNavigation = [
  {
    icon: 'heroicons:book-open',
    title: 'The Service',
    description: 'Our history, evolution, and key milestones over 115 years',
    to: '/about/the-service'
  },
  {
    icon: 'heroicons:user',
    title: 'Past Auditors-General',
    description: 'The distinguished leaders who shaped our institution',
    to: '/about/past-auditors-general'
  },
  {
    icon: 'heroicons:user-group',
    title: 'Management Team',
    description: 'Meet our current leadership and organizational structure',
    to: '/about/management-team'
  },
  {
    icon: 'heroicons:building-office',
    title: 'Departmental Profile',
    description: 'Our departments, functions, and areas of specialization',
    to: '/about/departmental-profile'
  }
]

// International affiliations
const affiliations = [
  {
    name: 'INTOSAI',
    icon: 'heroicons:globe-americas',
    description: 'International Organization of Supreme Audit Institutions - the global umbrella organization for external government audit.'
  },
  {
    name: 'AFROSAI-E',
    icon: 'heroicons:globe-americas',
    description: 'African Organisation of Supreme Audit Institutions (English-speaking) - promoting cooperation among African SAIs.'
  },
  {
    name: 'ISSAI',
    icon: 'heroicons:clipboard-document-list',
    description: 'International Standards of Supreme Audit Institutions - the global auditing standards we adhere to.'
  },
  {
    name: 'INTOSAI-IDI',
    icon: 'heroicons:academic-cap',
    description: 'INTOSAI Development Initiative - supporting capacity development for supreme audit institutions.'
  }
]
</script>
