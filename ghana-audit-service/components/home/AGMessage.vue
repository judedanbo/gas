<template>
  <section v-if="message" class="section bg-gray-50 dark:bg-gray-900">
    <div class="container">
      <div class="max-w-4xl mx-auto">
        <div class="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <!-- Photo -->
          <div v-if="message.photo" class="flex-shrink-0">
            <img
              :src="message.photo"
              :alt="`${message.name}, ${message.title}`"
              class="w-48 h-48 md:w-64 md:h-64 rounded-2xl object-cover shadow-lg"
            />
          </div>
          <!-- Content -->
          <div class="flex-1 text-center md:text-left">
            <span
              class="inline-block bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold mb-4"
            >
              {{ $t('home.agMessage.badge') }}
            </span>
            <h2
              class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-2"
            >
              {{ message.name }}
            </h2>
            <p class="text-gray-600 dark:text-gray-400 text-lg mb-6">{{ message.title }}</p>
            <blockquote
              class="font-heading text-md italic text-gray-600 dark:text-gray-400 leading-relaxed border-l-4 border-accent pl-6 text-left m-0"
            >
              "{{ message.excerpt }}"
            </blockquote>
            <NuxtLink
              :to="localePath('/about/auditor-general')"
              class="inline-flex items-center gap-1 text-primary dark:text-accent text-sm font-semibold mt-4 hover:underline"
            >
              {{ $t('home.agMessage.readFullMessage') }}
              <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  const localePath = useLocalePath()
  const { message } = useAuditorGeneral()
</script>
