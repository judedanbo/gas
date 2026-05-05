<template>
  <div class="w-full">
    <form
      class="flex gap-3 items-center flex-wrap md:flex-nowrap"
      role="search"
      @submit.prevent="handleSearch"
    >
      <div class="flex-1 relative flex items-center w-full md:w-auto">
        <Icon
          name="heroicons:magnifying-glass"
          class="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="search"
          class="w-full py-3 px-4 pl-12 pr-10 text-base border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white transition-colors focus:outline-none focus:border-primary dark:focus:border-primary-light"
          placeholder="Search reports, publications, news..."
          aria-label="Search the website"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-3 bg-transparent border-none p-2 cursor-pointer text-gray-400 dark:text-gray-500 text-lg leading-none hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Clear search"
          @click="clearSearch"
        >
          ✕
        </button>
      </div>
      <button type="submit" class="btn-primary whitespace-nowrap flex-1 md:flex-none">
        Search
      </button>
      <button
        type="button"
        class="bg-transparent border-none p-2 cursor-pointer text-gray-400 dark:text-gray-500 text-xl leading-none hover:text-gray-600 dark:hover:text-gray-300 md:order-none order-first md:static absolute right-0 -top-10"
        aria-label="Close search"
        @click="$emit('close')"
      >
        ✕
      </button>
    </form>

    <!-- Quick Links -->
    <div class="flex items-center gap-3 mt-3 flex-wrap">
      <span class="text-sm text-gray-500 dark:text-gray-400">Popular searches:</span>
      <div class="flex gap-2 flex-wrap">
        <NuxtLink
          to="/reports?category=financial"
          class="inline-block px-3 py-1 text-sm text-primary dark:text-primary-light bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full no-underline transition-all hover:bg-primary hover:text-white hover:border-primary"
          @click="$emit('close')"
        >
          Financial Reports
        </NuxtLink>
        <NuxtLink
          to="/reports?category=performance"
          class="inline-block px-3 py-1 text-sm text-primary dark:text-primary-light bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full no-underline transition-all hover:bg-primary hover:text-white hover:border-primary"
          @click="$emit('close')"
        >
          Performance Audits
        </NuxtLink>
        <NuxtLink
          to="/publications/press-statements"
          class="inline-block px-3 py-1 text-sm text-primary dark:text-primary-light bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full no-underline transition-all hover:bg-primary hover:text-white hover:border-primary"
          @click="$emit('close')"
        >
          Press Statements
        </NuxtLink>
        <NuxtLink
          to="/careers"
          class="inline-block px-3 py-1 text-sm text-primary dark:text-primary-light bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full no-underline transition-all hover:bg-primary hover:text-white hover:border-primary"
          @click="$emit('close')"
        >
          Job Vacancies
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const emit = defineEmits<{
    close: []
  }>()

  const router = useRouter()
  const searchInput = ref<HTMLInputElement | null>(null)
  const searchQuery = ref('')

  const handleSearch = () => {
    if (searchQuery.value.trim()) {
      router.push({
        path: '/search',
        query: { q: searchQuery.value.trim() }
      })
      emit('close')
    }
  }

  const clearSearch = () => {
    searchQuery.value = ''
    searchInput.value?.focus()
  }

  // Focus input on mount
  onMounted(() => {
    searchInput.value?.focus()
  })
</script>
