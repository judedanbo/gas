<template>
  <div>
    <CommonBreadcrumb :crumbs="breadcrumbs" />

    <!-- Page Header -->
    <section class="page-header">
      <div class="container">
        <h1>Departmental Profile</h1>
        <p class="max-w-[600px] mx-auto text-lg text-white/90">
          Our specialized departments driving audit excellence across Ghana
        </p>
      </div>
    </section>

    <!-- Overview -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10 items-center">
          <div>
            <h2
              class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-4"
            >
              Our Organizational Structure
            </h2>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              The Audit Service is made up of six (6) departments. A Deputy Auditor-General (DAG)
              heads each department. Five departments focus on audit delivery across different
              sectors, while the Finance and Administration Department provides essential support
              services to audit staff across the country.
            </p>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              In addition, several specialized units operate directly under the
              Auditor-General's Office, providing legal, public affairs, parliamentary liaison,
              internal audit, and quality assurance services.
            </p>
          </div>
          <UiStatGrid :stats="overviewStats" :columns="3" variant="card" />
        </div>
      </div>
    </section>

    <!-- Audit Departments -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Audit Departments"
          description="Specialized units conducting audits across all sectors of government"
        />
        <div class="flex flex-col gap-4">
          <UiAccordionItem
            v-for="dept in auditDepartments"
            :key="dept.name"
            :title="dept.name"
            :icon="dept.icon"
            :subtitle="`Under: ${dept.dag}`"
          >
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              {{ dept.description }}
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 class="text-sm text-primary dark:text-primary-light font-semibold mb-2">
                  Key Functions
                </h4>
                <UiCheckList :items="dept.functions" icon="bullet" spacing="sm" />
              </div>
              <div>
                <h4 class="text-sm text-primary dark:text-primary-light font-semibold mb-2">
                  Entities Audited
                </h4>
                <div class="flex flex-wrap gap-2">
                  <UiBadge
                    v-for="entity in dept.entities"
                    :key="entity"
                    variant="gray"
                    size="sm"
                    :uppercase="false"
                  >
                    {{ entity }}
                  </UiBadge>
                </div>
              </div>
            </div>
          </UiAccordionItem>
        </div>
      </div>
    </section>

    <!-- Finance & Administration Department -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Finance & Administration Department"
          description="Provides support services to all audit staff across the country through nine specialized units"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <UiInfoCard
            v-for="unit in financeAdminUnits"
            :key="unit.name"
            :icon="unit.icon"
            :title="unit.name"
            :description="unit.description"
            variant="horizontal"
            :bordered="true"
          />
        </div>
      </div>
    </section>

    <!-- Specialized Units -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Units Under the Auditor-General's Office"
          description="Specialized units reporting directly to the Auditor-General"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <UiInfoCard
            v-for="unit in specializedUnits"
            :key="unit.name"
            :icon="unit.icon"
            :title="unit.name"
            :description="unit.description"
            variant="horizontal"
            :bordered="true"
          />
        </div>
      </div>
    </section>

    <!-- Audit Methodology -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10">
          <div>
            <h2
              class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-4"
            >
              Our Audit Methodology
            </h2>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
              All departments follow standardized audit methodologies aligned with International
              Standards of Supreme Audit Institutions (ISSAI). Our approach ensures consistency,
              quality, and compliance across all audit engagements.
            </p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div v-for="step in methodologySteps" :key="step.number" class="text-center">
                <div
                  class="w-[50px] h-[50px] flex items-center justify-center bg-primary text-white rounded-full text-xl font-bold mx-auto mb-3"
                >
                  {{ step.number }}
                </div>
                <h4 class="text-base mb-1 font-semibold text-gray-900 dark:text-white">
                  {{ step.title }}
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 m-0">{{ step.description }}</p>
              </div>
            </div>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
            <h3 class="mb-2 font-semibold text-gray-900 dark:text-white">AMIS Audit Manuals</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Our audit methodology is documented in comprehensive manuals:
            </p>
            <div class="flex flex-col gap-3">
              <NuxtLink
                v-for="manual in auditManuals"
                :key="manual.name"
                to="/publications/amis-manuals"
                class="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-md no-underline text-gray-900 dark:text-white transition-all hover:bg-primary hover:text-white"
              >
                <Icon :name="manual.icon" class="w-5 h-5" aria-hidden="true" />
                <span>{{ manual.name }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Staff Statistics -->
    <section class="section bg-gradient-to-br from-primary to-primary-dark">
      <div class="container">
        <div class="text-center">
          <h2 class="text-2xl md:text-3xl font-heading font-bold text-white mb-4">Our Workforce</h2>
          <p class="text-white/90 max-w-[600px] mx-auto mb-10">
            The Ghana Audit Service employs qualified professionals across various disciplines to
            deliver high-quality audit services.
          </p>
          <UiStatGrid
            :stats="workforceStats"
            :columns="4"
            variant="transparent"
            class="max-w-[800px] mx-auto"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  useHead({ title: 'Departmental Profile' })

  useSeoMeta({
    title: 'Departmental Profile - Ghana Audit Service',
    description:
      'Explore the specialized departments of the Ghana Audit Service - our organizational structure, functions, and areas of expertise.',
    ogTitle: 'Departmental Profile - Ghana Audit Service',
    ogDescription: 'Our specialized departments driving audit excellence across Ghana.'
  })

  const breadcrumbs = [
    { label: 'About Us', path: '/about' },
    { label: 'Departmental Profile', path: '/about/departmental-profile' }
  ]

  const overviewStats = [
    { icon: 'heroicons:building-office', value: 6, label: 'Departments' },
    { icon: 'heroicons:user-group', value: 6, label: 'Deputy Auditors-General' },
    { icon: 'heroicons:clipboard-document-list', value: 5, label: "AG's Office Units" }
  ]

  const auditDepartments = [
    {
      name: 'Central Government Audit Department (CGAD)',
      icon: 'heroicons:building-library',
      dag: 'Deputy Auditor-General',
      description:
        'The CGAD has the primary responsibility for the audit of all the Ministries, Departments and Agencies (MDAs) of Central Government, including Ghana’s foreign missions abroad. The Service maintains offices in most MDAs in Accra, with regional and district-level audit operations.',
      functions: [
        'Financial audits of Ministries, Departments and Agencies',
        'Audit of Ghana’s foreign missions abroad',
        'Regional and district-level audit operations',
        'Compliance and internal control assessments'
      ],
      entities: ['Ministries', 'Departments', 'Agencies', 'Foreign Missions']
    },
    {
      name: 'Commercial Audit Department (CAD)',
      icon: 'heroicons:briefcase',
      dag: 'Deputy Auditor-General',
      description:
        'The CAD is responsible for the audit of Public Boards, Corporations, Bank of Ghana, tertiary and other Statutory Institutions.',
      functions: [
        'Public Boards and Corporations audits',
        'Bank of Ghana audits',
        'Tertiary institution audits',
        'Statutory institution audits'
      ],
      entities: [
        'Public Boards',
        'Corporations',
        'Bank of Ghana',
        'Statutory Institutions'
      ]
    },
    {
      name: 'Educational Institutions & District Assemblies – Southern Zone (EIDA-South)',
      icon: 'heroicons:academic-cap',
      dag: 'Deputy Auditor-General',
      description:
        'Responsible for the audit of Pre-Tertiary and Tertiary Institutions, as well as Metropolitan, Municipal and District Assemblies and Traditional Councils in the Southern Zone of Ghana.',
      functions: [
        'Pre-Tertiary institution audits',
        'Tertiary institution audits',
        'Metropolitan, Municipal and District Assembly audits',
        'Traditional Council audits'
      ],
      entities: [
        'Pre-Tertiary Institutions',
        'Tertiary Institutions',
        'MMDAs (Southern Zone)',
        'Traditional Councils'
      ]
    },
    {
      name: 'Educational Institutions & District Assemblies – Northern Zone (EIDA-North)',
      icon: 'heroicons:academic-cap',
      dag: 'Deputy Auditor-General',
      description:
        'Responsible for the audit of Pre-Tertiary and Tertiary Institutions, as well as Metropolitan, Municipal and District Assemblies and Traditional Councils in the Northern Zone of Ghana.',
      functions: [
        'Pre-Tertiary institution audits',
        'Tertiary institution audits',
        'Metropolitan, Municipal and District Assembly audits',
        'Traditional Council audits'
      ],
      entities: [
        'Pre-Tertiary Institutions',
        'Tertiary Institutions',
        'MMDAs (Northern Zone)',
        'Traditional Councils'
      ]
    },
    {
      name: 'Performance & Special Audits Department (PSAD)',
      icon: 'heroicons:chart-bar',
      dag: 'Deputy Auditor-General',
      description:
        'Section 13(e) of the Audit Service Act 2000 (Act 584) mandates the Auditor-General to audit programs and activities of public offices with due regard to economy, efficiency and effectiveness in the use of resources. The PSAD comprises three sections: Performance Audit, Special Funds Audit, and Information Technology Audit.',
      functions: [
        'Performance audits (economy, efficiency, effectiveness)',
        'Special Funds audits',
        'Information Technology audits',
        'Value-for-money assessments of government programs'
      ],
      entities: [
        'Government Programs',
        'Public Office Activities',
        'Special Funds',
        'IT Systems'
      ]
    }
  ]

  const financeAdminUnits = [
    {
      name: 'Accounts',
      icon: 'heroicons:calculator',
      description: 'Manages financial accounting and reporting for the Service.'
    },
    {
      name: 'Budget',
      icon: 'heroicons:chart-pie',
      description: 'Handles budget preparation, monitoring and expenditure control.'
    },
    {
      name: 'Payroll',
      icon: 'heroicons:banknotes',
      description: 'Processes staff compensation and related payments.'
    },
    {
      name: 'Human Resource',
      icon: 'heroicons:user-group',
      description: 'Manages recruitment, placement and staff welfare.'
    },
    {
      name: 'IT Technical',
      icon: 'heroicons:computer-desktop',
      description: 'Provides IT infrastructure and systems support.'
    },
    {
      name: 'Training & Human Resource Development',
      icon: 'heroicons:academic-cap',
      description: 'Coordinates professional development and capacity building.'
    },
    {
      name: 'Estates',
      icon: 'heroicons:building-office-2',
      description: 'Manages office facilities and property maintenance.'
    },
    {
      name: 'Procurement',
      icon: 'heroicons:shopping-cart',
      description: 'Handles purchasing and supply chain operations.'
    },
    {
      name: 'Transport',
      icon: 'heroicons:truck',
      description: 'Manages vehicle fleet and transportation logistics.'
    }
  ]

  const specializedUnits = [
    {
      name: 'Internal Audit',
      icon: 'heroicons:magnifying-glass',
      description: 'Conducts internal audits of the Ghana Audit Service itself.'
    },
    {
      name: 'Legal',
      icon: 'heroicons:scale',
      description: 'Provides legal advice and handles litigation matters for the Service.'
    },
    {
      name: 'Public Affairs',
      icon: 'heroicons:megaphone',
      description: 'Manages public relations, communications and stakeholder engagement.'
    },
    {
      name: 'Parliamentary',
      icon: 'heroicons:building-library',
      description:
        'Coordinates with Parliament on audit reports, PAC hearings and legislative matters.'
    },
    {
      name: 'Quality Assurance, Monitoring & Evaluation',
      icon: 'heroicons:clipboard-document-check',
      description: 'Ensures audit quality standards, monitors performance and evaluates outcomes.'
    }
  ]

  const methodologySteps = [
    { number: 1, title: 'Planning', description: 'Risk assessment and audit planning' },
    { number: 2, title: 'Execution', description: 'Fieldwork and evidence gathering' },
    { number: 3, title: 'Reporting', description: 'Findings and recommendations' },
    { number: 4, title: 'Follow-up', description: 'Implementation monitoring' }
  ]

  const auditManuals = [
    { icon: 'heroicons:document-duplicate', name: 'Financial Audit Manual' },
    { icon: 'heroicons:document-duplicate', name: 'Compliance Audit Manual' },
    { icon: 'heroicons:document-duplicate', name: 'Performance Audit Manual' },
    { icon: 'heroicons:document-duplicate', name: 'IT Audit Manual' }
  ]

  const workforceStats = [
    { value: 2295, label: 'Total Staff' },
    { value: 1800, label: 'Audit Staff', suffix: '+' },
    { value: 400, label: 'Professional Accountants', suffix: '+' },
    { value: 95, label: 'District Presence' }
  ]
</script>
