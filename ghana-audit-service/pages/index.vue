<template>
  <div>
    <!-- Hero Slideshow -->
    <HomeHeroSlideshow />

    <!-- Stats Section (Animated) -->
    <HomeStatsCounter :stats="stats" />

    <!-- About Cards Section -->
    <HomeAboutCards />

    <!-- Latest Reports Section -->
    <HomeLatestReports />

    <!-- A-G Message Section -->
    <HomeAGMessage />

    <!-- Publications Preview Section -->
    <HomePublicationsPreview />

    <!-- Quick Links Section -->
    <section class="section">
      <div class="container">
        <UiSectionHeader title="Quick Access" description="Find what you're looking for" />
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <UiInfoCard
            v-for="link in quickLinks"
            :key="link.title"
            :icon="link.icon"
            :title="link.title"
            :description="link.description"
            :to="link.href"
            variant="centered"
            hover
          />
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="section bg-gradient-to-br from-primary to-primary-dark">
      <div class="container">
        <div class="text-center max-w-[600px] mx-auto">
          <h3 class="text-2xl md:text-3xl font-heading font-bold text-white mb-4">CitizensEye App</h3>
          <p class="text-white/90 text-lg mb-6">
            Report concerns and engage with the Ghana Audit Service through our citizen engagement
            platform.
          </p>
          <a
            href="https://www.appsheet.com/start/5b1b9364-12e7-4613-a082-26cebb71f29f"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-accent btn-lg"
          >
            Launch CitizensEye
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  // Schema.org structured data
  const { getOrganizationSchema, getWebSiteSchema } = useSchemaOrg()

  const schemas = [getOrganizationSchema(), getWebSiteSchema()]

  // Page meta
  useHead({
    title: 'Home',
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(schemas)
      }
    ]
  })

  useSeoMeta({
    title: 'Ghana Audit Service - Protecting the Public Purse',
    description:
      'The Ghana Audit Service has a constitutional mandate to audit public accounts and protect the public purse of Ghana through accountability and transparency.',
    ogTitle: 'Ghana Audit Service',
    ogDescription: 'Protecting the Public Purse Through Accountability and Transparency',
    ogType: 'website'
  })

  // Organization statistics
  const stats = [
    { label: 'Years of Service', value: 115, suffix: '+' },
    { label: 'Staff Members', value: 2295, suffix: '' },
    { label: 'Regions Covered', value: 16, suffix: '' },
    { label: 'Districts Nationwide', value: 95, suffix: '' }
  ]

  // Quick links data
  const quickLinks = [
    {
      icon: 'heroicons:chart-bar',
      title: 'Audit Reports',
      description: 'Access the latest Auditor-General reports',
      href: '/reports'
    },
    {
      icon: 'heroicons:newspaper',
      title: 'Press Statements',
      description: 'Official statements and announcements',
      href: '/publications/press-statements'
    },
    {
      icon: 'heroicons:briefcase',
      title: 'Career Opportunities',
      description: 'View current job vacancies',
      href: '/careers'
    },
    {
      icon: 'heroicons:phone',
      title: 'Contact Us',
      description: 'Get in touch with our offices',
      href: '/contact'
    }
  ]
</script>
