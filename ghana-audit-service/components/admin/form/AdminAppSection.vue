<template>
  <details
    class="group bg-white dark:bg-gray-800 rounded-lg shadow"
    :open="open"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary
      class="flex items-center justify-between gap-4 p-6 cursor-pointer list-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span>
        <span class="block text-lg font-semibold text-gray-900 dark:text-white">
          {{ heading }}
          <span class="text-sm font-normal text-gray-500 dark:text-gray-400">
            ({{ modelValue.items.length }} {{ modelValue.items.length === 1 ? 'item' : 'items' }})
          </span>
        </span>
        <span v-if="description" class="block text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ description }}
        </span>
      </span>
      <span class="flex items-center gap-3">
        <span v-if="hasErrors" class="badge badge-error">Needs attention</span>
        <svg
          class="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </span>
    </summary>

    <div class="px-6 pb-6 space-y-4">
      <AdminFormAdminInput
        :id="`${idPrefix}-title`"
        :model-value="modelValue.title"
        label="Heading"
        :placeholder="defaultTitle"
        :help-text="`Leave empty to use “${defaultTitle}”.`"
        :error="errors[`${errorPrefix}.title`]"
        @update:model-value="update({ title: String($event) })"
      />
      <AdminFormAdminTextarea
        :id="`${idPrefix}-intro`"
        :model-value="modelValue.intro"
        label="Introduction"
        :rows="2"
        help-text="Optional sentence under the heading."
        :error="errors[`${errorPrefix}.intro`]"
        @update:model-value="update({ intro: $event })"
      />

      <p
        v-if="errors[`${errorPrefix}.items`]"
        class="text-sm text-error dark:text-error-light"
        role="alert"
      >
        {{ errors[`${errorPrefix}.items`] }}
      </p>

      <ol class="space-y-4 list-none p-0 m-0">
        <li
          v-for="(item, index) in modelValue.items"
          :key="keys[index]"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <fieldset class="relative space-y-3">
            <legend class="text-sm font-semibold text-gray-700 dark:text-gray-200 pr-28">
              {{ itemLabel }} {{ index + 1 }}
            </legend>
            <div class="absolute top-0 right-0 !mt-0">
              <div class="flex items-center gap-1">
                <button
                  :id="`${idPrefix}-item-${index}-up`"
                  type="button"
                  class="p-1.5 rounded text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="index === 0"
                  :aria-label="`Move ${itemLabel.toLowerCase()} ${index + 1} up`"
                  @click="move(index, -1)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
                <button
                  :id="`${idPrefix}-item-${index}-down`"
                  type="button"
                  class="p-1.5 rounded text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="index === modelValue.items.length - 1"
                  :aria-label="`Move ${itemLabel.toLowerCase()} ${index + 1} down`"
                  @click="move(index, 1)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  :aria-label="`Remove ${itemLabel.toLowerCase()} ${index + 1}`"
                  @click="remove(index)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <template v-for="field in fields" :key="field.key">
              <AdminFormAdminIconSelect
                v-if="field.type === 'icon'"
                :id="`${idPrefix}-item-${index}-${field.key}`"
                :model-value="String(item[field.key] ?? '')"
                :label="field.label"
                :required="field.required"
                :allow-none="!field.required"
                :error="fieldError(index, field.key)"
                @update:model-value="updateItem(index, field.key, $event)"
              />
              <AdminFormAdminTextarea
                v-else-if="field.type === 'textarea'"
                :id="`${idPrefix}-item-${index}-${field.key}`"
                :model-value="String(item[field.key] ?? '')"
                :label="field.label"
                :rows="3"
                :required="field.required"
                :error="fieldError(index, field.key)"
                @update:model-value="updateItem(index, field.key, $event)"
              />
              <AdminFormAdminTextarea
                v-else-if="field.type === 'lines'"
                :id="`${idPrefix}-item-${index}-${field.key}`"
                :model-value="((item[field.key] as string[] | undefined) ?? []).join('\n')"
                :label="field.label"
                :rows="5"
                :required="field.required"
                help-text="One per line."
                :error="fieldError(index, field.key)"
                @update:model-value="updateItem(index, field.key, $event.split('\n'))"
              />
              <AdminFormAdminInput
                v-else
                :id="`${idPrefix}-item-${index}-${field.key}`"
                :model-value="String(item[field.key] ?? '')"
                :label="field.label"
                :required="field.required"
                :error="fieldError(index, field.key)"
                @update:model-value="updateItem(index, field.key, String($event))"
              />
            </template>
          </fieldset>
        </li>
      </ol>

      <button
        :id="`${idPrefix}-add`"
        type="button"
        class="btn btn-outline btn-sm inline-flex items-center gap-2"
        :disabled="modelValue.items.length >= max"
        @click="add"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add {{ itemLabel.toLowerCase() }}
      </button>
      <p v-if="modelValue.items.length >= max" class="text-sm text-gray-500 dark:text-gray-400">
        This section holds at most {{ max }} items.
      </p>
      <p v-else-if="modelValue.items.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
        {{ emptyHint }}
      </p>
    </div>
  </details>
