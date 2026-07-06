<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/admin/board-members"
        aria-label="Go back"
        class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </NuxtLink>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Add Board Member</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Add a new member of the governing board</p>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <div
        v-if="error"
        class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400"
      >
        {{ error }}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Member Details</h2>
            <div class="space-y-4">
              <AdminFormAdminInput
                v-model="form.name"
                label="Full Name"
                required
                :error="errors.name"
              />
              <AdminFormAdminInput
                v-model="form.title"
                label="Title / Position"
                placeholder="e.g., Board Chairperson"
                :error="errors.title"
              />
              <AdminFormAdminTextarea
                v-model="form.bio"
                label="Biography"
                :rows="12"
                placeholder="Use ## Heading lines to create sections (e.g. ## Career Background)"
                help-text="Plain text. Start a line with '## ' to begin a new titled section on the public profile."
                :error="errors.bio"
              />
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Settings</h2>
            <div class="space-y-4">
              <AdminFormAdminSelect
                v-model="form.role"
                label="Role"
                :options="roleOptions"
                required
                :error="errors.role"
              />
              <div>
                <AdminFormAdminInput
                  v-model="form.slug"
                  label="Slug"
                  required
                  help-text="URL-friendly identifier (auto-generated from name)"
                  :error="errors.slug || slugError"
                  @update:model-value="onSlugInput"
                >
                  <template #suffix>
                    <span v-if="isCheckingSlug" class="text-gray-400">
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        />
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    </span>
                    <span v-else-if="isSlugAvailable === true" class="text-green-500">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    <span v-else-if="isSlugAvailable === false" class="text-red-500">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </span>
                  </template>
                </AdminFormAdminInput>
                <p v-if="slugSuggestion" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Suggestion:
                  <button
                    type="button"
                    class="text-primary hover:underline"
                    @click="useSlugSuggestion"
                  >
                    {{ slugSuggestion }}
                  </button>
                </p>
              </div>
              <AdminFormAdminInput
                v-model="form.email"
                label="Email"
                type="email"
                placeholder="email@audit.gov.gh"
                :error="errors.email"
              />
              <AdminFormAdminInput
                v-model="form.phone"
                label="Phone"
                placeholder="+233 XXX XXX XXX"
              />
              <AdminFormAdminFileUpload
                v-model="form.photo"
                type="image"
                label="Photo"
                help-text="Upload a professional photo (max 5MB, JPG/PNG/WebP)"
                :error="errors.photo"
              />
              <AdminFormAdminInput
                v-model="form.displayOrder"
                label="Display Order"
                type="number"
                help-text="Lower numbers appear first"
              />
              <AdminFormAdminSwitch
                v-model="form.isActive"
                label="Active"
                description="Show this member on the public website"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <NuxtLink to="/admin/board-members" class="btn btn-ghost">Cancel</NuxtLink>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create Member' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminBoardMember, BoardMemberInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } = useAdminCrud<AdminBoardMember>('board-members')
  const { errors, validate, setErrors, rules } = useFormValidation()

  // Slug checking state
  const isCheckingSlug = ref(false)
  const isSlugAvailable = ref<boolean | null>(null)
  const slugSuggestion = ref<string | null>(null)
  // Once the admin edits the slug directly, stop auto-generating it from the name
  const slugManuallyEdited = ref(false)
  const slugError = computed(() =>
    isSlugAvailable.value === false ? 'This slug is already taken' : undefined
  )

  let slugCheckTimeout: ReturnType<typeof setTimeout> | null = null

  const form = reactive<BoardMemberInput>({
    slug: '',
    role: 'member',
    name: '',
    title: '',
    bio: '',
    photo: '',
    email: '',
    phone: '',
    displayOrder: 0,
    isActive: true
  })

  const validationRules = {
    name: [rules.required],
    slug: [rules.required],
    role: [rules.required]
  }

  const roleOptions = [
    { value: 'chairperson', label: 'Chairperson' },
    { value: 'member', label: 'Member' }
  ]

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  async function checkSlugAvailability(slug: string) {
    if (!slug) {
      isSlugAvailable.value = null
      slugSuggestion.value = null
      return
    }

    isCheckingSlug.value = true
    isSlugAvailable.value = null
    slugSuggestion.value = null

    try {
      const { get } = useAdminApi()
      const response = await get<{ available: boolean; suggestion?: string }>(
        'board-members/check-slug',
        { slug }
      )
      isSlugAvailable.value = response.available
      slugSuggestion.value = response.suggestion || null
    } catch {
      isSlugAvailable.value = null
    } finally {
      isCheckingSlug.value = false
    }
  }

  function handleSlugChange(value: string | number) {
    const slugValue = String(value)
    if (slugCheckTimeout) clearTimeout(slugCheckTimeout)
    slugCheckTimeout = setTimeout(() => checkSlugAvailability(slugValue), 300)
  }

  // Direct edits to the slug field — flag so the name watcher stops overwriting it
  function onSlugInput(value: string | number) {
    slugManuallyEdited.value = true
    handleSlugChange(value)
  }

  function useSlugSuggestion() {
    if (slugSuggestion.value) {
      form.slug = slugSuggestion.value
      isSlugAvailable.value = true
      slugSuggestion.value = null
      slugManuallyEdited.value = true
    }
  }

  // Auto-generate slug from name until the admin edits the slug manually
  watch(
    () => form.name,
    (name) => {
      if (name && !slugManuallyEdited.value) {
        const newSlug = generateSlug(name)
        form.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await create({
      ...form,
      displayOrder: Number(form.displayOrder) || 0,
      title: form.title || null,
      bio: form.bio || null,
      photo: form.photo || null,
      email: form.email || null,
      phone: form.phone || null
    })
    if (result) {
      router.push('/admin/board-members')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
