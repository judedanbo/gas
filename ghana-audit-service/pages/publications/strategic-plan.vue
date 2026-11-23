<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Publications', path: '/publications' },
        { label: 'Strategic Plan', path: '/publications/strategic-plan' }
      ]"
    />

    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Strategic Plan 2026-2030</h1>
        <p class="page-subtitle">
          The Ghana Audit Service's five-year plan for a modern, technology-enabled audit
          institution that promotes good governance and accountability.
        </p>
      </div>
    </div>

    <!-- Plan Overview -->
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
                  The Strategic Plan 2026-2030 marks a decisive shift towards a more modern,
                  technology-driven and resilient Audit Service. It sets out four strategic goals,
                  tracked through 31 performance indicators, to deliver high-quality and timely
                  audits, make sure audit recommendations are acted upon, and keep citizens informed
                  about the audit mandate and its outcomes.
                </p>

                <p>
                  The Plan builds on the 2020-2024 strategic cycle, in which all four goals were
                  achieved and the Service audited 90.59% of the entities planned for 2024 (6,181
                  out of 6,823). It draws on the 2022 Supreme Audit Institutions Performance
                  Measurement Framework (SAI PMF) assessment and a survey of internal and external
                  stakeholders, and it aligns with the governance pillar of the National Medium-Term
                  Development Framework (2026-2029) and the Partnerships for Sustainable Development
                  (P4SD) project.
                </p>

                <p>
                  Digital transformation runs through the Plan: fully adopting electronic working
                  papers, expanding the Audit Management Information System (AMIS) and
                  Computer-Assisted Audit Techniques (CAATs), and introducing an Audit
                  Recommendations Tracker (E-Tracker) that the public can access on this website.
                </p>

                <h3>Mission</h3>
                <p>
                  We promote good governance, transparency, accountability and probity in Ghana's
                  public financial management system by auditing to recognised international
                  standards and reporting our audit results and recommendations to Parliament.
                </p>

                <h3>Vision</h3>
                <p>
                  To become a world-class Supreme Audit Institution delivering professional,
                  excellent and cost-effective auditing services.
                </p>

                <h3>Philosophy</h3>
                <p>
                  <strong>Leading by example to guard the national purse.</strong> A transparent and
                  accountable public financial management system is the bedrock of national
                  development. The Service does not merely find fault; it acts as a catalyst for
                  institutional improvement, so that every cedi spent by the state delivers maximum
                  value to Ghanaians.
                </p>
              </div>
            </div>

            <!-- Strategic Goals -->
            <div
              class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 mt-8"
            >
              <h2 class="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">
                Strategic Goals
              </h2>

              <div class="space-y-8">
                <div v-for="(goal, index) in strategicGoals" :key="goal.title" class="flex gap-4">
                  <div
                    class="flex-shrink-0 w-12 h-12 bg-primary text-white rounded-lg flex items-center justify-center font-bold text-lg"
                    aria-hidden="true"
                  >
                    {{ index + 1 }}
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      <span class="sr-only">Goal {{ index + 1 }}: </span>{{ goal.title }}
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-3">
                      {{ goal.description }}
                    </p>
                    <ul
                      class="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-400 marker:text-primary dark:marker:text-primary-200"
                    >
                      <li v-for="objective in goal.objectives" :key="objective">
                        {{ objective }}
                      </li>
                    </ul>
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
                  name="heroicons:flag"
                  class="w-12 h-12 text-primary dark:text-primary-200 mb-4 mx-auto"
                  aria-hidden="true"
                />
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                  Strategic Plan Document
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  2026-2030 · Promoting Good Governance &amp; Accountability
                </p>
              </div>

              <a :href="documentUrl" class="btn-primary w-full justify-center mb-4" download>
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download Full Plan
                <span class="sr-only">(PDF, 2.9 MB)</span>
              </a>

              <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Document Details
                </h3>
                <dl class="space-y-2 text-sm">
                  <div
                    v-for="detail in documentDetails"
                    :key="detail.label"
                    class="flex justify-between gap-4"
                  >
                    <dt class="text-gray-500 dark:text-gray-400">{{ detail.label }}:</dt>
                    <dd class="text-gray-900 dark:text-white text-right">{{ detail.value }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Key Targets -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Key Targets"
          description="Milestones the Plan commits the Service to reaching by 2030"
          size="sm"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="target in keyTargets"
            :key="target.title"
            class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div
              :class="`w-12 h-12 ${target.bgColor} rounded-lg flex items-center justify-center mb-4`"
            >
              <Icon
                :name="target.icon"
                class="w-6 h-6 text-gray-700 dark:text-gray-300"
                aria-hidden="true"
              />
            </div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {{ target.title }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ target.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Core Values -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Core Values"
          description="The standards by which we conduct ourselves and our work"
          size="sm"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="value in coreValues"
            :key="value.title"
            class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center gap-3 mb-3">
              <Icon
                :name="value.icon"
                class="w-6 h-6 flex-shrink-0 text-primary dark:text-primary-200"
                aria-hidden="true"
              />
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ value.title }}
              </h3>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ value.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Monitoring and Evaluation -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Monitoring and Evaluation"
          description="How the Service will keep the Plan on track and report on progress"
          size="sm"
        />

        <div class="max-w-3xl mx-auto">
          <UiCheckList :items="monitoringMeasures" icon="check" divided />
        </div>
      </div>
    </section>

    <!-- Back to Publications -->
    <section class="section bg-white dark:bg-gray-800">
      <div class="container text-center">
        <NuxtLink to="/publications" class="btn-outline">
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
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
    title: 'Strategic Plan 2026-2030',
    description:
      "The Ghana Audit Service's Strategic Plan 2026-2030: four strategic goals for audit quality, auditee accountability, public awareness and ESG, with targets to 2030."
  })

  const documentUrl = '/uploads/publications/gas-strategic-plan-2026-2030.pdf'

  const documentDetails = [
    { label: 'Period', value: '2026-2030' },
    { label: 'Strategic goals', value: '4' },
    { label: 'Indicators', value: '31' },
    { label: 'Mid-term review', value: 'End of 2028' },
    { label: 'Length', value: '54 pages' },
    { label: 'Format', value: 'PDF (2.9 MB)' }
  ]

  const strategicGoals = [
    {
      title: 'Demonstrating value to stakeholders through enhanced audit quality and efficiency',
      description:
        'Responds to recurring financial irregularities, weak compliance and concerns about value for money by prioritising timely, high-quality audits and stronger specialised audit capacity.',
      objectives: [
        'Secure the regular and timely release of approved budgetary allocations.',
        'Build specialised competencies in quality assurance, information systems, compliance and forensic audits.',
        'Use the Audit Management Information System (AMIS) to execute audit assignments.',
        'Train staff on the new Financial, Compliance and Performance Audit Manuals.',
        'Build a professional and motivated workforce of at least 800 professional staff.',
        'Intensify quality assurance reviews for priority audits.'
      ]
    },
    {
      title: 'Enhanced accountability of audited entities',
      description:
        'Shifts the focus from audit production to audit impact, closing the gap between audit findings and corrective action by auditees.',
      objectives: [
        'Enforce surcharge powers, supported by a surcharge tracking and monitoring system.',
        'Strengthen coordination with the Internal Audit Agency on implementing audit recommendations.',
        'Work with the Public Accounts Committee to track recommendations through the E-Tracker.',
        'Achieve at least 75% of annual audit and non-audit targets while increasing audits from 6,823 to 7,391 a year.'
      ]
    },
    {
      title: 'Improved public awareness of the audit mandate and outcomes',
      description:
        "Answers citizens' demand for transparency, timely information and meaningful engagement in the audit process.",
      objectives: [
        'Use technology such as the CitizensEye app to communicate with the public and gather feedback.',
        'Publish audit findings, recommendations and follow-ups on the E-Tracker, accessible on the Audit Service website.'
      ]
    },
    {
      title: 'Integrating Environmental, Social and Governance (ESG) principles in our operations',
      description:
        'Embeds responsible resource use, staff welfare and ethical conduct in how the Service itself is run.',
      objectives: [
        'Environmental: paperless auditing and correspondence, energy efficiency and sustainable resource management.',
        'Social: gender equality, diversity, inclusion and staff well-being, with a Gender Equality and Inclusion Action Plan by 2028.',
        'Governance: stronger ethical governance, accountability and transparency in institutional operations.',
        'Establish an ESG performance monitoring and reporting framework.'
      ]
    }
  ]

  const keyTargets = [
    {
      icon: 'heroicons:clipboard-document-check',
      title: '7,391 audits a year',
      description:
        'Planned audits each year from 2026 to 2030, up from 6,823, across MDAs, assemblies, educational institutions, public boards and missions abroad.',
      bgColor: 'bg-primary/10'
    },
    {
      icon: 'heroicons:academic-cap',
      title: '800 professional staff',
      description:
        'Professionally qualified staff in post by 2030, up from 644 in 2025, alongside a move from a 7:3 to a 6:4 male-female ratio.',
      bgColor: 'bg-secondary/10'
    },
    {
      icon: 'heroicons:computer-desktop',
      title: '80% of audits on AMIS',
      description:
        'Share of audits executed on the Audit Management Information System by 2030, following a pilot in 2026-2027.',
      bgColor: 'bg-accent/20'
    },
    {
      icon: 'heroicons:magnifying-glass-circle',
      title: '100% on the E-Tracker',
      description:
        'Audit findings and recommendations uploaded to the public Audit Recommendations Tracker by 2030.',
      bgColor: 'bg-info/10'
    },
    {
      icon: 'heroicons:shield-check',
      title: '90% quality-reviewed',
      description:
        'Priority audits subjected to quality assurance review by 2030, rising from 50% in 2026.',
      bgColor: 'bg-primary/10'
    },
    {
      icon: 'heroicons:scale',
      title: '40 surcharge certificates',
      description: 'Surcharge certificates issued and enforced a year by 2030, up from 10 in 2025.',
      bgColor: 'bg-secondary/10'
    },
    {
      icon: 'heroicons:chat-bubble-left-right',
      title: '95% of feedback answered',
      description:
        "Public feedback acknowledged, referred or responded to within the Service's approved timeframe by 2030.",
      bgColor: 'bg-accent/20'
    },
    {
      icon: 'heroicons:document-minus',
      title: '50% less paper',
      description:
        'Reduction in paper and stationery consumption by 2030, with electricity consumption down 20%.',
      bgColor: 'bg-info/10'
    }
  ]

  const coreValues = [
    {
      icon: 'heroicons:scale',
      title: 'Integrity',
      description:
        'We act with honesty, reliability and good faith, making decisions solely in the public interest.'
    },
    {
      icon: 'heroicons:building-library',
      title: 'Independence and Objectivity',
      description:
        'We remain free from external influence and base our findings strictly on evidence and impartial analysis.'
    },
    {
      icon: 'heroicons:trophy',
      title: 'Professionalism and Excellence',
      description:
        'We maintain the competence and skills to deliver world-class audit services and apply due care in every assignment.'
    },
    {
      icon: 'heroicons:lock-closed',
      title: 'Confidentiality',
      description:
        'We protect the information obtained during our audits, balancing this with our duty of transparency.'
    },
    {
      icon: 'heroicons:eye',
      title: 'Accountability and Transparency',
      description:
        'We lead by example and are transparent about our own performance, use of resources and results.'
    },
    {
      icon: 'heroicons:user-group',
      title: 'Inclusivity and Respect',
      description:
        'We value the diversity of our workforce and stakeholders and are committed to gender mainstreaming.'
    }
  ]

  const monitoringMeasures = [
    'Annual Operational Plans translate the strategic goals into yearly targets for each department.',
    'Departmental and regional heads submit quarterly progress reports to Management and the Planning, Research, Monitoring and Evaluation (PRME) Unit.',
    'The Quality Assurance Unit leads implementation of a Quality Management System under ISSAI 140 (revised).',
    'The Internal Audit Unit provides independent assurance on risk management and controls.',
    'A mid-term review at the end of 2028 assesses whether the goals remain relevant and the 2030 targets are on track.',
    'An annual performance report is submitted to the President and Parliament.',
    'A SAI PMF assessment benchmarks the Service against international standards and informs the 2031-2035 Strategic Plan.'
  ]
</script>
