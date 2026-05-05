<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'Events', path: '/media/events' }
      ]"
    />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Events</h1>
        <p class="page-subtitle">Upcoming and past events from the Ghana Audit Service.</p>
      </div>
    </div>

    <!-- Upcoming Events -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Upcoming Events"
          description="Join us at our upcoming events and activities"
          size="sm"
          :centered="false"
        />

        <!-- Loading State -->
        <div v-if="loadingUpcoming" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="upcomingEvents.length === 0"
          class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <Icon
            name="heroicons:calendar"
            class="w-16 h-16 mx-auto mb-4 text-gray-400"
            aria-hidden="true"
          />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No upcoming events
          </h3>
          <p class="text-gray-600 dark:text-gray-400">Check back soon for new events.</p>
        </div>

        <!-- Events Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MediaEventCard v-for="event in upcomingEvents" :key="event.id" :event="event" />
        </div>
      </div>
    </section>

    <!-- Past Events -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Past Events"
          description="A look back at our previous events and activities"
          size="sm"
          :centered="false"
        />

        <!-- Loading State -->
        <div v-if="loadingPast" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="pastEvents.length === 0"
          class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <Icon
            name="heroicons:calendar"
            class="w-16 h-16 mx-auto mb-4 text-gray-400"
            aria-hidden="true"
          />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No past events</h3>
          <p class="text-gray-600 dark:text-gray-400">Events archive coming soon.</p>
        </div>

        <!-- Events Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MediaEventCard v-for="event in pastEvents" :key="event.id" :event="event" />
        </div>
      </div>
    </section>

    <!-- Event Inquiries -->
    <section class="section">
      <div class="container text-center max-w-2xl mx-auto">
        <UiSectionHeader
          title="Have Questions About Our Events?"
          description="Contact us for more information about our events and how to participate."
          size="sm"
        />
        <NuxtLink to="/contact" class="btn-primary"> Contact Us </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { Event } from '~/types'

  // SEO
  useSeoMeta({
    title: 'Events | Ghana Audit Service',
    description: 'Upcoming and past events from the Ghana Audit Service.'
  })

  const upcomingEvents = ref<Event[]>([])
  const pastEvents = ref<Event[]>([])
  const loadingUpcoming = ref(true)
  const loadingPast = ref(true)

  onMounted(async () => {
    // Fetch upcoming events
    try {
      upcomingEvents.value = await $fetch<Event[]>('/api/events', {
        query: { filter: 'upcoming' }
      })
    } catch (error) {
      console.error('Failed to fetch upcoming events:', error)
    } finally {
      loadingUpcoming.value = false
    }

    // Fetch past events
    try {
      pastEvents.value = await $fetch<Event[]>('/api/events', {
        query: { filter: 'past' }
      })
    } catch (error) {
      console.error('Failed to fetch past events:', error)
    } finally {
      loadingPast.value = false
    }
  })
</script>
