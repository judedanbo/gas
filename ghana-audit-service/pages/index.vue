<template>
  <div>
    <!-- Live Event Banner (renders nothing unless a broadcast is live) -->
    <HomeLiveEventBanner :events="liveEvents" />

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

    <!-- Our Apps (CitizensEye, Tracker, … — managed at /admin/apps) -->
    <section
      class="section bg-gradient-to-br from-primary to-primary-dark"
      aria-labelledby="home-apps-heading"
    >
      <div class="container">
        <div class="text-center max-w-[640px] mx-auto mb-10">
          <h2
            id="home-apps-heading"
            class="text-2xl md:text-3xl font-heading font-bold text-white mb-4"
          >
            {{ $t('apps.homeTitle') }}
          </h2>
          <p class="text-white/90 text-lg">{{ $t('apps.homeDescription') }}</p>
        </div>
        <ul
          v-if="homeApps.length"
          class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto list-none p-0 m-0"
        >
          <li v-for="app in homeApps" :key="app.slug">
            <AppsAppCard :app="app" heading-tag="h3" />
          </li>
        </ul>
        <div class="on-brand text-center mt-10">
          <NuxtLink :to="localePath('/apps')" class="btn-accent btn-lg">
            {{ $t('apps.seeAll') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  const localePath = useLocalePath()

  // Audit Service apps — the first four; the rest are on /apps.
  const { data: apps } = await useServiceApps()
  const homeApps = computed(() => (apps.value ?? []).slice(0, 4))

  // Live YouTube broadcast status — fetched client-side (the page is ISR
  // cached, so SSR output must not bake in a stale live state).
  const { liveEvents } = useLiveEvents()

  // Schema.org structured data
  const { getOrganizationSchema, getWebSiteSchema } = useSchemaOrg()

  const schemas = [getOrganizationSchema(), getWebSiteSchema()]

  // Page meta
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(schemas)
      }
    ]
  })

  useSeoMeta({
    title: 'Protecting the Public Purse',
    description:
      'The Ghana Audit Service has a constitutional mandate to audit public accounts and protect the public purse of Ghana through accountability and transparency.',
    ogTitle: 'Ghana Audit Service',
    ogDescription: 'Protecting the Public Purse Through Accountability and Transparency',
    ogType: 'website'
  })

  // Organization statistics (admin-managed via /admin/site-stats)
  const { stats } = useSiteStats('home')

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
