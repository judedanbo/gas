<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">
          CitizensEye
        </h1>
        <p class="page-subtitle">
          Citizen Engagement Platform for Public Accountability
        </p>
      </div>
    </div>

    <!-- Breadcrumb -->
    <CommonBreadcrumb :crumbs="[{ label: 'CitizensEye', path: '/citizenseye' }]" />

    <!-- Hero Section -->
    <section class="section bg-white">
      <div class="container">
        <div class="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
          <div>
            <h2 class="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-6">
              Be Part of the Fight Against Financial Irregularities
            </h2>
            <p class="text-lg text-gray-600 mb-6">
              CitizensEye is the Ghana Audit Service's citizen engagement platform that empowers you to report financial irregularities, mismanagement of public funds, and other concerns affecting public accountability.
            </p>
            <p class="text-gray-600 mb-8">
              Your voice matters in protecting Ghana's public resources. With CitizensEye, you can securely submit reports, upload evidence, and track the progress of your submissions - all while maintaining your anonymity if you choose.
            </p>
            <div class="flex flex-wrap gap-4">
              <a
                :href="appUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-primary inline-flex items-center gap-2"
              >
                Launch CitizensEye App
                <span aria-hidden="true">→</span>
              </a>
              <a
                href="#features"
                class="btn-outline"
              >
                Learn More
              </a>
            </div>
          </div>
          <div class="mt-10 lg:mt-0">
            <div class="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-8 text-center">
              <Icon name="heroicons:eye" class="w-20 h-20 text-primary mb-4 mx-auto" aria-hidden="true" />
              <p class="text-xl font-semibold text-gray-900 mb-2">CitizensEye</p>
              <p class="text-gray-600">Protecting the Public Purse</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="section bg-gray-50">
      <div class="container">
        <UiSectionHeader
          badge="Features"
          title="What You Can Do with CitizensEye"
          description="Our platform provides powerful tools for citizen engagement and public accountability."
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow"
          >
            <Icon :name="feature.icon" class="w-10 h-10 text-primary mb-4" aria-hidden="true" />
            <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ feature.title }}</h3>
            <p class="text-gray-600">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section class="section bg-white">
      <div class="container">
        <UiSectionHeader
          badge="Process"
          title="How CitizensEye Works"
          description="Submitting a report is simple and secure. Follow these three easy steps."
        />

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10">
          <div
            v-for="(step, index) in steps"
            :key="step.title"
            class="text-center"
          >
            <div class="w-16 h-16 mx-auto mb-4 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
              {{ index + 1 }}
            </div>
            <Icon :name="step.icon" class="w-10 h-10 text-primary mb-4 mx-auto" aria-hidden="true" />
            <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ step.title }}</h3>
            <p class="text-gray-600">{{ step.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Benefits Section -->
    <section class="section bg-gray-50">
      <div class="container">
        <UiSectionHeader
          badge="Benefits"
          title="Why Use CitizensEye?"
          description="Our platform benefits both citizens and government in promoting accountability."
        />

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          <!-- For Citizens -->
          <div class="bg-white rounded-xl p-8 border border-gray-200">
            <div class="flex items-center gap-3 mb-6">
              <Icon name="heroicons:user-group" class="w-8 h-8 text-primary" aria-hidden="true" />
              <h3 class="text-xl font-semibold text-gray-900">For Citizens</h3>
            </div>
            <ul class="space-y-4">
              <li v-for="benefit in citizenBenefits" :key="benefit" class="flex items-start gap-3">
                <Icon name="heroicons:check" class="w-5 h-5 text-primary flex-shrink-0 mt-1" aria-hidden="true" />
                <span class="text-gray-600">{{ benefit }}</span>
              </li>
            </ul>
          </div>

          <!-- For Government -->
          <div class="bg-white rounded-xl p-8 border border-gray-200">
            <div class="flex items-center gap-3 mb-6">
              <Icon name="heroicons:building-library" class="w-8 h-8 text-primary" aria-hidden="true" />
              <h3 class="text-xl font-semibold text-gray-900">For Government</h3>
            </div>
            <ul class="space-y-4">
              <li v-for="benefit in governmentBenefits" :key="benefit" class="flex items-start gap-3">
                <Icon name="heroicons:check" class="w-5 h-5 text-primary flex-shrink-0 mt-1" aria-hidden="true" />
                <span class="text-gray-600">{{ benefit }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- What to Report Section -->
    <section class="section bg-white">
      <div class="container">
        <UiSectionHeader
          badge="Guidelines"
          title="What Can You Report?"
          description="CitizensEye accepts reports on various financial and administrative irregularities."
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          <div
            v-for="item in reportableItems"
            :key="item.title"
            class="bg-gray-50 rounded-lg p-5 border border-gray-200"
          >
            <Icon :name="item.icon" class="w-6 h-6 text-primary mb-2" aria-hidden="true" />
            <h4 class="font-medium text-gray-900">{{ item.title }}</h4>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="section bg-gray-50">
      <div class="container">
        <UiSectionHeader
          badge="FAQ"
          title="Frequently Asked Questions"
          description="Find answers to common questions about CitizensEye."
        />

        <div class="max-w-3xl mx-auto mt-10 space-y-4">
          <UiAccordionItem
            v-for="(faq, index) in faqs"
            :key="index"
            :title="faq.question"
            variant="card"
          >
            <p class="text-gray-600">{{ faq.answer }}</p>
          </UiAccordionItem>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="section bg-primary text-white">
      <div class="container text-center">
        <h2 class="text-3xl md:text-4xl font-heading font-bold mb-4">
          Ready to Make a Difference?
        </h2>
        <p class="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          Join thousands of Ghanaians who are helping to protect public resources. Your report could make a real difference.
        </p>
        <div class="flex flex-wrap justify-center gap-4">
          <a
            :href="appUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Launch CitizensEye App
            <span aria-hidden="true">→</span>
          </a>
          <NuxtLink
            to="/citizenseye/privacy"
            class="inline-flex items-center gap-2 px-6 py-3 bg-transparent text-white border-2 border-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            Privacy Notice
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Quick Links -->
    <section class="section-sm bg-gray-50">
      <div class="container flex flex-wrap justify-center gap-4">
        <NuxtLink to="/citizenseye/privacy" class="btn-outline">
          Privacy Notice
        </NuxtLink>
        <NuxtLink to="/contact" class="btn-outline">
          Contact Us
        </NuxtLink>
        <NuxtLink to="/about" class="btn-outline">
          About GAS
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// SEO
useSeoMeta({
  title: 'CitizensEye - Citizen Engagement Platform | Ghana Audit Service',
  description: 'CitizensEye is the Ghana Audit Service citizen engagement platform for reporting financial irregularities and promoting public accountability.'
})

// External app URL
const appUrl = 'https://www.appsheet.com/start/5b1b9364-12e7-4613-a082-26cebb71f29f'

// Features
const features = [
  {
    icon: 'heroicons:pencil-square',
    title: 'Report Irregularities',
    description: 'Submit detailed reports about financial misconduct, fraud, or misuse of public funds you have witnessed or are aware of.'
  },
  {
    icon: 'heroicons:chart-bar',
    title: 'Track Your Reports',
    description: 'Monitor the status of your submissions and receive updates as they are reviewed and acted upon.'
  },
  {
    icon: 'heroicons:lock-closed',
    title: 'Anonymous Reporting',
    description: 'Choose to remain anonymous when submitting sensitive reports. Your identity is protected.'
  },
  {
    icon: 'heroicons:paper-clip',
    title: 'Upload Evidence',
    description: 'Attach documents, photos, or other evidence to support your report and help investigators.'
  },
  {
    icon: 'heroicons:map-pin',
    title: 'Location Tagging',
    description: 'Tag the location of incidents to help auditors identify and investigate specific areas.'
  },
  {
    icon: 'heroicons:bell',
    title: 'Real-time Updates',
    description: 'Receive notifications about the progress of your report and any actions taken.'
  }
]

// Steps
const steps = [
  {
    icon: 'heroicons:device-phone-mobile',
    title: 'Access the App',
    description: 'Click the "Launch CitizensEye App" button to open the platform in your browser. No download required.'
  },
  {
    icon: 'heroicons:pencil',
    title: 'Submit Your Report',
    description: 'Fill out the report form with details about the irregularity. Add evidence and location if available.'
  },
  {
    icon: 'heroicons:eye',
    title: 'Track Progress',
    description: 'Use your report reference number to track the status of your submission and any actions taken.'
  }
]

// Benefits for citizens
const citizenBenefits = [
  'Safe and secure platform for reporting concerns',
  'Option to remain anonymous for sensitive reports',
  'Easy-to-use interface accessible from any device',
  'Track the progress of your submissions',
  'Contribute to national accountability efforts',
  'Make your voice heard in protecting public resources'
]

// Benefits for government
const governmentBenefits = [
  'Direct channel for citizen feedback and reports',
  'Early detection of financial irregularities',
  'Evidence-based audit planning and prioritization',
  'Enhanced public trust through transparency',
  'Improved accountability in public institutions',
  'Support for anti-corruption initiatives'
]

// Reportable items
const reportableItems = [
  { icon: 'heroicons:currency-dollar', title: 'Financial Fraud' },
  { icon: 'heroicons:clipboard-document-list', title: 'Procurement Irregularities' },
  { icon: 'heroicons:user', title: 'Ghost Workers' },
  { icon: 'heroicons:building-office', title: 'Abandoned Projects' },
  { icon: 'heroicons:chart-bar', title: 'Misuse of Public Funds' },
  { icon: 'heroicons:pencil-square', title: 'Contract Violations' },
  { icon: 'heroicons:user-group', title: 'Conflict of Interest' },
  { icon: 'heroicons:exclamation-triangle', title: 'Other Irregularities' }
]

// FAQs
const faqs = [
  {
    question: 'What is CitizensEye?',
    answer: 'CitizensEye is a citizen engagement platform developed by the Ghana Audit Service that allows members of the public to report financial irregularities, fraud, and misuse of public funds. It serves as a direct channel for citizens to contribute to public accountability efforts in Ghana.'
  },
  {
    question: 'How do I submit a report?',
    answer: 'To submit a report, click the "Launch CitizensEye App" button, which will open the platform in your browser. Follow the on-screen instructions to fill out the report form with details about the irregularity you wish to report. You can attach evidence and tag locations to support your submission.'
  },
  {
    question: 'Is my identity protected?',
    answer: 'Yes, CitizensEye offers anonymous reporting options. You can choose not to provide your personal information when submitting a report. Even if you do provide contact details, your identity is kept confidential and protected in accordance with our privacy policy.'
  },
  {
    question: 'What happens after I submit a report?',
    answer: 'After submission, your report is reviewed by our team and assigned to the appropriate audit unit for investigation. You will receive a reference number to track your report\'s progress. Depending on the nature of the report, it may be included in scheduled audits or trigger a special investigation.'
  },
  {
    question: 'What types of issues can I report?',
    answer: 'You can report various financial and administrative irregularities including: financial fraud, procurement irregularities, ghost workers, abandoned projects, misuse of public funds, contract violations, conflicts of interest, and other concerns affecting public accountability.'
  },
  {
    question: 'How do I track my report?',
    answer: 'When you submit a report, you receive a unique reference number. You can use this number in the CitizensEye app to check the status of your report, view any updates, and see what actions have been taken. If you provided contact information, you may also receive email or SMS updates.'
  }
]
</script>
