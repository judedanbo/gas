<template>
  <form class="space-y-6" novalidate @submit.prevent="handleSubmit">
    <div
      v-if="error || errorCount > 0"
      id="app-form-errors"
      role="alert"
      class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400"
    >
      <p v-if="error">{{ error }}</p>
      <p v-if="errorCount > 0">
        {{ errorCount === 1 ? '1 field needs' : `${errorCount} fields need` }} attention
        <template v-if="localesWithErrors.length">
          (in {{ localesWithErrors.map((l) => LOCALE_LABELS[l]).join(' and ') }})</template
        >.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <!-- Language tabs -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div
            role="tablist"
            aria-label="Language"
            class="flex border-b border-gray-200 dark:border-gray-700"
          >
            <button
              v-for="locale in LOCALES"
              :id="`app-tab-${locale}`"
              :key="locale"
              type="button"
              role="tab"
              :aria-selected="activeLocale === locale"
              :aria-controls="`app-panel-${locale}`"
              :tabindex="activeLocale === locale ? 0 : -1"
              :class="[
                'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                activeLocale === locale
                  ? 'text-primary border-b-2 border-primary -mb-px'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
              @click="activeLocale = locale"
              @keydown.right.prevent="switchTab(1)"
              @keydown.left.prevent="switchTab(-1)"
            >
              {{ LOCALE_LABELS[locale] }}
              <span v-if="locale === 'en'" class="text-red-500" aria-hidden="true">*</span>
              <span v-if="localesWithErrors.includes(locale)" class="badge badge-error ml-2">
                Needs attention
              </span>
            </button>
          </div>
          <div class="p-4 text-sm text-gray-600 dark:text-gray-400">
            <p v-if="activeLocale === 'en'">
              English is required. It is shown in every language that has no text of its own.
            </p>
            <template v-else>
              <p>
                Optional. Anything left empty here shows the English text; a section with no items
                of its own shows the English items.
              </p>
              <button type="button" class="mt-2 text-primary hover:underline" @click="copyEnglish">
                {{ akIsEmpty ? 'Start from the English text' : 'Replace with the English text' }}
              </button>
            </template>
          </div>
        </div>

        <div
          v-for="locale in LOCALES"
          v-show="activeLocale === locale"
          :id="`app-panel-${locale}`"
          :key="locale"
          role="tabpanel"
          :aria-labelledby="`app-tab-${locale}`"
          class="space-y-6"
        >
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Text ({{ LOCALE_LABELS[locale] }})
            </h2>
            <div class="space-y-4">
              <AdminFormAdminInput
                :id="`app-${locale}-name`"
                v-model="form.translations[locale].name"
                label="Name"
                :required="locale === 'en'"
                placeholder="e.g. CitizensEye"
                help-text="The page heading and the name on the app's card."
                :error="errors[`translations.${locale}.name`]"
              />
              <AdminFormAdminInput
                :id="`app-${locale}-tagline`"
                v-model="form.translations[locale].tagline"
                label="Tagline"
                placeholder="e.g. Citizen Engagement Platform for Public Accountability"
                help-text="Shown under the page heading and on the app's card."
                :error="errors[`translations.${locale}.tagline`]"
              />
              <AdminFormAdminTextarea
                :id="`app-${locale}-summary`"
                v-model="form.translations[locale].summary"
                label="Summary"
                :rows="2"
                :required="locale === 'en'"
                help-text="One or two sentences for the app's card, search results and search engines."
                :error="errors[`translations.${locale}.summary`]"
              />
              <AdminFormAdminInput
                :id="`app-${locale}-headline`"
                v-model="form.translations[locale].headline"
                label="Introduction heading"
                placeholder="e.g. Be Part of the Fight Against Financial Irregularities"
                :error="errors[`translations.${locale}.headline`]"
              />
              <AdminFormAdminRichText
                :id="`app-${locale}-body`"
                v-model="form.translations[locale].body"
                label="Introduction"
                help-text="What the app is and why to use it. Leave empty to show the summary."
                :error="errors[`translations.${locale}.body`]"
              />
              <AdminFormAdminInput
                :id="`app-${locale}-launch-label`"
                v-model="form.translations[locale].launchLabel"
                label="Button text"
                :placeholder="`Open ${displayName(locale)}`"
                help-text="Text of the button that opens the app in a new tab."
                :error="errors[`translations.${locale}.launchLabel`]"
              />
              <AdminFormAdminTextarea
                v-if="form.imageUrl"
                :id="`app-${locale}-image-alt`"
                v-model="form.translations[locale].imageAlt"
                label="Screenshot description"
                :rows="2"
                help-text="Describe the screenshot for visitors who cannot see it. Defaults to the app's name."
                :error="errors[`translations.${locale}.imageAlt`]"
              />
              <AdminFormAdminInput
                :id="`app-${locale}-cta-title`"
                v-model="form.translations[locale].ctaTitle"
                label="Closing heading"
                placeholder="Ready to get started?"
                help-text="The green band at the bottom of the page."
                :error="errors[`translations.${locale}.ctaTitle`]"
              />
              <AdminFormAdminTextarea
                :id="`app-${locale}-cta-text`"
                v-model="form.translations[locale].ctaText"
                label="Closing text"
                :rows="2"
                help-text="Leave empty to repeat the summary."
                :error="errors[`translations.${locale}.ctaText`]"
              />
            </div>
          </div>

          <AdminFormAdminAppSection
            v-for="section in SECTIONS"
            :key="`${locale}-${section.key}`"
            :model-value="sectionOf(locale, section.key)"
            :heading="section.heading"
            :description="section.description"
            :default-title="section.defaultTitle(displayName(locale))"
            :item-label="section.itemLabel"
            :fields="section.fields"
            :max="APP_SECTION_LIMITS[section.key]"
            :id-prefix="`app-${locale}-${section.key}`"
            :errors="errors"
            :error-prefix="`translations.${locale}.content.${section.key}`"
            :empty-hint="
              locale === 'en'
                ? 'No items — this section is hidden on the page.'
                : 'No Akan items — the English items are shown.'
            "
            @update:model-value="setSection(locale, section.key, $event)"
          />
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Settings</h2>
          <div class="space-y-4">
            <AdminFormAdminInput
              id="app-url"
              v-model="form.url"
              type="url"
              label="App address"
              required
              placeholder="https://tracker.audit.gov.gh"
              help-text="Where the app or website lives. The page's buttons open it in a new tab."
              :error="errors.url"
            />
            <div>
              <AdminFormAdminInput
                id="app-slug"
                v-model="form.slug"
                label="Page address"
                required
                placeholder="e.g. tracker"
                :error="errors.slug || slugCheck.reason || undefined"
                :help-text="slugHelp"
              />
              <p
                v-if="slugChanged"
                class="mt-1 text-sm text-yellow-700 dark:text-yellow-400"
                role="status"
              >
                Changing the address breaks links to {{ siteHost }}/{{ initial?.slug }}.
              </p>
            </div>
            <div>
              <AdminFormAdminFileUpload
                v-model="form.logoUrl"
                type="image"
                label="Logo"
                help-text="Shown on the app's card and page. PNG with a transparent background works best; JPEG, WebP or GIF, up to 5MB."
                :error="errors.logoUrl"
              />
              <!-- The logo as the app's card shows it, GAS fallback included. -->
              <div class="mt-2 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <span
                  class="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-xl bg-white border border-gray-200 dark:border-gray-600 p-1.5"
                >
                  <UiBaseImage
                    :src="appLogoUrl(form.logoUrl)"
                    :fallback-src="DEFAULT_APP_LOGO"
                    alt=""
                    class="max-w-full max-h-full object-contain"
                  />
                </span>
                {{
                  form.logoUrl
                    ? "How the logo looks on the app's card."
                    : 'No logo uploaded — the GAS logo is shown instead.'
                }}
              </div>
            </div>
            <AdminFormAdminInput
              id="app-sort-order"
              v-model="form.sortOrder"
              type="number"
              label="Order"
              help-text="Apps are listed from the lowest number up."
              :error="errors.sortOrder"
            />
            <AdminFormAdminSwitch
              id="app-active"
              v-model="form.isActive"
              label="Published"
              description="Switch off to hide the app's page and card from visitors."
            />
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">More</h2>
          <div class="space-y-4">
            <AdminFormAdminFileUpload
              v-model="form.imageUrl"
              type="image"
              label="Screenshot"
              help-text="Optional picture of the app for its page; without one, the page shows the logo. JPEG, PNG, WebP or GIF, up to 5MB."
              :error="errors.imageUrl"
            />
            <AdminFormAdminInput
              id="app-privacy-url"
              v-model="form.privacyUrl"
              label="Privacy notice"
              placeholder="/citizenseye/privacy or https://…"
              help-text="Optional link to the app's privacy notice, shown on its page."
              :error="errors.privacyUrl"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
    >
      <NuxtLink to="/admin/apps" class="btn btn-ghost">Cancel</NuxtLink>
      <button type="submit" class="btn btn-primary" :disabled="saving">
        {{ saving ? savingLabel : submitLabel }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
  import type { AdminServiceApp, ServiceAppInput } from '~/types/admin'
  import {
    APP_SECTION_LIMITS,
    DEFAULT_APP_LOGO,
    appLogoUrl,
    appSlugProblem,
    emptyAppTranslation,
    isEmptyAppTranslation,
    type AppSection,
    type AppSectionKey,
    type AppTranslation
  } from '~/utils/serviceApps'

  type Locale = 'en' | 'ak'

  interface Props {
    /** Existing app to edit; omit to start a new one. */
    initial?: AdminServiceApp | null
    saving?: boolean
    error?: string | null
    /** Field errors returned by the API (dot-path keyed). */
    fieldErrors?: Record<string, string>
    submitLabel: string
    savingLabel: string
  }

  const props = withDefaults(defineProps<Props>(), {
    initial: null,
    saving: false,
    error: null,
    fieldErrors: () => ({})
  })

  const emit = defineEmits<{
    submit: [payload: ServiceAppInput]
  }>()

  const LOCALES: Locale[] = ['en', 'ak']
  const LOCALE_LABELS: Record<Locale, string> = { en: 'English', ak: 'Akan' }
  const siteHost = 'audit.gov.gh'

  const SECTIONS: Array<{
    key: AppSectionKey
    heading: string
    description: string
    itemLabel: string
    defaultTitle: (name: string) => string
    fields: Array<{
      key: string
      label: string
      type: 'input' | 'textarea' | 'icon' | 'lines'
      required?: boolean
    }>
  }> = [
    {
      key: 'features',
      heading: 'Features',
      description: 'What people can do with the app.',
      itemLabel: 'Feature',
      defaultTitle: (name) => `What You Can Do with ${name}`,
      fields: [
        { key: 'icon', label: 'Icon', type: 'icon', required: true },
        { key: 'title', label: 'Title', type: 'input', required: true },
        { key: 'description', label: 'Description', type: 'textarea' }
      ]
    },
    {
      key: 'steps',
      heading: 'How it works',
      description: 'Numbered steps for getting started.',
      itemLabel: 'Step',
      defaultTitle: (name) => `How ${name} Works`,
      fields: [
        { key: 'title', label: 'Title', type: 'input', required: true },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'icon', label: 'Icon', type: 'icon' }
      ]
    },
    {
      key: 'audiences',
      heading: 'Benefits',
      description: 'Who the app is for and what each group gains.',
      itemLabel: 'Group',
      defaultTitle: (name) => `Why Use ${name}?`,
      fields: [
        { key: 'icon', label: 'Icon', type: 'icon', required: true },
        { key: 'title', label: 'Group', type: 'input', required: true },
        { key: 'points', label: 'Benefits', type: 'lines', required: true }
      ]
    },
    {
      key: 'highlights',
      heading: 'Highlights',
      description: 'A grid of short items, such as what can be reported.',
      itemLabel: 'Highlight',
      defaultTitle: () => 'At a Glance',
      fields: [
        { key: 'icon', label: 'Icon', type: 'icon', required: true },
        { key: 'title', label: 'Text', type: 'input', required: true }
      ]
    },
    {
      key: 'faqs',
      heading: 'Questions and answers',
      description: 'Frequently asked questions, shown as an expandable list.',
      itemLabel: 'Question',
      defaultTitle: () => 'Frequently Asked Questions',
      fields: [
        { key: 'question', label: 'Question', type: 'input', required: true },
        { key: 'answer', label: 'Answer', type: 'textarea', required: true }
      ]
    }
  ]

  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

  const form = reactive({
    slug: props.initial?.slug ?? '',
    url: props.initial?.url ?? '',
    logoUrl: props.initial?.logoUrl ?? '',
    imageUrl: props.initial?.imageUrl ?? '',
    privacyUrl: props.initial?.privacyUrl ?? '',
    sortOrder: props.initial?.sortOrder ?? 0,
    isActive: props.initial?.isActive ?? true,
    translations: {
      en: clone(props.initial?.translations.en ?? emptyAppTranslation()),
      ak: clone(props.initial?.translations.ak ?? emptyAppTranslation())
    } as Record<Locale, AppTranslation>
  })

  const activeLocale = ref<Locale>('en')

  function switchTab(step: number) {
    const index = (LOCALES.indexOf(activeLocale.value) + step + LOCALES.length) % LOCALES.length
    activeLocale.value = LOCALES[index]
    nextTick(() => document.getElementById(`app-tab-${activeLocale.value}`)?.focus())
  }

  function displayName(locale: Locale): string {
    return form.translations[locale].name.trim() || form.translations.en.name.trim() || 'the app'
  }

  function sectionOf(locale: Locale, key: AppSectionKey) {
    return form.translations[locale].content[key] as AppSection<Record<string, unknown>>
  }

  function setSection(locale: Locale, key: AppSectionKey, value: AppSection<unknown>) {
    ;(form.translations[locale].content as unknown as Record<string, unknown>)[key] = value
  }

  const akIsEmpty = computed(() => isEmptyAppTranslation(form.translations.ak))

  function copyEnglish() {
    if (
      !akIsEmpty.value &&
      !window.confirm('Replace everything entered in Akan with the English text?')
    ) {
      return
    }
    form.translations.ak = clone(form.translations.en)
  }

  // ── Page address ────────────────────────────────────────────────────────

  const slugChanged = computed(() => !!props.initial && form.slug.trim() !== props.initial.slug)

  const slugCheck = reactive<{ checking: boolean; reason: string | null }>({
    checking: false,
    reason: null
  })

  const slugHelp = computed(() => {
    const slug = form.slug.trim().toLowerCase()
    if (slugCheck.checking) return 'Checking…'
    return slug
      ? `The app's page will be at ${siteHost}/${slug}`
      : 'Lowercase letters, numbers and hyphens, e.g. tracker'
  })

  const api = useAdminApi()
  let slugTimer: ReturnType<typeof setTimeout> | null = null
  let slugRequest = 0

  watch(
    () => form.slug,
    (value) => {
      // Anything typed supersedes a check still in flight.
      slugRequest++
      slugCheck.checking = false
      slugCheck.reason = null
      if (slugTimer) clearTimeout(slugTimer)
      const slug = value.trim().toLowerCase()
      if (!slug || slug === props.initial?.slug) return
      const local = appSlugProblem(slug)
      if (local) {
        slugCheck.reason = local
        return
      }
      slugTimer = setTimeout(() => checkSlug(slug), 400)
    }
  )

  async function checkSlug(slug: string) {
    const request = ++slugRequest
    slugCheck.checking = true
    try {
      const response = await api.get<{ available: boolean; reason?: string }>('apps/check-slug', {
        slug,
        excludeId: props.initial?.id
      })
      if (request === slugRequest)
        slugCheck.reason = response.available ? null : (response.reason ?? null)
    } catch {
      // The save will report it if the address is taken.
    } finally {
      if (request === slugRequest) slugCheck.checking = false
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────

  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()

  const errorCount = computed(() => Object.keys(errors).length)
  const localesWithErrors = computed(() =>
    LOCALES.filter((locale) =>
      Object.keys(errors).some((key) => key.startsWith(`translations.${locale}.`))
    )
  )

  // A field's error goes away as soon as the admin changes that field. Page
  // text is nested (…content.faqs.items.2.answer), so remember each errored
  // value and drop the error once it differs.
  const erroredValues = new Map<string, string>()

  function valueAt(path: string): string {
    const value = path
      .split('.')
      .reduce<unknown>(
        (current, key) =>
          current && typeof current === 'object'
            ? (current as Record<string, unknown>)[key]
            : undefined,
        form
      )
    return JSON.stringify(value) ?? ''
  }

  function rememberErrors() {
    erroredValues.clear()
    for (const key of Object.keys(errors)) erroredValues.set(key, valueAt(key))
  }

  watch(
    form,
    () => {
      for (const key of Object.keys(errors)) {
        if (valueAt(key) !== erroredValues.get(key)) clearFieldError(key)
      }
    },
    { deep: true }
  )

  watch(
    () => props.fieldErrors,
    (fieldErrors) => {
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
        rememberErrors()
        showFirstError()
      }
    }
  )

  function linkRule(allowPath: boolean, message: string) {
    return (value: unknown): true | string => {
      const link = String(value ?? '').trim()
      if (!link) return true
      if (allowPath && link.startsWith('/') && !link.startsWith('//')) return true
      return /^https?:\/\/.+/.test(link) || message
    }
  }

  function buildRules() {
    const result: Record<string, Array<(value: unknown) => true | string>> = {
      url: [
        rules.required,
        linkRule(false, 'Enter a full web address, e.g. https://tracker.audit.gov.gh')
      ],
      slug: [
        (value) =>
          appSlugProblem(
            String(value ?? '')
              .trim()
              .toLowerCase()
          ) ?? true
      ],
      privacyUrl: [
        linkRule(true, 'Enter a path on this site (e.g. /citizenseye/privacy) or a full URL')
      ],
      'translations.en.name': [rules.required],
      'translations.en.summary': [rules.required]
    }
    // Every item's required fields, in both languages.
    for (const locale of LOCALES) {
      for (const section of SECTIONS) {
        const items = form.translations[locale].content[section.key].items as Array<
          Record<string, unknown>
        >
        items.forEach((_item, index) => {
          for (const field of section.fields) {
            if (!field.required) continue
            result[`translations.${locale}.content.${section.key}.items.${index}.${field.key}`] = [
              field.type === 'lines'
                ? (value) =>
                    (Array.isArray(value) && value.some((line) => String(line).trim())) ||
                    'Enter at least one benefit'
                : rules.required
            ]
          }
        })
      }
    }
    return result
  }

  async function showFirstError() {
    const first = Object.keys(errors)[0]
    if (!first) return
    const match = /^translations\.(en|ak)\./.exec(first)
    if (match) activeLocale.value = match[1] as Locale
    await nextTick()
    document.getElementById('app-form-errors')?.scrollIntoView({ block: 'center' })
  }

  /** Trim lines and drop empty benefit points. */
  function cleanTranslation(text: AppTranslation): AppTranslation {
    const copy = clone(text)
    for (const audience of copy.content.audiences.items) {
      audience.points = audience.points.map((point) => point.trim()).filter(Boolean)
    }
    return copy
  }

  function handleSubmit() {
    if (!validate(form, buildRules()) || slugCheck.reason) {
      if (slugCheck.reason) errors.slug = slugCheck.reason
      rememberErrors()
      showFirstError()
      return
    }

    const ak = cleanTranslation(form.translations.ak)
    emit('submit', {
      slug: form.slug.trim().toLowerCase(),
      url: form.url.trim(),
      logoUrl: form.logoUrl || null,
      imageUrl: form.imageUrl || null,
      privacyUrl: form.privacyUrl.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      translations: {
        en: cleanTranslation(form.translations.en),
        ...(isEmptyAppTranslation(ak) ? {} : { ak })
      }
    })
  }
</script>
