<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">CitizensEye Privacy Notice</h1>
        <p class="page-subtitle">How we collect, use, and protect your information</p>
      </div>
    </div>

    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'CitizensEye', path: '/citizenseye' },
        { label: 'Privacy Notice', path: '/citizenseye/privacy' }
      ]"
    />

    <!-- Main Content -->
    <section class="section bg-white">
      <div class="container">
        <div class="max-w-4xl mx-auto prose prose-lg">
          <!-- Last Updated -->
          <p class="text-sm text-gray-500 mb-8">Last Updated: December 2025</p>

          <!-- Introduction -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">1. Introduction</h2>
            <p class="text-gray-600 mb-4">
              The Ghana Audit Service ("we," "our," or "us") is committed to protecting your privacy
              when you use the CitizensEye platform. This Privacy Notice explains how we collect,
              use, disclose, and safeguard your information when you use our citizen engagement
              application.
            </p>
            <p class="text-gray-600">
              By using CitizensEye, you consent to the data practices described in this notice. We
              encourage you to read this document carefully to understand our practices regarding
              your personal data.
            </p>
          </div>

          <!-- Information We Collect -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">
              2. Information We Collect
            </h2>

            <h3 class="text-lg font-semibold text-gray-900 mt-6 mb-3">Information You Provide</h3>
            <p class="text-gray-600 mb-4">When you use CitizensEye, you may choose to provide:</p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li>
                Contact information (name, email, phone number) - optional for anonymous reports
              </li>
              <li>Report details including descriptions of irregularities</li>
              <li>Supporting documents, photos, or other evidence</li>
              <li>Location information related to reported incidents</li>
              <li>Organization or institution names mentioned in reports</li>
            </ul>

            <h3 class="text-lg font-semibold text-gray-900 mt-6 mb-3">
              Automatically Collected Information
            </h3>
            <p class="text-gray-600 mb-4">We may automatically collect:</p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2">
              <li>Device information (type, operating system, browser)</li>
              <li>IP address and approximate location</li>
              <li>Usage data (pages visited, time spent, features used)</li>
              <li>Date and time of access</li>
            </ul>
          </div>

          <!-- How We Use Your Information -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">
              3. How We Use Your Information
            </h2>
            <p class="text-gray-600 mb-4">We use the information collected to:</p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2">
              <li>Process and investigate submitted reports</li>
              <li>Communicate with you about your submissions (if contact provided)</li>
              <li>Plan and prioritize audit activities</li>
              <li>Improve our services and user experience</li>
              <li>Generate anonymized statistics for public accountability reporting</li>
              <li>Comply with legal obligations and government directives</li>
              <li>Protect the integrity of the audit process</li>
            </ul>
          </div>

          <!-- Data Protection -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">4. Data Protection</h2>
            <p class="text-gray-600 mb-4">
              We implement appropriate technical and organizational measures to protect your
              personal information, including:
            </p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Access controls limiting data access to authorized personnel</li>
              <li>Regular security assessments and audits</li>
              <li>Secure data storage in compliance with government standards</li>
              <li>Staff training on data protection and confidentiality</li>
            </ul>
          </div>

          <!-- Anonymous Reporting -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">
              5. Anonymous Reporting
            </h2>
            <p class="text-gray-600 mb-4">
              CitizensEye supports anonymous reporting. If you choose to submit a report
              anonymously:
            </p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2">
              <li>You are not required to provide any personal identification</li>
              <li>Your IP address is anonymized in our records</li>
              <li>We will not attempt to identify you unless required by law</li>
              <li>You can still track your report using the reference number provided</li>
            </ul>
            <p class="text-gray-600 mt-4">
              <strong>Note:</strong> Providing contact information may help us follow up for
              additional details, but it is entirely voluntary.
            </p>
          </div>

          <!-- Data Sharing -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">6. Data Sharing</h2>
            <p class="text-gray-600 mb-4">We may share information with:</p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li>
                <strong>Internal Teams:</strong> Audit units and investigators handling your report
              </li>
              <li>
                <strong>Law Enforcement:</strong> When required by law or to prevent serious harm
              </li>
              <li>
                <strong>Other Government Agencies:</strong> When reports fall within their mandate
              </li>
              <li>
                <strong>Service Providers:</strong> Third parties who assist in platform operation
                (under strict confidentiality)
              </li>
            </ul>
            <p class="text-gray-600">
              We do not sell your personal information to third parties. Any sharing of personal
              data is done in accordance with applicable laws and this privacy notice.
            </p>
          </div>

          <!-- Data Retention -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">7. Data Retention</h2>
            <p class="text-gray-600 mb-4">
              We retain your information for as long as necessary to:
            </p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li>Complete the investigation of your report</li>
              <li>Comply with legal and regulatory requirements</li>
              <li>Support ongoing audit activities</li>
              <li>Maintain records as required by public records laws</li>
            </ul>
            <p class="text-gray-600">
              Generally, report data is retained for a minimum of 7 years in accordance with
              government records retention policies.
            </p>
          </div>

          <!-- Your Rights -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">8. Your Rights</h2>
            <p class="text-gray-600 mb-4">Subject to applicable law, you have the right to:</p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2">
              <li>Access information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal data (subject to legal constraints)</li>
              <li>Withdraw consent for processing (where consent was the basis)</li>
              <li>Lodge a complaint with relevant data protection authorities</li>
            </ul>
            <p class="text-gray-600 mt-4">
              To exercise these rights, please contact us using the information provided below.
            </p>
          </div>

          <!-- Cookies and Tracking -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">
              9. Cookies and Tracking
            </h2>
            <p class="text-gray-600 mb-4">
              CitizensEye may use cookies and similar technologies to:
            </p>
            <ul class="list-disc pl-6 text-gray-600 space-y-2">
              <li>Maintain session state and remember your preferences</li>
              <li>Analyze usage patterns to improve the platform</li>
              <li>Ensure security and prevent fraud</li>
            </ul>
            <p class="text-gray-600 mt-4">
              You can control cookies through your browser settings. However, disabling cookies may
              affect platform functionality.
            </p>
          </div>

          <!-- Changes to This Policy -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">
              10. Changes to This Policy
            </h2>
            <p class="text-gray-600">
              We may update this Privacy Notice from time to time. Any changes will be posted on
              this page with an updated revision date. We encourage you to review this notice
              periodically. Continued use of CitizensEye after changes constitutes acceptance of the
              updated notice.
            </p>
          </div>

          <!-- Contact Information -->
          <div class="mb-10">
            <h2 class="text-2xl font-heading font-bold text-gray-900 mb-4">
              11. Contact Information
            </h2>
            <p class="text-gray-600 mb-4">
              For questions about this Privacy Notice or to exercise your data rights, please
              contact:
            </p>
            <div class="bg-gray-50 rounded-lg p-6 not-prose">
              <p class="font-semibold text-gray-900 mb-2">Ghana Audit Service</p>
              <p class="text-gray-600 mb-1">Data Protection Officer</p>
              <p class="text-gray-600 mb-1">P.O. Box M96, Ministries Accra, Ghana</p>
              <p class="text-gray-600 mb-1">
                Email:
                <a href="mailto:info@audit.gov.gh" class="text-primary hover:underline"
                  >info@audit.gov.gh</a
                >
              </p>
              <p class="text-gray-600">Phone: +233 (302) 664929</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Links -->
    <section class="section-sm bg-gray-50">
      <div class="container flex flex-wrap justify-center gap-4">
        <NuxtLink to="/citizenseye" class="btn-outline"> Back to CitizensEye </NuxtLink>
        <NuxtLink to="/privacy-policy" class="btn-outline"> Main Privacy Policy </NuxtLink>
        <NuxtLink to="/contact" class="btn-outline"> Contact Us </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  // SEO
  useSeoMeta({
    title: 'CitizensEye Privacy Notice | Ghana Audit Service',
    description:
      'Learn how the Ghana Audit Service collects, uses, and protects your information when you use the CitizensEye citizen engagement platform.'
  })
</script>

<style scoped>
  .prose h2 {
    @apply border-b border-gray-200 pb-2;
  }
</style>
