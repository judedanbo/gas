<template>
  <div
    role="group"
    :aria-roledescription="$t('slideshow.slideLabel', 'slide')"
    :aria-label="$t('slideshow.slideOf', { current: index + 1, total: totalSlides })"
    :aria-hidden="!isActive"
    class="absolute inset-0 transition-opacity duration-700 ease-in-out"
    :class="isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'"
  >
    <!-- Background image with Ken Burns -->
    <div class="absolute inset-0 overflow-hidden">
      <NuxtImg
        :src="slide.image"
        :alt="slide.imageAlt"
        :loading="isFirst ? 'eager' : 'lazy'"
        :fetchpriority="isFirst ? 'high' : undefined"
        sizes="100vw"
        class="h-full w-full object-cover text-transparent"
        :class="isActive ? 'animate-ken-burns' : ''"
      />
    </div>

    <!-- Gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />

    <!-- Text content -->
    <div class="absolute inset-0 flex items-end">
      <div class="container mx-auto px-4 pb-20 sm:pb-24 md:pb-28">
        <div class="max-w-2xl pl-12 sm:pl-14">
          <!-- Category badge -->
          <span
            v-if="slide.categoryLabel"
            class="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-900"
          >
            {{ $t(slide.categoryLabel) }}
          </span>

          <!-- Title -->
          <h2
            class="mb-2 text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl lg:text-5xl"
            style="font-family: 'Plus Jakarta Sans', sans-serif"
          >
            {{ slide.title }}
          </h2>

          <!-- Excerpt -->
          <p
            v-if="slide.excerpt"
            class="mb-4 line-clamp-2 max-w-xl text-base text-white/90 sm:text-lg"
          >
            {{ slide.excerpt }}
          </p>

          <!-- CTA Button -->
          <NuxtLink
            :to="slide.linkUrl"
            class="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black sm:px-6 sm:py-3 sm:text-base"
            :tabindex="isActive ? 0 : -1"
          >
            {{ $t(slide.linkLabel) }}
            <Icon name="heroicons:arrow-right-20-solid" class="h-5 w-5" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { HeroSlide } from '~/types'

  defineProps<{
    slide: HeroSlide
    isActive: boolean
    isFirst: boolean
    index: number
    totalSlides: number
  }>()
</script>

<style scoped>
  @keyframes ken-burns {
    from {
      transform: scale(1);
    }
    to {
      transform: scale(1.05);
    }
  }

  .animate-ken-burns {
    animation: ken-burns 7s ease-in-out forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-ken-burns {
      animation: none;
    }
  }
</style>
