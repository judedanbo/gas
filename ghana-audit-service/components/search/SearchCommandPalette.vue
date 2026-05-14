<template>
  <Teleport to="body">
    <Transition name="palette">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        @keydown.esc.stop="close"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="close"
        />

        <!-- Palette -->
        <div
          class="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          @keydown.arrow-down.prevent="moveHighlight(1)"
          @keydown.arrow-up.prevent="moveHighlight(-1)"
          @keydown.enter.prevent="selectHighlighted"
        >
          <!-- Search Input -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <Icon
              name="heroicons:magnifying-glass"
              class="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0"
              aria-hidden="true"
            />
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              class="flex-1 bg-transparent border-none outline-none text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              :placeholder="$t('search.commandPalette.placeholder')"
              aria-label="Search"
              aria-autocomplete="list"
              :aria-activedescendant="highlightedId"
              aria-controls="search-results-list"
            />
            <kbd
              class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
            >
              Esc
            </kbd>
          </div>

          <!-- Results Area -->
          <div
            id="search-results-list"
            role="listbox"
            aria-label="Search results"
            class="max-h-[50vh] overflow-y-auto"
          >
            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              <span class="sr-only">{{ $t('common.loading') }}</span>
            </div>

            <!-- Hint (no query) -->
            <div
              v-else-if="!query.trim()"
              class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              <Icon
                name="heroicons:magnifying-glass"
                class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              />
              <p>{{ $t('search.commandPalette.hint') }}</p>
              <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs border border-gray-200 dark:border-gray-600">Ctrl+K</kbd>
                {{ $t('search.commandPalette.shortcutHint') }}
              </p>
            </div>

            <!-- No Results -->
            <div
              v-else-if="results.length === 0 && !loading"
              class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              <Icon
                name="heroicons:inbox"
                class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              />
              <p>{{ $t('search.commandPalette.noResults', { query: query }) }}</p>
            </div>

            <!-- Results List -->
            <template v-else>
              <div
                v-for="(group, groupIndex) in groupedResults"
                :key="group.type"
              >
                <div class="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {{ $t(`searchTypes.${group.type}`) }}
                </div>
                <div
                  v-for="(result, resultIndex) in group.items"
                  :id="`search-result-${flatIndex(groupIndex, resultIndex)}`"
                  :key="result.id"
                  role="option"
                  :aria-selected="highlightIndex === flatIndex(groupIndex, resultIndex)"
                  class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                  :class="highlightIndex === flatIndex(groupIndex, resultIndex)
                    ? 'bg-primary/10 dark:bg-primary/20 border-l-2 border-primary'
                    : 'border-l-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'"
                  @click="navigateToResult(result)"
                  @mouseenter="highlightIndex = flatIndex(groupIndex, resultIndex)"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ result.title }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ result.excerpt }}
                    </p>
                  </div>
                  <span v-if="result.publishedAt" class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {{ formatDateShort(result.publishedAt) }}
                  </span>
                </div>
              </div>

              <!-- Live region for screen readers -->
              <div class="sr-only" aria-live="polite" aria-atomic="true">
                {{ meta.total }} results found
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div
            v-if="results.length > 0"
            class="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs"
          >
            <NuxtLink
              :to="viewAllLink"
              class="text-primary dark:text-primary-light hover:underline font-medium"
              @click="close"
            >
              {{ $t('search.commandPalette.viewAll', { count: meta.total }) }}
            </NuxtLink>
            <div class="flex items-center gap-2 text-gray-400 dark:text-gray-500">
              <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">&uarr;</kbd><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">&darr;</kbd> navigate</span>
              <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">&crarr;</kbd> select</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { SearchResult } from '~/types'

const router = useRouter()
const localePath = useLocalePath()
const { formatDateShort } = useLocaleDate()
const { results, loading, meta, search, clearResults } = useSearch()

const isOpen = useState('searchPalette', () => false)
const query = ref('')
const highlightIndex = ref(-1)
const inputRef = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | undefined

interface ResultGroup {
  type: string
  items: SearchResult[]
}

const groupedResults = computed<ResultGroup[]>(() => {
  const groups = new Map<string, SearchResult[]>()
  const maxResults = 8
  let count = 0
  for (const result of results.value) {
    if (count >= maxResults) break
    const existing = groups.get(result.type)
    if (existing) {
      existing.push(result)
    } else {
      groups.set(result.type, [result])
    }
    count++
  }
  return Array.from(groups, ([type, items]) => ({ type, items }))
})

const flatResults = computed(() => groupedResults.value.flatMap(g => g.items))

function flatIndex(groupIndex: number, resultIndex: number): number {
  let idx = 0
  for (let i = 0; i < groupIndex; i++) {
    idx += groupedResults.value[i].items.length
  }
  return idx + resultIndex
}

const highlightedId = computed(() =>
  highlightIndex.value >= 0 ? `search-result-${highlightIndex.value}` : undefined
)

const viewAllLink = computed(() => ({
  path: localePath('/search'),
  query: { q: query.value }
}))

function debouncedSearch() {
  clearTimeout(debounceTimer)
  highlightIndex.value = -1
  const q = query.value.trim()
  if (q.length < 2) {
    clearResults()
    return
  }
  debounceTimer = setTimeout(() => {
    search({ query: q, perPage: 10 })
  }, 300)
}

watch(query, debouncedSearch)

function moveHighlight(delta: number) {
  const total = flatResults.value.length
  if (total === 0) return
  highlightIndex.value = (highlightIndex.value + delta + total) % total
}

function selectHighlighted() {
  const result = flatResults.value[highlightIndex.value]
  if (result) {
    navigateToResult(result)
  } else if (query.value.trim()) {
    router.push(viewAllLink.value)
    close()
  }
}

function navigateToResult(result: SearchResult) {
  router.push(localePath(result.url))
  close()
}

function close() {
  isOpen.value = false
}

watch(isOpen, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
    nextTick(() => inputRef.value?.focus())
  } else {
    document.body.style.overflow = ''
    query.value = ''
    highlightIndex.value = -1
    clearResults()
    clearTimeout(debounceTimer)
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
  clearTimeout(debounceTimer)
})
</script>

<style scoped>
.palette-enter-active,
.palette-leave-active {
  transition: opacity 0.15s ease;
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}

.palette-enter-active > div:last-child,
.palette-leave-active > div:last-child {
  transition: transform 0.15s ease;
}

.palette-enter-from > div:last-child,
.palette-leave-to > div:last-child {
  transform: scale(0.95) translateY(-10px);
}
</style>
