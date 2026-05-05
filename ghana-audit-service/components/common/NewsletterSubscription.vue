<template>
  <div class="bg-primary/20 py-8 border-t border-gray-800">
    <div class="container">
      <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div class="flex-1">
          <h4 class="text-lg font-semibold text-white mb-2">{{ $t('newsletter.title') }}</h4>
          <p class="text-gray-400 text-sm">
            {{ $t('newsletter.description') }}
          </p>
        </div>
        <div class="w-full lg:w-auto">
          <!-- Success Message -->
          <div
            v-if="success"
            class="bg-green-600/20 border border-green-500 text-green-400 px-4 py-3 rounded-lg text-sm"
          >
            <span class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5" aria-hidden="true" />
              {{ $t('newsletter.success') }}
            </span>
          </div>
          <!-- Subscription Form -->
          <form v-else class="flex flex-col sm:flex-row gap-3" @submit.prevent="handleSubmit">
            <div class="flex-1">
              <label for="newsletter-email" class="sr-only">{{ $t('contact.form.email') }}</label>
              <input
                id="newsletter-email"
                v-model="email"
                type="email"
                :placeholder="$t('newsletter.placeholder')"
                class="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                :disabled="loading"
                required
              />
              <p v-if="error" class="text-red-400 text-xs mt-1">
                {{ error }}
              </p>
            </div>
            <button
              type="submit"
              class="px-6 py-3 bg-accent text-gray-900 font-semibold rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              :disabled="loading"
            >
              <span v-if="loading">{{ $t('common.subscribing') }}</span>
              <span v-else>{{ $t('common.subscribe') }}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { email, loading, success, error, subscribe } = useNewsletter()

  async function handleSubmit() {
    await subscribe()
  }
</script>
