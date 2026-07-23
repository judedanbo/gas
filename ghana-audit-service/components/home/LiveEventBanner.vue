<template>
  <section v-if="firstEvent" role="status" aria-live="polite" class="bg-secondary text-white">
    <div
      class="container py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center"
    >
      <span class="inline-flex items-center gap-2 font-semibold">
        <span class="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span
            class="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"
          ></span>
          <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-white"></span>
        </span>
        {{ $t('home.liveBanner.label') }}: {{ firstEvent.title }}
      </span>
      <NuxtLink
        :to="`/media/videos?play=${firstEvent.videoId}`"
        class="font-semibold underline underline-offset-4 rounded hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {{ $t('home.liveBanner.watchNow') }}
        <span class="sr-only">— {{ firstEvent.title }}</span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { LiveEvent } from '~/types'

  interface Props {
    events: LiveEvent[]
  }

  const props = defineProps<Props>()

  const firstEvent = computed(() => props.events[0] ?? null)
</script>
