<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 py-4">
      <div class="container">
        <NuxtLink to="/" class="flex items-center gap-3">
          <Icon name="heroicons:building-library" class="w-8 h-8 text-primary" aria-hidden="true" />
          <div>
            <span class="block font-heading text-xl font-bold text-primary">Audit Service</span>
            <span class="text-xs text-gray-500 uppercase tracking-wide">{{
              $t('home.tagline')
            }}</span>
          </div>
        </NuxtLink>
      </div>
    </header>

    <!-- Error Content -->
    <main class="flex-1 flex items-center justify-center py-16">
      <div class="container">
        <div class="max-w-xl mx-auto text-center">
          <!-- Error Icon -->
          <div class="mb-8">
            <div
              v-if="error?.statusCode === 404"
              class="w-24 h-24 mx-auto bg-accent/20 rounded-full flex items-center justify-center"
            >
              <Icon
                name="heroicons:magnifying-glass"
                class="w-12 h-12 text-accent"
                aria-hidden="true"
              />
            </div>
            <div
              v-else
              class="w-24 h-24 mx-auto bg-secondary/20 rounded-full flex items-center justify-center"
            >
              <Icon
                name="heroicons:exclamation-triangle"
                class="w-12 h-12 text-secondary"
                aria-hidden="true"
              />
            </div>
          </div>

          <!-- Error Code -->
          <p class="text-sm font-medium text-gray-500 mb-2">
            {{ $t('errors.errorCode') }}: {{ error?.statusCode || 500 }}
          </p>

          <!-- Error Title -->
          <h1 class="text-3xl font-heading font-bold text-gray-900 mb-4">
            {{ errorTitle }}
          </h1>

          <!-- Error Description -->
          <p class="text-lg text-gray-600 mb-8">
            {{ errorDescription }}
          </p>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button type="button" class="btn-outline" @click="handleGoBack">
              <Icon name="heroicons:arrow-left" class="w-5 h-5 mr-2" aria-hidden="true" />
              {{ $t('errors.goBack') }}
            </button>
            <NuxtLink to="/" class="btn-primary">
              <Icon name="heroicons:home" class="w-5 h-5 mr-2" aria-hidden="true" />
              {{ $t('errors.goHome') }}
            </NuxtLink>
          </div>

          <!-- Additional Help -->
          <div class="mt-12 pt-8 border-t border-gray-200">
            <p class="text-sm text-gray-500 mb-4">Need help? Contact us at</p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center text-sm">
              <a
                href="mailto:info@audit.gov.gh"
                class="text-primary hover:underline flex items-center justify-center gap-2"
              >
                <Icon name="heroicons:envelope" class="w-4 h-4" aria-hidden="true" />
                info@audit.gov.gh
              </a>
              <a
                href="tel:+233302664929"
                class="text-primary hover:underline flex items-center justify-center gap-2"
              >
                <Icon name="heroicons:phone" class="w-4 h-4" aria-hidden="true" />
                +233 (302) 664929
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-gray-900 text-white py-6">
      <div class="container">
        <p class="text-sm text-gray-400 text-center">
          &copy; {{ currentYear }} Audit Service. {{ $t('footer.copyright') }}
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
  import type { NuxtError } from '#app'

  const props = defineProps<{
    error: NuxtError
  }>()

  const { t } = useI18n()

  const currentYear = new Date().getFullYear()

  const statusCode = computed(() => props.error?.statusCode ?? 500)

  const errorTitle = computed(() => {
    if (statusCode.value === 404) {
      return t('errors.notFound')
    }
    if (statusCode.value >= 500) {
      return t('errors.serverError')
    }
    return props.error?.statusMessage || t('errors.serverError')
  })

  const errorDescription = computed(() => {
    if (statusCode.value === 404) {
      return t('errors.notFoundDesc')
    }
    if (statusCode.value >= 500) {
      return t('errors.serverErrorDesc')
    }
    return props.error?.message || t('errors.serverErrorDesc')
  })

  function handleGoBack() {
    // Try to go back in history, or go home if no history
    if (window.history.length > 1) {
      window.history.back()
    } else {
      navigateTo('/')
    }
  }

  // Handle error clearing when navigating away (available for template use)
  // const _handleError = () => clearError({ redirect: '/' })
</script>

<style scoped>
  .container {
    @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
  }
</style>
