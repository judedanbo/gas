<template>
  <div>
    <NuxtLink
      to="/admin/languages"
      class="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline dark:text-primary-200"
    >
      <span aria-hidden="true">←</span> Languages
    </NuxtLink>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span class="sr-only">Loading</span>
    </div>

    <div
      v-else-if="error || !data"
      class="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
      role="alert"
    >
      {{ error || 'Failed to load translations' }}
    </div>

    <template v-else>
      <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ data.language.name }} translations
          </h1>
          <p class="mt-1 max-w-3xl text-gray-600 dark:text-gray-400">
            Each piece of interface text in English, next to its {{ data.language.name }}
            translation. Text left blank is shown in English.
            <template v-if="data.language.isEnabled">
              {{ data.language.name }} is live — saved changes reach visitors within about a minute
              (up to an hour on some pages).
            </template>
            <template v-else>
              {{ data.language.name }} is switched off, so visitors don't see it yet.
            </template>
          </p>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            <span class="font-medium">{{ translatedCount }} of {{ data.entries.length }}</span>
            translated ({{ percent }}%)
          </p>
        </div>

        <div class="flex flex-none flex-wrap gap-2">
          <button type="button" class="btn btn-ghost btn-sm" @click="exportEnglish">
            Download English
          </button>
          <button type="button" class="btn btn-ghost btn-sm" @click="exportTranslations">
            Export
          </button>
          <template v-if="canEdit">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              :disabled="saving"
              @click="fileInput?.click()"
            >
              Import
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="application/json,.json"
              class="sr-only"
              tabindex="-1"
              aria-label="Import translations from a JSON file"
              @change="importFile"
            />
            <button
              type="button"
              class="btn btn-primary btn-sm whitespace-nowrap"
              :disabled="saving || changeCount === 0"
              @click="saveAll"
            >
              {{
                saving
                  ? 'Saving…'
                  : changeCount === 1
                    ? 'Save 1 change'
                    : changeCount > 1
                      ? `Save ${changeCount} changes`
                      : 'Saved'
              }}
            </button>
          </template>
        </div>
      </div>

      <!-- Filters -->
      <div
        class="mb-4 grid gap-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div class="sm:col-span-2">
          <label for="translation-search" :class="labelClass">Search</label>
          <input
            id="translation-search"
            v-model="search"
            type="search"
            placeholder="English text, translation or key"
            :class="controlClass"
          />
        </div>
        <div>
          <label for="translation-section" :class="labelClass">Section</label>
          <select id="translation-section" v-model="section" :class="controlClass">
            <option value="">All sections</option>
            <option v-for="name in sections" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
        <div>
          <label for="translation-status" :class="labelClass">Show</label>
          <select id="translation-status" v-model="status" :class="controlClass">
            <option value="all">Everything</option>
            <option value="missing">Not translated</option>
            <option value="translated">Translated</option>
            <option value="entered">Entered here</option>
            <option value="changed">Unsaved changes</option>
            <option value="problems">Needs attention</option>
          </select>
        </div>
      </div>

      <p class="mb-3 text-sm text-gray-600 dark:text-gray-400" role="status">
        {{ filtered.length }} {{ filtered.length === 1 ? 'text' : 'texts' }}
        <template v-if="pageCount > 1">· page {{ page }} of {{ pageCount }}</template>
      </p>

      <p
        v-if="filtered.length === 0"
        class="rounded-lg bg-white px-6 py-8 text-sm text-gray-600 shadow dark:bg-gray-800 dark:text-gray-400"
      >
        Nothing matches these filters.
      </p>

      <ul v-else class="space-y-3">
        <li
          v-for="row in visible"
          :key="row.key"
          class="rounded-lg bg-white p-4 shadow dark:bg-gray-800"
        >
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <p
                class="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400"
              >
                English
              </p>
              <p :id="`source-${row.key}`" lang="en" class="mt-1 text-gray-900 dark:text-white">
                {{ row.source }}
              </p>
              <p class="mt-2 break-all font-mono text-xs text-gray-600 dark:text-gray-400">
                {{ row.key }}
              </p>
            </div>

            <div>
              <label
                :for="`translation-${row.key}`"
                class="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400"
              >
                {{ data.language.name }}
              </label>
              <textarea
                :id="`translation-${row.key}`"
                :value="valueOf(row)"
                :lang="data.language.code"
                :dir="data.language.dir"
                :rows="row.source.length > 70 ? 3 : 1"
                :readonly="!canEdit"
                :maxlength="MAX_LENGTH"
                :placeholder="canEdit ? 'Not translated — shown in English' : 'Not translated'"
                :aria-describedby="`source-${row.key} hint-${row.key}`"
                :aria-invalid="problemOf(row) ? 'true' : undefined"
                :class="[
                  controlClass,
                  'mt-1 resize-y',
                  problemOf(row) ? 'border-red-500 dark:border-red-500' : ''
                ]"
                @input="setValue(row, ($event.target as HTMLTextAreaElement).value)"
              />
              <div
                :id="`hint-${row.key}`"
                class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              >
                <span v-if="problemOf(row)" class="font-medium text-red-700 dark:text-red-400">
                  {{ problemOf(row) }}
                </span>
                <span v-else-if="warningOf(row)" class="text-amber-800 dark:text-amber-300">
                  {{ warningOf(row) }}
                </span>
                <span v-if="row.key in drafts" class="font-medium text-gray-900 dark:text-white">
                  Not saved yet
                </span>
                <span v-else-if="row.override !== null" class="text-gray-600 dark:text-gray-400">
                  Entered here
                </span>
                <span v-else-if="row.bundled !== null" class="text-gray-600 dark:text-gray-400">
                  Built-in translation
                </span>
                <button
                  v-if="canEdit && row.key in drafts"
                  type="button"
                  class="font-medium text-primary underline dark:text-primary-200"
                  :aria-label="`Undo change to ${row.key}`"
                  @click="undo(row)"
                >
                  Undo
                </button>
                <button
                  v-else-if="canEdit && row.override !== null"
                  type="button"
                  class="font-medium text-primary underline dark:text-primary-200"
                  :aria-label="`${resetLabel(row)} for ${row.key}`"
                  @click="setValue(row, row.bundled ?? '')"
                >
                  {{ resetLabel(row) }}
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>

      <nav
        v-if="pageCount > 1"
        class="mt-4 flex items-center justify-between"
        aria-label="Translation pages"
      >
        <button type="button" class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="page--">
          Previous
        </button>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          Page {{ page }} of {{ pageCount }}
        </span>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :disabled="page >= pageCount"
          @click="page++"
        >
          Next
        </button>
      </nav>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { TranslationEntry } from '~/types/admin'
  import {
    flattenMessages,
    messageSyntaxProblem,
    placeholderMismatch,
    unflattenMessages,
    type FlatMessages
  } from '~/utils/i18nMessages'

  definePageMeta({ layout: 'admin' })

  const PAGE_SIZE = 40
  const MAX_LENGTH = 2000

  const route = useRoute()
  const code = String(route.params.code)

  const { data, loading, saving, error, load, save } = useAdminTranslations(code)
  const { hasPermission } = useAdminAuth()
  const toast = useToast()

  const canEdit = computed(() => hasPermission('update'))

  const labelClass = 'mb-1 block text-sm font-medium text-gray-900 dark:text-white'
  const controlClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white'

  // --- Editing ----------------------------------------------------------------

  /** Edited values that differ from what is stored, by message key. */
  const drafts = ref<FlatMessages>({})
  /** Problems the server reported on the last save, by message key. */
  const serverErrors = ref<Record<string, string>>({})

  const { markSaved } = useUnsavedChanges(() => drafts.value)

  const stored = (row: TranslationEntry) => row.override ?? row.bundled ?? ''
  const valueOf = (row: TranslationEntry) => drafts.value[row.key] ?? stored(row)

  /** A copy of `record` without `key`. */
  function without<T>(record: Record<string, T>, key: string): Record<string, T> {
    return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))
  }

  function setValue(row: TranslationEntry, value: string) {
    drafts.value =
      value === stored(row) ? without(drafts.value, row.key) : { ...drafts.value, [row.key]: value }

    if (row.key in serverErrors.value) {
      serverErrors.value = without(serverErrors.value, row.key)
    }
  }

  const undo = (row: TranslationEntry) => setValue(row, stored(row))

  const resetLabel = (row: TranslationEntry) =>
    row.bundled !== null ? 'Use built-in translation' : 'Clear'

  /** Blocks saving: text the site could not display. */
  function problemOf(row: TranslationEntry): string | null {
    if (serverErrors.value[row.key]) return serverErrors.value[row.key]
    const draft = drafts.value[row.key]
    return draft ? messageSyntaxProblem(draft.trim(), row.source) : null
  }

  /** Doesn't block saving: a placeholder such as {count} was lost or invented. */
  function warningOf(row: TranslationEntry): string | null {
    const value = valueOf(row).trim()
    if (!value) return null
    const { missing, unknown } = placeholderMismatch(row.source, value)
    if (unknown.length > 0) {
      return `{${unknown[0]}} is not in the English text and will show as blank.`
    }
    if (missing.length > 0) {
      return `Keep {${missing[0]}} — it is replaced with a value on the page.`
    }
    return null
  }

  const changeCount = computed(() => Object.keys(drafts.value).length)

  const translatedCount = computed(
    () => (data.value?.entries ?? []).filter((row) => valueOf(row).trim() !== '').length
  )
  const percent = computed(() => {
    const total = data.value?.entries.length ?? 0
    return total === 0 ? 0 : Math.floor((translatedCount.value / total) * 100)
  })

  // --- Filters ----------------------------------------------------------------

  const search = ref('')
  const section = ref('')
  const status = ref<'all' | 'missing' | 'translated' | 'entered' | 'changed' | 'problems'>('all')
  const page = ref(1)

  const sections = computed(() => [
    ...new Set((data.value?.entries ?? []).map((row) => row.key.split('.')[0]))
  ])

  const filtered = computed(() => {
    const needle = search.value.trim().toLowerCase()
    return (data.value?.entries ?? []).filter((row) => {
      if (section.value && row.key.split('.')[0] !== section.value) return false

      const value = valueOf(row)
      if (status.value === 'missing' && value.trim() !== '') return false
      if (status.value === 'translated' && value.trim() === '') return false
      if (status.value === 'entered' && row.override === null) return false
      if (status.value === 'changed' && !(row.key in drafts.value)) return false
      if (status.value === 'problems' && !problemOf(row) && !warningOf(row)) return false

      if (!needle) return true
      return (
        row.key.toLowerCase().includes(needle) ||
        row.source.toLowerCase().includes(needle) ||
        value.toLowerCase().includes(needle)
      )
    })
  })

  const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
  const visible = computed(() =>
    filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
  )

  watch([search, section, status], () => {
    page.value = 1
  })
  // Editing can shrink a filtered list (e.g. "Not translated") under the current page.
  watch(pageCount, (count) => {
    if (page.value > count) page.value = count
  })
  watch(page, () => {
    if (import.meta.client) window.scrollTo({ top: 0 })
  })

  // --- Save -------------------------------------------------------------------

  async function saveAll() {
    const rows = (data.value?.entries ?? []).filter((row) => row.key in drafts.value)
    if (rows.length === 0) return

    if (rows.some((row) => problemOf(row))) {
      status.value = 'problems'
      toast.error('Some translations need attention before they can be saved.')
      return
    }

    // A blank box removes the entered translation; so does matching the
    // built-in one, which then applies again.
    const changes: Record<string, string | null> = {}
    for (const row of rows) {
      const value = drafts.value[row.key].trim()
      changes[row.key] = value === '' || value === row.bundled ? null : value
    }

    try {
      await save(changes)
      drafts.value = {}
      serverErrors.value = {}
      markSaved()
      toast.success(`${rows.length} ${rows.length === 1 ? 'change' : 'changes'} saved`)
    } catch (err) {
      const errors = translationErrors(err)
      if (Object.keys(errors).length > 0) {
        serverErrors.value = errors
        status.value = 'problems'
        toast.error('Some translations need attention before they can be saved.')
      } else {
        const message = (err as { data?: { message?: string } })?.data?.message
        toast.error(message || 'Failed to save translations')
      }
    }
  }

  // --- Import / export --------------------------------------------------------

  const fileInput = ref<HTMLInputElement | null>(null)

  function download(filename: string, messages: FlatMessages) {
    const blob = new Blob([JSON.stringify(unflattenMessages(messages), null, 2) + '\n'], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  /** The English text of every message — the template a translator fills in. */
  function exportEnglish() {
    const messages: FlatMessages = {}
    for (const row of data.value?.entries ?? []) messages[row.key] = row.source
    download('en.json', messages)
  }

  /** Everything translated so far, unsaved changes included. */
  function exportTranslations() {
    const messages: FlatMessages = {}
    for (const row of data.value?.entries ?? []) {
      const value = valueOf(row).trim()
      if (value) messages[row.key] = value
    }
    download(`${code}.json`, messages)
  }

  /**
   * Load translations from a JSON file (the shape of the exported files) as
   * unsaved changes, so they can be reviewed before saving. Text identical to
   * the English is skipped: a returned template that was only partly filled in
   * must not turn the untouched English into "translations".
   */
  async function importFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || !data.value) return

    let incoming: FlatMessages
    try {
      incoming = flattenMessages(JSON.parse(await file.text()))
    } catch {
      toast.error('That file is not valid JSON.')
      return
    }

    let applied = 0
    for (const row of data.value.entries) {
      const value = incoming[row.key]?.trim().slice(0, MAX_LENGTH)
      if (!value || value === row.source || value === valueOf(row)) continue
      setValue(row, value)
      applied++
    }

    if (applied === 0) {
      toast.info('The file contains no new translations.')
      return
    }
    status.value = 'changed'
    toast.success(
      `${applied} ${applied === 1 ? 'translation' : 'translations'} loaded. Review them, then save.`
    )
  }

  onMounted(async () => {
    await load()
    markSaved()
  })
</script>
