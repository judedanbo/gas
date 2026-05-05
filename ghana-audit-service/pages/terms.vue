<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">
          Terms of Use
        </h1>
        <p class="page-subtitle">
          Terms and conditions governing the use of this website.
        </p>
      </div>
    </div>

    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Terms of Use', path: '/terms' }
      ]"
    />

    <!-- Content -->
    <section class="section">
      <div class="container">
        <div class="max-w-3xl mx-auto prose prose-lg dark:prose-invert">
          <p class="lead">
            Last updated: December 2024
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using the Ghana Audit Service website, you accept and agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use this website.
          </p>

          <h2>2. Use of Website</h2>
          <p>
            This website is provided by the Ghana Audit Service for informational purposes. You may use this website to:
          </p>
          <ul>
            <li>Access information about the Ghana Audit Service</li>
            <li>View and download audit reports and publications</li>
            <li>Learn about career opportunities</li>
            <li>Contact the Ghana Audit Service</li>
          </ul>

          <h2>3. Intellectual Property</h2>
          <p>
            All content on this website, including but not limited to text, graphics, logos, images, and documents, is the property of the Ghana Audit Service or its content suppliers and is protected by copyright laws.
          </p>
          <p>You may:</p>
          <ul>
            <li>Download or print content for personal, non-commercial use</li>
            <li>Share links to our content</li>
            <li>Use content for educational purposes with proper attribution</li>
          </ul>
          <p>You may not:</p>
          <ul>
            <li>Modify or alter any content without permission</li>
            <li>Use content for commercial purposes without authorization</li>
            <li>Remove any copyright or proprietary notices</li>
          </ul>

          <h2>4. Accuracy of Information</h2>
          <p>
            We strive to ensure that information on this website is accurate and up-to-date. However, we do not guarantee the completeness, reliability, or accuracy of the information. The official version of any document is the printed version published by the Ghana Audit Service.
          </p>

          <h2>5. External Links</h2>
          <p>
            This website may contain links to external websites. The Ghana Audit Service is not responsible for the content, accuracy, or privacy practices of linked sites. Links to external sites do not imply endorsement.
          </p>

          <h2>6. User Conduct</h2>
          <p>When using this website, you agree not to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Attempt to gain unauthorized access to any part of the website</li>
            <li>Transmit any viruses, malware, or harmful code</li>
            <li>Interfere with the proper functioning of the website</li>
            <li>Collect information about other users without consent</li>
            <li>Use the website for any fraudulent or unlawful purpose</li>
          </ul>

          <h2>7. Disclaimer of Warranties</h2>
          <p>
            This website is provided "as is" without warranties of any kind, either express or implied. The Ghana Audit Service does not warrant that the website will be uninterrupted, error-free, or free of viruses or other harmful components.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, the Ghana Audit Service shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from your use of this website.
          </p>

          <h2>9. Governing Law</h2>
          <p>
            These Terms of Use shall be governed by and construed in accordance with the laws of the Republic of Ghana. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Ghana.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            The Ghana Audit Service reserves the right to modify these Terms of Use at any time. Changes will be effective immediately upon posting to this website. Continued use of the website after changes constitutes acceptance of the modified terms.
          </p>

          <h2>11. Contact Information</h2>
          <p>
            If you have questions about these Terms of Use, please contact us:
          </p>
          <ul>
            <li>Email: <a href="mailto:info@audit.gov.gh">info@audit.gov.gh</a></li>
            <li>Phone: +233 (302) 664928/9</li>
            <li>Address: No. 12 Starlets 91 Road, Opposite African Union, Accra</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Terms of Use | Ghana Audit Service',
  description: 'Terms and conditions governing the use of the Ghana Audit Service website.'
})
</script>

<!-- Styles handled by @tailwindcss/typography plugin -->
