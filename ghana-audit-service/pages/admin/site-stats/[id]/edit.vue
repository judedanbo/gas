<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Statistic not found</h2>
      <NuxtLink to="/admin/site-stats" class="btn btn-primary">Back to Site Statistics</NuxtLink>
    </div>
    <template v-else>
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/site-stats"
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Statistic</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            {{ sectionLabel }} · <span class="font-mono text-sm">{{ currentItem.statKey }}</span>
          </p>
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
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Display</h2>
              <div class="space-y-4">
                <AdminFormAdminInput
                  v-model="form.label"
                  label="Label"
                  required
                  help-text="Shown beneath the figure."
                  :error="errors.label"
                />
                <div class="grid grid-cols-2 gap-4">
                  <AdminFormAdminInput
                    v-model="form.suffix"
                    label="Suffix"
                    placeholder="e.g. +"
                    help-text="Appended after the number."
                  />
                  <AdminFormAdminInput
                    v-model="form.displayOrder"
                    label="Display Order"
                    type="number"
                    help-text="Lower numbers appear first."
                  />
                </div>
                <AdminFormAdminInput
                  v-if="currentItem.icon !== null || form.icon"
                  v-model="form.icon"
                  label="Icon"
                  placeholder="e.g. heroicons:user"
                  help-text="Heroicon name (this section shows icons). Leave blank for none."
                />
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Value</h2>
              <div class="space-y-4">
                <AdminFormAdminSelect
                  v-model="form.source"
                  label="Data source"
                  :options="sourceOptions"
                  help-text="Where the displayed value comes from."
                />

                <template v-if="form.source === 'hr_api'">
                  <AdminFormAdminInput
                    v-model="form.hrMetricKey"
                    label="HR metric key"
                    placeholder="e.g. staff_total"
                    help-text="The metric name returned by the HR API to map to this figure."
                    :error="errors.hrMetricKey"
                  />
                  <div
                    class="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/40 px-4 py-3 text-sm"
                  >
                    <span class="text-gray-600 dark:text-gray-300">Last synced value from HR</span>
                    <span class="font-semibold text-gray-900 dark:text-white tabular-nums">
                      {{ currentItem.apiValue ?? '—' }}
                      <span class="text-gray-400 font-normal">{{ lastSyncedLabel }}</span>
                    </span>
                  </div>
                  <AdminFormAdminSwitch
                    v-model="form.overrideEnabled"
                    label="Manual override"
                    description="Ignore the HR value and show the manual value below instead."
                  />
                </template>

                <AdminFormAdminInput
                  v-model="form.manualValue"
                  :label="manualValueLabel"
                  type="number"
                  required
                  :help-text="manualValueHelp"
                  :error="errors.manualValue"
                />

                <div
                  class="flex items-center justify-between rounded-lg bg-primary/5 dark:bg-primary/10 px-4 py-3"
                >
                  <span class="text-sm text-gray-600 dark:text-gray-300">Will display as</span>
                  <span class="text-xl font-bold text-primary dark:text-accent tabular-nums">
                    {{ previewValue }}{{ form.suffix || '' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Settings</h2>
              <AdminFormAdminSwitch
                v-model="form.isActive"
                label="Active"
                description="Show this figure on the public website."
              />
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <NuxtLink to="/admin/site-stats" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminSiteStat, SiteStatSection, SiteStatUpdateInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminSiteStat>('site-stats')
  const { errors, validate, setErrors, rules } = useFormValidation()

  const form = reactive<SiteStatUpdateInput>({
    label: '',
    suffix: '',
    icon: '',
    source: 'manual',
    hrMetricKey: '',
    manualValue: 0,
    overrideEnabled: false,
    displayOrder: 0,
    isActive: true
  })

  const validationRules = {
    label: [rules.required],
    manualValue: [rules.required]
  }

  const sourceOptions = [
    { value: 'manual', label: 'Manual (entered here)' },
    { value: 'hr_api', label: 'HR application (pulled via API)' }
  ]

  const SECTION_LABELS: Record<SiteStatSection, string> = {
    home: 'Home Page',
    about_service: 'About — The Service',
    about_legacy: 'About — Past Auditors-General'
  }
  const sectionLabel = computed(() =>
    currentItem.value ? SECTION_LABELS[currentItem.value.section] : ''
  )

  const manualValueLabel = computed(() =>
    form.source === 'hr_api' ? 'Manual / override value' : 'Value'
  )
  const manualValueHelp = computed(() =>
    form.source === 'hr_api'
      ? 'Used when the override is on, or until the HR API has provided a value.'
      : 'The figure to display.'
  )

  const previewValue = computed(() => {
    const useApi =
      form.source === 'hr_api' && !form.overrideEnabled && currentItem.value?.apiValue != null
    return useApi ? currentItem.value?.apiValue : Number(form.manualValue) || 0
  })

  const lastSyncedLabel = computed(() => {
    if (!currentItem.value?.apiSyncedAt) return '(never synced)'
    const d = new Date(currentItem.value.apiSyncedAt)
    return `(synced ${d.toLocaleDateString()})`
  })

  onMounted(async () => {
    const item = await fetchOne(id)
    if (item) {
      form.label = item.label
      form.suffix = item.suffix || ''
      form.icon = item.icon || ''
      form.source = item.source
      form.hrMetricKey = item.hrMetricKey || ''
      form.manualValue = item.manualValue
      form.overrideEnabled = item.overrideEnabled
      form.displayOrder = item.displayOrder
      form.isActive = item.isActive
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await update(id, {
      label: form.label,
      suffix: form.suffix || null,
      icon: form.icon || null,
      source: form.source,
      hrMetricKey: form.hrMetricKey || null,
      manualValue: Number(form.manualValue) || 0,
      overrideEnabled: form.overrideEnabled,
      displayOrder: Number(form.displayOrder) || 0,
      isActive: form.isActive
    })
    if (result) {
      router.push('/admin/site-stats')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
