<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">
          Accessibility Statement
        </h1>
        <p class="page-subtitle">
          Our commitment to making this website accessible to all users.
        </p>
      </div>
    </div>

    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Accessibility', path: '/accessibility' }
      ]"
    />

    <!-- Content -->
    <section class="section">
      <div class="container">
        <div class="max-w-3xl mx-auto prose prose-lg dark:prose-invert">
          <h2>Our Commitment</h2>
          <p>
            The Ghana Audit Service is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
          </p>

          <h2>Conformance Status</h2>
          <p>
            We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. These guidelines explain how to make web content more accessible for people with disabilities and more user-friendly for everyone.
          </p>

          <h2>Accessibility Features</h2>
          <p>This website includes the following accessibility features:</p>

          <h3>Navigation</h3>
          <ul>
            <li>Consistent navigation throughout the website</li>
            <li>Skip to main content link</li>
            <li>Descriptive page titles</li>
            <li>Clear and logical heading structure</li>
          </ul>

          <h3>Visual Design</h3>
          <ul>
            <li>Sufficient color contrast between text and background</li>
            <li>Text can be resized up to 200% without loss of functionality</li>
            <li>No content flashes more than three times per second</li>
            <li>Links are visually distinguishable from surrounding text</li>
          </ul>

          <h3>Content</h3>
          <ul>
            <li>Alternative text for images</li>
            <li>Descriptive link text</li>
            <li>Tables with appropriate headers</li>
            <li>Form fields with associated labels</li>
          </ul>

          <h3>Keyboard Accessibility</h3>
          <ul>
            <li>All interactive elements are keyboard accessible</li>
            <li>Visible focus indicators</li>
            <li>No keyboard traps</li>
          </ul>

          <h2>Known Limitations</h2>
          <p>
            While we strive to ensure accessibility, some content may have limitations:
          </p>
          <ul>
            <li>Older PDF documents may not be fully accessible</li>
            <li>Some third-party content may not meet accessibility standards</li>
            <li>Complex data visualizations may have limited descriptions</li>
          </ul>
          <p>
            We are working to address these limitations and improve accessibility across all content.
          </p>

          <h2>Assistive Technologies</h2>
          <p>
            This website is designed to be compatible with the following assistive technologies:
          </p>
          <ul>
            <li>Screen readers (JAWS, NVDA, VoiceOver)</li>
            <li>Screen magnification software</li>
            <li>Speech recognition software</li>
            <li>Keyboard-only navigation</li>
          </ul>

          <h2>Browser Compatibility</h2>
          <p>
            This website is designed to work with recent versions of major browsers including:
          </p>
          <ul>
            <li>Google Chrome</li>
            <li>Mozilla Firefox</li>
            <li>Apple Safari</li>
            <li>Microsoft Edge</li>
          </ul>

          <h2>Feedback</h2>
          <p>
            We welcome your feedback on the accessibility of the Ghana Audit Service website. If you encounter accessibility barriers or have suggestions for improvement, please contact us:
          </p>
          <ul>
            <li>Email: <a href="mailto:info@audit.gov.gh">info@audit.gov.gh</a></li>
            <li>Phone: +233 (302) 664928/9</li>
            <li>Address: No. 12 Starlets 91 Road, Opposite African Union, Accra</li>
          </ul>
          <p>
            We try to respond to accessibility feedback within 5 business days.
          </p>

          <h2>Enforcement Procedure</h2>
          <p>
            If you are not satisfied with our response to your accessibility concern, you may contact the National Communications Authority (NCA) of Ghana for further assistance.
          </p>

          <h2>Technical Specifications</h2>
          <p>
            This website relies on the following technologies to work with assistive technologies:
          </p>
          <ul>
            <li>HTML5</li>
            <li>WAI-ARIA</li>
            <li>CSS</li>
            <li>JavaScript</li>
          </ul>

          <h2>Assessment Methods</h2>
          <p>
            The Ghana Audit Service assesses accessibility through:
          </p>
          <ul>
            <li>Self-evaluation using automated testing tools</li>
            <li>Manual testing with assistive technologies</li>
            <li>User feedback and testing</li>
          </ul>

          <p class="mt-8 text-sm text-gray-500">
            This statement was last updated in December 2024.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Accessibility Statement | Ghana Audit Service',
  description: 'Learn about our commitment to making the Ghana Audit Service website accessible to all users.'
})
</script>

<!-- Styles handled by @tailwindcss/typography plugin -->
