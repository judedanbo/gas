<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Languages</h1>
        <p class="mt-1 max-w-3xl text-gray-600 dark:text-gray-400">
          The languages the public site is offered in. A language is only visible to visitors while
          it is switched on; text that has not been translated yet is shown in English. Changes
          reach the public site within about a minute.
        </p>
      </div>
      <button
        v-if="isAdmin && available.length > 0"
        type="button"
        class="btn btn-primary btn-sm flex-none whitespace-nowrap"
        :disabled="saving"
        @click="openAdd"
      >
        Add language
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span class="sr-only">Loading</span>
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
      role="alert"
    >
      {{ error }}
    </div>

    <div v-else class="space-y-6">
      <p
        v-if="!otherLanguagesEnabled"
        class="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        The site is currently English only. The language switcher appears for visitors once another
        language is switched on.
      </p>

      <div class="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <caption class="sr-only">
            Site languages
          </caption>
          <thead class="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th scope="col" :class="thClass">Language</th>
              <th scope="col" :class="thClass">Translated</th>
              <th scope="col" :class="thClass">On the public site</th>
              <th scope="col" :class="[thClass, 'text-right']">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="language in languages" :key="language.code">
              <th scope="row" class="px-6 py-4 text-left font-normal">
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ language.name }}
                  <span
                    v-if="language.nativeName !== language.name"
                    :lang="language.code"
                    class="font-normal text-gray-600 dark:text-gray-400"
                  >
                    · {{ language.nativeName }}
                  </span>
                </p>
                <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  <template v-if="language.isDefault">Default language · audit.gov.gh/</template>
                  <template v-else>audit.gov.gh/{{ language.code }}/</template>
                </p>
              </th>

              <td class="px-6 py-4">
                <template v-if="language.isDefault">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Source text</span>
                </template>
                <template v-else>
                  <div class="flex items-center gap-3">
                    <div
                      class="h-2 w-28 flex-none overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                      role="progressbar"
                      :aria-valuenow="percent(language)"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      :aria-label="`${language.name} translation progress`"
                    >
                      <div class="h-full bg-primary" :style="{ width: `${percent(language)}%` }" />
                    </div>
                    <span class="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {{ percent(language) }}%
                    </span>
                  </div>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {{ language.translated }} of {{ language.total }} texts
                  </p>
                </template>
              </td>

              <td class="px-6 py-4">
                <span v-if="language.isDefault" :class="[badgeClass, onBadgeClass]">Always on</span>
                <div v-else-if="isAdmin" class="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="language.isEnabled"
                    :aria-label="`Show ${language.name} on the public site`"
                    :disabled="saving"
                    :class="[
                      'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-800',
                      language.isEnabled ? 'bg-primary' : 'bg-gray-400 dark:bg-gray-600',
                      saving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    ]"
                    @click="toggle(language, !language.isEnabled)"
                  >
                    <span
                      :class="[
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out',
                        language.isEnabled ? 'translate-x-5' : 'translate-x-0'
                      ]"
                    />
                  </button>
                  <span class="text-sm text-gray-700 dark:text-gray-300" aria-hidden="true">
                    {{ language.isEnabled ? 'On' : 'Off' }}
                  </span>
                </div>
                <span
                  v-else
                  :class="[badgeClass, language.isEnabled ? onBadgeClass : offBadgeClass]"
                >
                  {{ language.isEnabled ? 'On' : 'Off' }}
                </span>
              </td>

              <td class="px-6 py-4">
                <div v-if="!language.isDefault" class="flex justify-end gap-2">
                  <NuxtLink
                    :to="`/admin/languages/${language.code}`"
                    class="btn btn-outline btn-xs whitespace-nowrap"
                    :aria-label="`Translations for ${language.name}`"
                  >
                    Translations
                  </NuxtLink>
                  <template v-if="isAdmin">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      :disabled="saving"
                      :aria-label="`Rename ${language.name}`"
                      @click="openRename(language)"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-red-700 dark:text-red-400"
                      :disabled="saving"
                      :aria-label="`Remove ${language.name}`"
                      @click="removeTarget = language"
                    >
                      Remove
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section
        aria-labelledby="languages-notes-heading"
        class="rounded-lg bg-white p-6 shadow dark:bg-gray-800"
      >
        <h2
          id="languages-notes-heading"
          class="text-lg font-semibold text-gray-900 dark:text-white"
        >
          How languages work
        </h2>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>
            A new language starts switched off, so you can translate it before visitors see it.
            While it is off, its address sends visitors to the English page.
          </li>
          <li>
            “Translations” lists every piece of interface text (menus, buttons, headings, messages)
            in English next to its translation. Anything left blank is shown in English.
          </li>
          <li>
            Removing a language also deletes the translations entered for it here. Switch it off
            instead if you may want it back.
          </li>
          <li>News, reports and other content are translated on their own edit pages, not here.</li>
        </ul>
      </section>
    </div>

    <!-- Add / rename -->
    <UiBaseModal
      v-model="formOpen"
      :title="formMode === 'add' ? 'Add language' : 'Rename language'"
    >
      <form id="language-form" class="space-y-4" @submit.prevent="submitForm">
        <AdminFormAdminSelect
          v-if="formMode === 'add'"
          id="language-code"
          v-model="form.code"
          label="Language"
          :options="availableOptions"
          required
        />
        <AdminFormAdminInput
          id="language-name"
          v-model="form.name"
          label="Name in English"
          required
          help-text="Used in the admin panel."
        />
        <AdminFormAdminInput
          id="language-native-name"
          v-model="form.nativeName"
          label="Name shown to visitors"
          required
          help-text="The language's own name, as it appears in the language switcher."
        />
        <p v-if="formMode === 'add'" class="text-sm text-gray-600 dark:text-gray-400">
          The language is added switched off. Translate it, then switch it on.
        </p>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost btn-sm" @click="formOpen = false">Cancel</button>
        <button
          type="submit"
          form="language-form"
          class="btn btn-primary btn-sm"
          :disabled="saving"
        >
          {{ formMode === 'add' ? 'Add language' : 'Save' }}
        </button>
      </template>
    </UiBaseModal>

    <AdminUiAdminConfirmDialog
      :model-value="removeTarget !== null"
      title="Remove language"
      :message="removeMessage"
      confirm-text="Remove"
      :loading="saving"
      @update:model-value="removeTarget = null"
      @confirm="confirmRemove"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminLanguage } from '~/types/admin'

  definePageMeta({ layout: 'admin' })

  const { languages, available, loading, saving, error, load, add, update, remove } =
    useAdminLanguages()
  const { hasRole } = useAdminAuth()
  const toast = useToast()

  // Adding, removing and switching a language on or off is for admins;
  // editors with the content module translate.
  const isAdmin = computed(() => hasRole('admin'))

  const thClass =
    'px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400'
  const badgeClass = 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium'
  const onBadgeClass = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  const offBadgeClass = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'

  const otherLanguagesEnabled = computed(() =>
    languages.value.some((language) => !language.isDefault && language.isEnabled)
  )

  function percent(language: AdminLanguage) {
    if (language.total === 0) return 0
    // Never round an unfinished language up to 100%.
    return Math.floor((language.translated / language.total) * 100)
  }

  /** Runs a change and reports the outcome; returns whether it succeeded. */
  async function run(action: () => Promise<void>, success: string) {
    try {
      await action()
      toast.success(success)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      return false
    }
  }

  function toggle(language: AdminLanguage, isEnabled: boolean) {
    const untranslated = language.total - language.translated
    const success = !isEnabled
      ? `${language.name} is switched off`
      : untranslated > 0
        ? `${language.name} is switched on. ${untranslated} untranslated texts show in English.`
        : `${language.name} is switched on`
    return run(() => update(language.code, { isEnabled }), success)
  }

  // --- Add / rename -----------------------------------------------------------

  const formOpen = ref(false)
  const formMode = ref<'add' | 'rename'>('add')
  const form = reactive({ code: '', name: '', nativeName: '' })

  const availableOptions = computed(() =>
    available.value.map((language) => ({
      value: language.code,
      label:
        language.nativeName === language.name
          ? language.name
          : `${language.name} (${language.nativeName})`
    }))
  )

  function openAdd() {
    formMode.value = 'add'
    form.code = available.value[0]?.code ?? ''
    formOpen.value = true
  }

  // Picking a language pre-fills its names; they stay editable.
  watch(
    () => [form.code, formOpen.value] as const,
    ([code, open]) => {
      if (!open || formMode.value !== 'add') return
      const picked = available.value.find((language) => language.code === code)
      form.name = picked?.name ?? ''
      form.nativeName = picked?.nativeName ?? ''
    }
  )

  function openRename(language: AdminLanguage) {
    formMode.value = 'rename'
    form.code = language.code
    form.name = language.name
    form.nativeName = language.nativeName
    formOpen.value = true
  }

  async function submitForm() {
    const name = form.name.trim()
    const nativeName = form.nativeName.trim()
    if (!form.code || !name || !nativeName) return

    const done =
      formMode.value === 'add'
        ? await run(
            () => add({ code: form.code, name, nativeName }),
            `${name} added. It stays off until you switch it on.`
          )
        : await run(() => update(form.code, { name, nativeName }), 'Language renamed')
    if (done) formOpen.value = false
  }

  // --- Remove -----------------------------------------------------------------

  const removeTarget = ref<AdminLanguage | null>(null)

  const removeMessage = computed(() => {
    const language = removeTarget.value
    if (!language) return ''
    const entered =
      language.overrides > 0
        ? ` The ${language.overrides} translations entered here will be deleted.`
        : ''
    return `Remove ${language.name} from the site?${entered} Visitors will no longer be able to choose it.`
  })

  async function confirmRemove() {
    const language = removeTarget.value
    if (!language) return
    await run(() => remove(language.code), `${language.name} removed`)
    removeTarget.value = null
  }

  onMounted(load)
</script>
