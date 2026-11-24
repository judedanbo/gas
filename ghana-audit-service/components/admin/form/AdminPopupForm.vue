<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div
      v-if="error"
      role="alert"
      class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400"
    >
      {{ error }}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Content</h2>
          <div class="space-y-4">
            <AdminFormAdminInput
              id="popup-title"
              v-model="form.title"
              label="Title"
              required
              help-text="Identifies the pop-up in this list and is announced to screen-reader users. Not shown on the image."
              :error="errors.title"
            />
            <AdminFormAdminFileUpload
              v-model="form.imageUrl"
              type="popup"
              label="Image"
              required
              :help-text="`Must be exactly ${POPUP_IMAGE_SIZE_LABEL} pixels. JPEG, PNG, WebP or GIF, up to 5MB.`"
              :error="errors.imageUrl"
            />
            <AdminFormAdminTextarea
              id="popup-alt-text"
              v-model="form.altText"
              label="Image description"
              :rows="2"
              help-text="Describe the image, including any text in it, for visitors who cannot see it. Defaults to the title."
              :error="errors.altText"
            />
            <AdminFormAdminInput
              id="popup-link"
              v-model="form.linkUrl"
              label="Link"
              placeholder="/reports or https://example.com"
              help-text="Where the image takes visitors when clicked: a page on this site (starting with /) or a full URL. Leave empty for no link."
              :error="errors.linkUrl"
            />
            <AdminFormAdminSwitch
              id="popup-new-tab"
              v-model="form.openInNewTab"
              label="Open link in a new tab"
              description="Recommended for links to other websites."
            />
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule</h2>
          <div class="space-y-4">
            <UiDateTimePicker
              v-model="form.startsAt"
              label="Starts"
              mode="datetime"
              help-text="Ghana time (GMT). Leave empty to start straight away."
              :error="errors.startsAt"
            />
            <UiDateTimePicker
              v-model="form.endsAt"
              label="Ends"
              mode="datetime"
              help-text="Ghana time (GMT). Leave empty to run until switched off."
              :error="errors.endsAt"
            />
            <button
              v-if="form.startsAt || form.endsAt"
              type="button"
              class="text-sm text-primary hover:underline"
              @click="clearSchedule"
            >
              Clear schedule
            </button>
            <AdminFormAdminSwitch
              id="popup-active"
              v-model="form.isActive"
              label="Active"
              description="Switch off to hide the pop-up regardless of its schedule."
            />
            <p class="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
              {{ statusSummary }}
            </p>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Behaviour</h2>
          <div class="space-y-4">
            <AdminFormAdminInput
              id="popup-display-seconds"
              v-model="form.displaySeconds"
              type="number"
              label="Display time (seconds)"
              required
              :help-text="`How long the pop-up stays up on each page load before closing itself (1–${MAX_DISPLAY_SECONDS}).`"
              :error="errors.displaySeconds"
            />
            <AdminFormAdminSwitch
              id="popup-dismissible"
              v-model="form.isDismissible"
              label="Visitors can close it"
              description="Adds a close button. When off, the pop-up stays until the display time runs out."
            />
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
    >
      <NuxtLink to="/admin/popups" class="btn btn-ghost">Cancel</NuxtLink>
      <button type="submit" class="btn btn-primary" :disabled="saving">
        {{ saving ? savingLabel : submitLabel }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
  import type { AdminPopup, PopupInput } from '~/types/admin'
  import { POPUP_IMAGE_SIZE_LABEL } from '~/utils/popupImage'

  // Keep in step with popupSchema in server/utils/validation.ts
  const DEFAULT_DISPLAY_SECONDS = 30
  const MAX_DISPLAY_SECONDS = 300

  interface Props {
    /** Existing pop-up to edit; omit to start from the defaults. */
    initial?: AdminPopup | null
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
    submit: [payload: PopupInput]
  }>()

  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()

  const form = reactive({
    title: props.initial?.title ?? '',
    imageUrl: props.initial?.imageUrl ?? '',
    altText: props.initial?.altText ?? '',
    linkUrl: props.initial?.linkUrl ?? '',
    openInNewTab: props.initial?.openInNewTab ?? false,
    startsAt: props.initial?.startsAt ?? '',
    endsAt: props.initial?.endsAt ?? '',
    displaySeconds: props.initial?.displaySeconds ?? DEFAULT_DISPLAY_SECONDS,
    isDismissible: props.initial?.isDismissible ?? false,
    isActive: props.initial?.isActive ?? true
  })

  const validationRules = {
    title: [rules.required],
    imageUrl: [rules.required],
    linkUrl: [
      (value: unknown): true | string => {
        const link = String(value ?? '').trim()
        if (!link) return true
        const ok = (link.startsWith('/') && !link.startsWith('//')) || /^https?:\/\/.+/.test(link)
        return ok || 'Enter a path on this site (e.g. /reports) or a full http(s) URL'
      }
    ],
    displaySeconds: [
      (value: unknown): true | string => {
        const seconds = Number(value)
        return (
          (Number.isInteger(seconds) && seconds >= 1 && seconds <= MAX_DISPLAY_SECONDS) ||
          `Enter a whole number from 1 to ${MAX_DISPLAY_SECONDS}`
        )
      }
    ],
    endsAt: [
      (value: unknown): true | string => {
        if (!value || !form.startsAt) return true
        return (
          new Date(String(value)).getTime() > new Date(form.startsAt).getTime() ||
          'End must be after the start'
        )
      }
    ]
  }

  const statusSummary = computed(() => {
    switch (getPopupStatus(form)) {
      case 'inactive':
        return 'Inactive — visitors will not see this pop-up.'
      case 'scheduled':
        return 'Scheduled — it will appear once the start time is reached.'
      case 'ended':
        return 'The end time has passed — visitors will not see this pop-up.'
      default:
        return form.endsAt
          ? 'Live — showing on every page load until the end time.'
          : 'Live — showing on every page load until switched off.'
    }
  })

  // A field's error goes away as soon as the admin changes that field.
  for (const field of Object.keys(form) as Array<keyof typeof form>) {
    watch(
      () => form[field],
      () => clearFieldError(field)
    )
  }

  function clearSchedule() {
    form.startsAt = ''
    form.endsAt = ''
  }

  watch(
    () => props.fieldErrors,
    (fieldErrors) => {
      if (fieldErrors && Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
    }
  )

  function handleSubmit() {
    if (!validate(form, validationRules)) return

    emit('submit', {
      title: form.title.trim(),
      imageUrl: form.imageUrl,
      altText: form.altText.trim() || null,
      linkUrl: form.linkUrl.trim() || null,
      openInNewTab: form.openInNewTab,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      displaySeconds: Number(form.displaySeconds),
      isDismissible: form.isDismissible,
      isActive: form.isActive
    })
  }
</script>