</template>

<script setup lang="ts">
  import type { AppSection } from '~/utils/serviceApps'

  interface AppSectionField {
    key: string
    label: string
    type: 'input' | 'textarea' | 'icon' | 'lines'
    required?: boolean
  }

  type Item = Record<string, unknown>

  interface Props {
    modelValue: AppSection<Item>
    heading: string
    description?: string
    /** Heading the public page uses when none is entered. */
    defaultTitle: string
    /** Singular name of an item, e.g. "Feature". */
    itemLabel: string
    fields: AppSectionField[]
    max: number
    /** Unique per section and language, for element ids. */
    idPrefix: string
    /** The form's dot-path keyed errors. */
    errors?: Record<string, string>
    /** Where this section's errors live, e.g. translations.en.content.features */
    errorPrefix: string
    /** Shown when the section has no items. */
    emptyHint?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    description: undefined,
    errors: () => ({}),
    emptyHint: 'No items — this section is hidden on the page.'
  })

  const emit = defineEmits<{
    'update:modelValue': [value: AppSection<Item>]
  }>()

  // Stable keys for the items, so moving one doesn't remount the others'
  // inputs (and drop the focus) mid-edit.
  let nextKey = 0
  const keys = ref<number[]>(props.modelValue.items.map(() => nextKey++))
  watch(
    () => props.modelValue.items.length,
    (length) => {
      if (keys.value.length !== length) keys.value = Array.from({ length }, () => nextKey++)
    }
  )

  const open = ref(false)

  const hasErrors = computed(() =>
    Object.keys(props.errors).some((key) => key.startsWith(`${props.errorPrefix}.`))
  )

  // Open the section when a save reports a problem inside it.
  watch(hasErrors, (value) => {
    if (value) open.value = true
  })

  function fieldError(index: number, key: string): string | undefined {
    const base = `${props.errorPrefix}.items.${index}.${key}`
    if (props.errors[base]) return props.errors[base]
    // Lines (benefit points) report per line: …points.2
    const nested = Object.keys(props.errors).find((k) => k.startsWith(`${base}.`))
    return nested ? props.errors[nested] : undefined
  }

  function update(patch: Partial<AppSection<Item>>) {
    emit('update:modelValue', { ...props.modelValue, ...patch })
  }

  function updateItem(index: number, key: string, value: unknown) {
    const items = props.modelValue.items.slice()
    items[index] = { ...items[index], [key]: value }
    update({ items })
  }

  function blankItem(): Item {
    return Object.fromEntries(
      props.fields.map((field) => [field.key, field.type === 'lines' ? [] : ''])
    )
  }

  async function add() {
    keys.value = [...keys.value, nextKey++]
    update({ items: [...props.modelValue.items, blankItem()] })
    open.value = true
    await nextTick()
    const firstField = props.fields[0]
    if (firstField) {
      document
        .getElementById(
          `${props.idPrefix}-item-${props.modelValue.items.length - 1}-${firstField.key}`
        )
        ?.focus()
    }
  }

  async function remove(index: number) {
    const nextKeys = keys.value.slice()
    nextKeys.splice(index, 1)
    keys.value = nextKeys
    const items = props.modelValue.items.slice()
    items.splice(index, 1)
    update({ items })
    await nextTick()
    document.getElementById(`${props.idPrefix}-add`)?.focus()
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= props.modelValue.items.length) return
    const items = props.modelValue.items.slice()
    ;[items[index], items[target]] = [items[target], items[index]]
    const nextKeys = keys.value.slice()
    ;[nextKeys[index], nextKeys[target]] = [nextKeys[target], nextKeys[index]]
    keys.value = nextKeys
    update({ items })
    // Keep the focus on the item that moved.
    await nextTick()
    const same = document.getElementById(
      `${props.idPrefix}-item-${target}-${direction < 0 ? 'up' : 'down'}`
    ) as HTMLButtonElement | null
    const other = document.getElementById(
      `${props.idPrefix}-item-${target}-${direction < 0 ? 'down' : 'up'}`
    ) as HTMLButtonElement | null
    ;(same && !same.disabled ? same : other)?.focus()
  }
</script>
