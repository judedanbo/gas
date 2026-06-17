<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">
          Privacy Policy
        </h1>
        <p class="page-subtitle">
          How we collect, use, and protect your personal information.
        </p>
      </div>
    </div>

    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Privacy Policy', path: '/privacy-policy' }
      ]"
    />

    <!-- Content -->
    <section class="section">
      <div class="container">
        <div class="max-w-3xl mx-auto prose prose-lg dark:prose-invert">
          <p class="lead">
            Last updated: December 2024
          </p>

          <h2>1. Introduction</h2>
          <p>
            The Ghana Audit Service ("GAS", "we", "our", or "us") is committed to protecting the privacy of visitors to our website. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>Information You Provide</h3>
          <p>We may collect information that you voluntarily provide when you:</p>
          <ul>
            <li>Fill out contact forms</li>
            <li>Subscribe to newsletters</li>
            <li>Submit job applications</li>
            <li>Request information about our services</li>
          </ul>
          <p>This information may include your name, email address, phone number, and any other information you choose to provide.</p>

          <h3>Automatically Collected Information</h3>
          <p>When you visit our website, we may automatically collect certain information about your device, including:</p>
          <ul>
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Operating system</li>
            <li>Referring website</li>
            <li>Pages viewed and time spent on pages</li>
          </ul>
          <p>
            We retain your IP address for up to 90 days to secure the website, detect and
            investigate abuse, and understand aggregate visitor geography (such as the country a
            visit originates from). Access to this information is restricted to authorised
            administrators.
          </p>

          <h2>3. Use of Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Respond to your inquiries and fulfill your requests</li>
            <li>Send administrative information and updates</li>
            <li>Improve our website and services</li>
            <li>Comply with legal obligations</li>
            <li>Protect against fraudulent or unauthorized activity</li>
          </ul>

          <h2>4. Information Sharing</h2>
          <p>
            We do not sell, trade, or otherwise transfer your personal information to outside parties except as required by law or in connection with legitimate government functions.
          </p>
          <p>We may share information:</p>
          <ul>
            <li>With other government agencies when required by law</li>
            <li>To comply with legal processes</li>
            <li>To protect the rights and safety of the public</li>
          </ul>

          <h2>5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect the security of your personal information. However, no method of transmission over the Internet is 100% secure.
          </p>

          <h2>6. Cookies</h2>
          <p>
            Our website may use cookies to enhance your experience. You can choose to disable cookies through your browser settings, though this may affect some functionality of the website.
          </p>

          <h2>7. Third-Party Links</h2>
          <p>
            Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites and encourage you to review their privacy policies.
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            Our website is not intended for children under 13 years of age. We do not knowingly collect personal information from children.
          </p>

          <h2>9. Your Rights</h2>
          <p>Under applicable data protection laws, you may have the right to:</p>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Object to processing of your information</li>
          </ul>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our privacy practices, please contact us:
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
  title: 'Privacy Policy | Ghana Audit Service',
  description: 'Learn how the Ghana Audit Service collects, uses, and protects your personal information.'
})
</script>

<!-- Styles handled by @tailwindcss/typography plugin -->
