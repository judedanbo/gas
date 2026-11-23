<template>
  <UiBaseModal
    :model-value="modelValue"
    title="Add to the carousel"
    size="full"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <fieldset>
        <legend class="mb-2 text-sm font-medium text-gray-900 dark:text-white">
          What do you want to add?
        </legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="option in typeOptions"
            :key="option.value"
            class="cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800"
            :class="
              type === option.value
                ? 'border-primary bg-primary text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
            "
          >
            <input
              v-model="type"
              type="radio"
              name="carousel-add-type"
              :value="option.value"
              class="sr-only"
            />
            {{ option.label }}
          </label>
        </div>
      </fieldset>

      <div>
        <label
          for="carousel-add-search"
          class="mb-1 block text-sm font-medium text-gray-900 dark:text-white"
        >
          Search by title
        </label>
        <input
          id="carousel-add-search"
          v-model="search"
          type="search"
          placeholder="Leave empty to see the most recent"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div aria-live="polite">
        <p v-if="searching" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Searching...
        </p>
        <p v-else-if="searchError" class="py-6 text-center text-sm text-red-700 dark:text-red-400">
          {{ searchError }}
        </p>
        <p
          v-else-if="results.length === 0"
          class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          Nothing published matches.
        </p>
        <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <li v-for="result in results" :key="result.refId" class="flex items-center gap-3 py-3">
            <img
              v-if="result.image"
              :src="result.image"
              alt=""
              loading="lazy"
              class="h-12 w-20 flex-none rounded bg-gray-100 object-cover dark:bg-gray-700"
            />
            <div v-else class="h-12 w-20 flex-none rounded bg-gray-100 dark:bg-gray-700" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                {{ result.title }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatCarouselDate(result.date) }}
              </p>
            </div>
            <span
              v-if="shownKeys.has(`${result.type}:${result.refId}`)"
              class="flex-none text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              On the carousel
            </span>
            <button
              v-else
              type="button"
              class="btn btn-outline btn-sm flex-none"
              :disabled="saving"
              :aria-label="`Add ${result.title}`"
              @click="$emit('add', result)"
            >
              {{ result.type === 'gallery' ? 'Choose photos' : 'Add' }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </UiBaseModal>
</template>

<script setup lang="ts">
  import type { AdminCarouselCandidate, CarouselItemType } from '~/types/admin'

  const props = defineProps<{
    modelValue: boolean
    /** `${type}:${refId}` of everything already on the carousel */
    shownKeys: Set<string>
    saving: boolean
    searchCandidates: (type: CarouselItemType, search: string) => Promise<AdminCarouselCandidate[]>
  }>()

  defineEmits<{
    'update:modelValue': [value: boolean]
    add: [candidate: AdminCarouselCandidate]
  }>()

  const typeOptions = (Object.keys(CAROUSEL_TYPE_LABELS) as CarouselItemType[]).map((value) => ({
    value,
    label: CAROUSEL_TYPE_LABELS[value]
  }))

  const type = ref<CarouselItemType>('news')
  const search = ref('')
  const results = ref<AdminCarouselCandidate[]>([])
  const searching = ref(false)
  const searchError = ref<string | null>(null)

  let requestId = 0
  async function runSearch() {
    const id = ++requestId
    searching.value = true
    searchError.value = null
    try {
      const data = await props.searchCandidates(type.value, search.value.trim())
      if (id === requestId) results.value = data
    } catch {
      if (id === requestId) searchError.value = 'Search failed. Please try again.'
    } finally {
      if (id === requestId) searching.value = false
    }
  }

  const debouncedSearch = useDebounceFn(runSearch, 300)

  watch(search, () => debouncedSearch())
  watch(type, () => {
    results.value = []
    runSearch()
  })
  watch(
    () => props.modelValue,
    (open) => {
      if (open) runSearch()
    },
    { immediate: true }
  )
</script>
