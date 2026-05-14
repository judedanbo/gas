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
              The Ghana Audit Service is organized into specialized departments, each designed to
              deliver high-quality audit services in specific sectors. This structure ensures
              comprehensive coverage of all public entities and enables deep expertise in various
              audit domains.
            </p>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Our departments work collaboratively under the leadership of the Auditor-General and
              Deputy Auditors-General to fulfill our constitutional mandate of auditing all public
              accounts.
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

    <!-- Support Departments -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Support Departments"
          description="Administrative and operational units enabling effective audit delivery"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <UiInfoCard
            v-for="dept in supportDepartments"
            :key="dept.name"
            :icon="dept.icon"
            :title="dept.name"
            :description="dept.description"
            variant="centered"
            :bordered="false"
            class="bg-gray-100 dark:bg-gray-800"
          >
            <UiCheckList :items="dept.functions" icon="dot" spacing="sm" icon-color="gray" />
          </UiInfoCard>
        </div>
      </div>
    </section>

    <!-- Specialized Units -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Specialized Units"
          description="Expert units providing specialized services and support"
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

  // Overview stats
  const overviewStats = [
    { icon: 'heroicons:building-office', value: 6, label: 'DAG Portfolios' },
    { icon: 'heroicons:chart-bar', value: 12, label: 'Audit Departments', suffix: '+' },
    { icon: 'heroicons:wrench-screwdriver', value: 8, label: 'Support Units', suffix: '+' }
  ]

  const auditDepartments = [
    {
      name: 'Central Government Audit',
      icon: 'heroicons:building-library',
      dag: 'DAG Central Government',
      description:
        'Responsible for auditing all central government ministries, departments, and agencies. This department ensures proper accountability in the management of the Consolidated Fund.',
      functions: [
        'Annual financial audits of MDAs',
        'Special audits and investigations',
        'Compliance with financial regulations',
        'Internal control assessments'
      ],
      entities: ['Ministries', 'Departments', 'Agencies', 'Commissions', 'Secretariats']
    },
    {
      name: 'Local Government Audit',
      icon: 'heroicons:building-office',
      dag: 'DAG Local Government',
      description:
        'Oversees the audit of all Metropolitan, Municipal, and District Assemblies, ensuring accountability in local governance and decentralized fund management.',
      functions: [
        'MMDA financial statement audits',
        'District Assemblies Common Fund audits',
        'IGF revenue and expenditure audits',
        'Local government compliance reviews'
      ],
      entities: [
        'Metropolitan Assemblies',
        'Municipal Assemblies',
        'District Assemblies',
        'Regional Coordinating Councils'
      ]
    },
    {
      name: 'Education Sector Audit',
      icon: 'heroicons:academic-cap',
      dag: 'DAG Education Sector',
      description:
        'Specialized department for auditing educational institutions at all levels, including universities, colleges, and the Ghana Education Trust Fund.',
      functions: [
        'University financial audits',
        'GETFund accountability audits',
        'Secondary education audits',
        'Scholarship secretariat audits'
      ],
      entities: [
        'Public Universities',
        'Polytechnics',
        'Colleges of Education',
        'GETFund',
        'Secondary Schools'
      ]
    },
    {
      name: 'Commercial Audit',
      icon: 'heroicons:briefcase',
      dag: 'DAG Commercial Audits',
      description:
        'Handles audits of state-owned enterprises, public corporations, and government joint venture companies.',
      functions: [
        'State-owned enterprise audits',
        'Public corporation audits',
        'Joint venture audits',
        'Regulatory body audits'
      ],
      entities: ['SOEs', 'Public Corporations', 'Joint Ventures', 'Regulatory Bodies']
    },
    {
      name: 'Performance Audit',
      icon: 'heroicons:chart-bar',
      dag: 'DAG Performance Audit',
      description:
        'Conducts value-for-money audits assessing economy, efficiency, and effectiveness of government programs and projects.',
      functions: [
        'Value-for-money assessments',
        'Program effectiveness evaluations',
        'Project implementation reviews',
        'Policy impact assessments'
      ],
      entities: [
        'Government Programs',
        'Capital Projects',
        'Social Interventions',
        'Infrastructure Projects'
      ]
    },
    {
      name: 'IT Audit',
      icon: 'heroicons:computer-desktop',
      dag: 'DAG Corporate Services',
      description:
        'Reviews information technology systems, cybersecurity controls, and digital transformation initiatives across government.',
      functions: [
        'IT systems audits',
        'Cybersecurity assessments',
        'Data integrity reviews',
        'IT governance evaluations'
      ],
      entities: [
        'Government IT Systems',
        'E-Government Platforms',
        'Digital Services',
        'Data Centers'
      ]
    },
    {
      name: 'Technical Audit',
      icon: 'heroicons:wrench-screwdriver',
      dag: 'DAG Central Government',
      description:
        'Specializes in auditing engineering projects, infrastructure development, and technical contracts.',
      functions: [
        'Infrastructure project audits',
        'Construction contract reviews',
        'Technical compliance assessments',
        'Project cost evaluations'
      ],
      entities: ['Road Projects', 'Building Projects', 'Water & Sanitation', 'Energy Projects']
    }
  ]

  const supportDepartments = [
    {
      name: 'Human Resource Management',
      icon: 'heroicons:user-group',
      description: 'Manages recruitment, training, performance, and welfare of staff.',
      functions: [
        'Staff recruitment and placement',
        'Training and development',
        'Performance management',
        'Employee welfare'
      ]
    },
    {
      name: 'Finance & Administration',
      icon: 'heroicons:currency-dollar',
      description: 'Handles financial management and administrative operations of the Service.',
      functions: [
        'Budget preparation and management',
        'Financial reporting',
        'Procurement',
        'Asset management'
      ]
    },
    {
      name: 'Planning & Quality Assurance',
      icon: 'heroicons:clipboard-document-list',
      description: 'Develops strategic plans and ensures quality in audit delivery.',
      functions: [
        'Strategic planning',
        'Audit quality reviews',
        'Standards compliance',
        'Performance monitoring'
      ]
    },
    {
      name: 'Information Technology',
      icon: 'heroicons:computer-desktop',
      description: 'Provides IT infrastructure and systems support for audit operations.',
      functions: [
        'IT infrastructure management',
        'AMIS administration',
        'Network and security',
        'Help desk support'
      ]
    }
  ]

  const specializedUnits = [
    {
      name: 'Legal Unit',
      icon: 'heroicons:scale',
      description: 'Provides legal advice and handles litigation matters.'
    },
    {
      name: 'Internal Audit Unit',
      icon: 'heroicons:magnifying-glass',
      description: 'Conducts internal audits of the Ghana Audit Service itself.'
    },
    {
      name: 'Public Affairs',
      icon: 'heroicons:megaphone',
      description: 'Manages public relations, communications, and stakeholder engagement.'
    },
    {
      name: 'Research & Development',
      icon: 'heroicons:chart-bar',
      description: 'Conducts research and develops audit methodologies and tools.'
    },
    {
      name: 'Training & Development',
      icon: 'heroicons:academic-cap',
      description: 'Coordinates professional development and capacity building.'
    },
    {
      name: 'International Relations',
      icon: 'heroicons:globe-americas',
      description: 'Manages relationships with international audit organizations.'
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
