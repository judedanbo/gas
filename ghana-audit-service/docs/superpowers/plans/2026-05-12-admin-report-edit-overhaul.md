# Admin Report Edit Page Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the admin report edit page with sticky save bar, unsaved changes detection, embedded PDF preview, TipTap rich text editor, audit trail timeline, toast notifications, skeleton loading, and sidebar reorganization.

**Architecture:** Infrastructure-first approach — build the reusable composables and components (toast, unsaved changes, rich text) first, then the new API endpoint (history), then assemble everything in the edit page overhaul. Each infrastructure piece is independently testable.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, TipTap (rich text), Drizzle ORM (MySQL), Tailwind CSS, Vitest (tests)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `composables/useToast.ts` | Singleton toast notification queue with auto-dismiss |
| `components/ui/ToastContainer.vue` | Renders toast stack, fixed top-right, slide-in transitions |
| `composables/useUnsavedChanges.ts` | Deep-compare form snapshots, beforeunload + route leave guards |
| `components/admin/form/AdminRichText.vue` | TipTap wrapper: toolbar + editor with v-model, error/disabled states |
| `components/admin/form/AdminTranslationTabs.vue` | Modified — richtext field type renders AdminRichText instead of textarea |
| `server/api/admin/reports/[id]/history.get.ts` | Audit log query joined with users, returns timeline data |
| `pages/admin/reports/[id]/edit.vue` | Full overhaul — skeleton, sidebar reorg, PDF preview, sticky bar, history |
| `pages/admin/reports/create.vue` | Summary field type change to richtext |
| `layouts/admin.vue` | Mount `<UiToastContainer />` |

---

### Task 1: Toast Notification System

**Files:**
- Create: `composables/useToast.ts`
- Create: `components/ui/ToastContainer.vue`
- Modify: `layouts/admin.vue`
- Create: `tests/unit/composables/useToast.test.ts`

- [ ] **Step 1: Write tests for useToast composable**

Create `tests/unit/composables/useToast.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('nextTick', nextTick)

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should add a success toast', async () => {
    const { useToast } = await import('../../../composables/useToast')
    const { toasts, success } = useToast()

    success('Saved!')
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].type).toBe('success')
    expect(toasts.value[0].message).toBe('Saved!')
  })

  it('should add error, warning, and info toasts', async () => {
    const { useToast } = await import('../../../composables/useToast')
    const { toasts, error, warning, info } = useToast()

    error('Failed')
    warning('Careful')
    info('FYI')
    expect(toasts.value).toHaveLength(3)
    expect(toasts.value[0].type).toBe('error')
    expect(toasts.value[1].type).toBe('warning')
    expect(toasts.value[2].type).toBe('info')
  })

  it('should auto-dismiss after duration', async () => {
    const { useToast } = await import('../../../composables/useToast')
    const { toasts, success } = useToast()

    success('Temporary')
    expect(toasts.value).toHaveLength(1)

    vi.advanceTimersByTime(4000)
    expect(toasts.value).toHaveLength(0)
  })

  it('should manually dismiss a toast', async () => {
    const { useToast } = await import('../../../composables/useToast')
    const { toasts, success, dismiss } = useToast()

    success('Manual dismiss')
    const id = toasts.value[0].id
    dismiss(id)
    expect(toasts.value).toHaveLength(0)
  })

  it('should share state across calls (singleton)', async () => {
    const { useToast } = await import('../../../composables/useToast')
    const instance1 = useToast()
    const instance2 = useToast()

    instance1.success('From instance 1')
    expect(instance2.toasts.value).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run tests/unit/composables/useToast.test.ts`
Expected: FAIL — module `composables/useToast` not found

- [ ] **Step 3: Implement useToast composable**

Create `composables/useToast.ts`:

```typescript
interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration: number
}

const toasts = ref<Toast[]>([])

function addToast(type: Toast['type'], message: string, duration = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  toasts.value.push({ id, type, message, duration })

  if (duration > 0) {
    setTimeout(() => {
      dismiss(id)
    }, duration)
  }
}

function dismiss(id: string) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useToast() {
  return {
    toasts: toasts as Readonly<Ref<Toast[]>>,
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    warning: (message: string) => addToast('warning', message),
    info: (message: string) => addToast('info', message),
    dismiss
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run tests/unit/composables/useToast.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Create ToastContainer component**

Create `components/ui/ToastContainer.vue`:

```vue
<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'flex items-start gap-3 p-4 rounded-lg shadow-lg border-l-4 bg-white dark:bg-gray-800',
            borderColor[toast.type]
          ]"
          role="alert"
        >
          <!-- Icon -->
          <div :class="['shrink-0 mt-0.5', iconColor[toast.type]]">
            <!-- Success checkmark -->
            <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Error X -->
            <svg v-else-if="toast.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <!-- Warning triangle -->
            <svg v-else-if="toast.type === 'warning'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <!-- Info circle -->
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <!-- Message -->
          <p class="flex-1 text-sm text-gray-700 dark:text-gray-300">{{ toast.message }}</p>

          <!-- Close -->
          <button
            class="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Dismiss"
            @click="dismiss(toast.id)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  const { toasts, dismiss } = useToast()

  const borderColor: Record<string, string> = {
    success: 'border-green-500',
    error: 'border-red-500',
    warning: 'border-amber-500',
    info: 'border-blue-500'
  }

  const iconColor: Record<string, string> = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500'
  }
</script>

<style scoped>
  .toast-enter-active {
    transition: all 0.3s ease-out;
  }
  .toast-leave-active {
    transition: all 0.2s ease-in;
  }
  .toast-enter-from {
    opacity: 0;
    transform: translateX(100%);
  }
  .toast-leave-to {
    opacity: 0;
    transform: translateX(100%);
  }
</style>
```

- [ ] **Step 6: Mount ToastContainer in admin layout**

In `layouts/admin.vue`, add `<UiToastContainer />` just before the closing `</div>` of the root element (after the mobile sidebar overlay):

Change in `layouts/admin.vue` — add after the `</Transition>` block (line 28):

```vue
    <!-- Toast Notifications -->
    <UiToastContainer />
```

- [ ] **Step 7: Commit**

```bash
git add composables/useToast.ts components/ui/ToastContainer.vue layouts/admin.vue tests/unit/composables/useToast.test.ts
git commit -m "feat(admin): add toast notification system

Add useToast composable (singleton queue with auto-dismiss) and
UiToastContainer component. Mounted in admin layout for all admin pages."
```

---

### Task 2: Unsaved Changes Composable

**Files:**
- Create: `composables/useUnsavedChanges.ts`
- Create: `tests/unit/composables/useUnsavedChanges.test.ts`

- [ ] **Step 1: Write tests for useUnsavedChanges**

Create `tests/unit/composables/useUnsavedChanges.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, reactive, nextTick } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('watch', vi.fn())
vi.stubGlobal('onBeforeUnmount', vi.fn())
vi.stubGlobal('onBeforeRouteLeave', vi.fn())

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('should report no changes initially after markSaved', async () => {
    const { useUnsavedChanges } = await import('../../../composables/useUnsavedChanges')
    const form = reactive({ title: 'Hello' })
    const { hasChanges, markSaved } = useUnsavedChanges(() => ({ ...form }))
    markSaved()
    expect(hasChanges.value).toBe(false)
  })

  it('should detect changes after form mutation', async () => {
    const { useUnsavedChanges } = await import('../../../composables/useUnsavedChanges')
    const form = reactive({ title: 'Hello' })
    const { hasChanges, markSaved } = useUnsavedChanges(() => ({ ...form }))
    markSaved()

    form.title = 'Changed'
    expect(hasChanges.value).toBe(true)
  })

  it('should reset to clean after markSaved', async () => {
    const { useUnsavedChanges } = await import('../../../composables/useUnsavedChanges')
    const form = reactive({ title: 'Hello' })
    const { hasChanges, markSaved } = useUnsavedChanges(() => ({ ...form }))
    markSaved()

    form.title = 'Changed'
    expect(hasChanges.value).toBe(true)

    markSaved()
    expect(hasChanges.value).toBe(false)
  })

  it('should force clean state with markClean', async () => {
    const { useUnsavedChanges } = await import('../../../composables/useUnsavedChanges')
    const form = reactive({ title: 'Hello' })
    const { hasChanges, markSaved, markClean } = useUnsavedChanges(() => ({ ...form }))
    markSaved()

    form.title = 'Changed'
    expect(hasChanges.value).toBe(true)

    markClean()
    expect(hasChanges.value).toBe(false)
  })

  it('should deep-compare nested objects', async () => {
    const { useUnsavedChanges } = await import('../../../composables/useUnsavedChanges')
    const form = reactive({ translations: { en: { title: 'Hello' } } })
    const { hasChanges, markSaved } = useUnsavedChanges(() => JSON.parse(JSON.stringify(form)))
    markSaved()

    expect(hasChanges.value).toBe(false)

    form.translations.en.title = 'Changed'
    expect(hasChanges.value).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run tests/unit/composables/useUnsavedChanges.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useUnsavedChanges composable**

Create `composables/useUnsavedChanges.ts`:

```typescript
export function useUnsavedChanges(formData: () => Record<string, unknown>) {
  const savedSnapshot = ref<string>('')
  const forcedClean = ref(false)

  const hasChanges = computed(() => {
    if (forcedClean.value) return false
    if (!savedSnapshot.value) return false
    return JSON.stringify(formData()) !== savedSnapshot.value
  })

  function markSaved() {
    savedSnapshot.value = JSON.stringify(formData())
    forcedClean.value = false
  }

  function markClean() {
    forcedClean.value = true
  }

  // Browser close/refresh warning
  if (import.meta.client) {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges.value) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    onBeforeUnmount(() => {
      window.removeEventListener('beforeunload', handler)
    })
  }

  // Vue Router navigation guard
  onBeforeRouteLeave(() => {
    if (hasChanges.value) {
      const answer = window.confirm('You have unsaved changes. Are you sure you want to leave?')
      if (!answer) return false
    }
  })

  return {
    hasChanges,
    markSaved,
    markClean
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run tests/unit/composables/useUnsavedChanges.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add composables/useUnsavedChanges.ts tests/unit/composables/useUnsavedChanges.test.ts
git commit -m "feat(admin): add useUnsavedChanges composable

Deep-compares form snapshots via JSON.stringify, provides markSaved/markClean,
registers beforeunload and onBeforeRouteLeave guards."
```

---

### Task 3: Install TipTap and Create Rich Text Component

**Files:**
- Modify: `package.json` (npm install)
- Create: `components/admin/form/AdminRichText.vue`
- Modify: `components/admin/form/AdminTranslationTabs.vue`

- [ ] **Step 1: Install TipTap dependencies**

```bash
cd ghana-audit-service && npm install @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder @tiptap/pm
```

- [ ] **Step 2: Create AdminRichText component**

Create `components/admin/form/AdminRichText.vue`:

```vue
<template>
  <div>
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <div
      :class="[
        'border rounded-lg overflow-hidden transition-colors',
        error
          ? 'border-red-500'
          : 'border-gray-300 dark:border-gray-600 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
      ]"
    >
      <!-- Toolbar -->
      <div
        v-if="editor"
        class="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
      >
        <button
          v-for="action in toolbarActions"
          :key="action.name"
          type="button"
          :class="[
            'p-1.5 rounded text-sm font-medium transition-colors',
            action.isActive?.()
              ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
          ]"
          :title="action.title"
          :disabled="disabled"
          @click="action.action"
        >
          <span v-html="action.icon" />
        </button>

        <!-- Link popover -->
        <div v-if="showLinkInput" class="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-500">
          <input
            ref="linkInputRef"
            v-model="linkUrl"
            type="url"
            placeholder="https://..."
            class="text-sm px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-48"
            @keydown.enter="applyLink"
            @keydown.escape="showLinkInput = false"
          />
          <button
            type="button"
            class="text-sm text-primary hover:underline"
            @click="applyLink"
          >
            Apply
          </button>
          <button
            v-if="editor?.isActive('link')"
            type="button"
            class="text-sm text-red-500 hover:underline"
            @click="removeLink"
          >
            Remove
          </button>
        </div>
      </div>

      <!-- Editor -->
      <EditorContent
        :editor="editor"
        :class="[
          'prose prose-sm dark:prose-invert max-w-none',
          'min-h-[120px] max-h-[300px] overflow-y-auto',
          'px-3 py-2',
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        ]"
      />
    </div>
    <p v-if="error" class="mt-1 text-sm text-red-500">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
  import { useEditor, EditorContent } from '@tiptap/vue-3'
  import StarterKit from '@tiptap/starter-kit'
  import Link from '@tiptap/extension-link'
  import Placeholder from '@tiptap/extension-placeholder'

  interface Props {
    modelValue?: string
    label?: string
    placeholder?: string
    error?: string
    required?: boolean
    disabled?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    label: undefined,
    placeholder: undefined,
    error: undefined,
    disabled: false
  })

  const emit = defineEmits<{
    'update:modelValue': [value: string]
  }>()

  const showLinkInput = ref(false)
  const linkUrl = ref('')
  const linkInputRef = ref<HTMLInputElement | null>(null)

  const editor = useEditor({
    content: props.modelValue,
    editable: !props.disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline'
        }
      }),
      Placeholder.configure({
        placeholder: props.placeholder || 'Start writing...'
      })
    ],
    onUpdate: ({ editor: e }) => {
      emit('update:modelValue', e.getHTML())
    }
  })

  watch(
    () => props.modelValue,
    (value) => {
      if (editor.value && editor.value.getHTML() !== value) {
        editor.value.commands.setContent(value || '', false)
      }
    }
  )

  watch(
    () => props.disabled,
    (value) => {
      editor.value?.setEditable(!value)
    }
  )

  const toolbarActions = computed(() => {
    if (!editor.value) return []
    const e = editor.value
    return [
      {
        name: 'bold',
        title: 'Bold',
        icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>',
        isActive: () => e.isActive('bold'),
        action: () => e.chain().focus().toggleBold().run()
      },
      {
        name: 'italic',
        title: 'Italic',
        icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>',
        isActive: () => e.isActive('italic'),
        action: () => e.chain().focus().toggleItalic().run()
      },
      {
        name: 'bulletList',
        title: 'Bullet List',
        icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>',
        isActive: () => e.isActive('bulletList'),
        action: () => e.chain().focus().toggleBulletList().run()
      },
      {
        name: 'orderedList',
        title: 'Ordered List',
        icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>',
        isActive: () => e.isActive('orderedList'),
        action: () => e.chain().focus().toggleOrderedList().run()
      },
      {
        name: 'link',
        title: 'Link',
        icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
        isActive: () => e.isActive('link'),
        action: () => {
          if (e.isActive('link')) {
            linkUrl.value = e.getAttributes('link').href || ''
          } else {
            linkUrl.value = ''
          }
          showLinkInput.value = !showLinkInput.value
          nextTick(() => linkInputRef.value?.focus())
        }
      },
      {
        name: 'clearFormatting',
        title: 'Clear Formatting',
        icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"/></svg>',
        isActive: () => false,
        action: () => e.chain().focus().clearNodes().unsetAllMarks().run()
      }
    ]
  })

  function applyLink() {
    if (!editor.value) return
    if (linkUrl.value) {
      editor.value.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.value }).run()
    }
    showLinkInput.value = false
    linkUrl.value = ''
  }

  function removeLink() {
    if (!editor.value) return
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    showLinkInput.value = false
    linkUrl.value = ''
  }

  onBeforeUnmount(() => {
    editor.value?.destroy()
  })
</script>

<style>
  .tiptap p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #9ca3af;
    pointer-events: none;
    height: 0;
  }
</style>
```

- [ ] **Step 3: Update AdminTranslationTabs to use AdminRichText**

In `components/admin/form/AdminTranslationTabs.vue`, replace the richtext placeholder (lines 53-64) that currently renders `AdminFormAdminTextarea` with:

```vue
            <!-- Rich Text -->
            <AdminFormAdminRichText
              v-else-if="field.type === 'richtext'"
              :id="`${field.key}-${locale.code}`"
              :model-value="getFieldValue(locale.code, field.key)"
              :label="field.label"
              :placeholder="field.placeholder"
              :required="field.required && locale.required"
              :error="getFieldError(locale.code, field.key)"
              @update:model-value="setFieldValue(locale.code, field.key, String($event))"
            />
```

- [ ] **Step 4: Verify build compiles**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: No errors related to AdminRichText or TipTap imports

- [ ] **Step 5: Commit**

```bash
git add components/admin/form/AdminRichText.vue components/admin/form/AdminTranslationTabs.vue package.json package-lock.json
git commit -m "feat(admin): add TipTap rich text editor component

AdminRichText with bold, italic, lists, links, and clear formatting.
Integrated into AdminTranslationTabs for richtext field type."
```

---

### Task 4: History API Endpoint

**Files:**
- Create: `server/api/admin/reports/[id]/history.get.ts`

- [ ] **Step 1: Create the history endpoint**

Create `server/api/admin/reports/[id]/history.get.ts`:

```typescript
import { eq, and, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'
import { requirePermission } from '../../../../utils/adminHelpers'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid ID'
    })
  }

  const db = getDatabase()

  const logs = await db
    .select({
      id: schema.auditLogs.id,
      action: schema.auditLogs.action,
      changes: schema.auditLogs.changes,
      createdAt: schema.auditLogs.createdAt,
      userId: schema.auditLogs.userId,
      userName: schema.users.name
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .where(
      and(
        eq(schema.auditLogs.entityType, 'audit_report'),
        eq(schema.auditLogs.entityId, id)
      )
    )
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(20)

  return {
    data: logs.map((log) => ({
      id: log.id,
      action: log.action,
      userName: log.userName || 'System',
      changes: log.changes,
      createdAt: log.createdAt
    }))
  }
})
```

- [ ] **Step 2: Verify no typecheck errors**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: No errors related to the history endpoint

- [ ] **Step 3: Commit**

```bash
git add server/api/admin/reports/\[id\]/history.get.ts
git commit -m "feat(admin): add report history API endpoint

GET /api/admin/reports/:id/history returns audit log entries
joined with user names, ordered newest first, limited to 20."
```

---

### Task 5: Edit Page Overhaul — Skeleton Loading

**Files:**
- Modify: `pages/admin/reports/[id]/edit.vue`

- [ ] **Step 1: Replace the spinner with a skeleton loader**

In `pages/admin/reports/[id]/edit.vue`, replace the loading block (lines 3-6):

```html
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
```

With this skeleton:

```html
    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-6">
      <div class="flex items-center gap-4 mb-6">
        <div class="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div class="space-y-2">
          <div class="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div class="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div class="space-y-3">
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div class="space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div class="space-y-3">
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div class="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Verify page loads correctly**

```bash
cd ghana-audit-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add pages/admin/reports/\[id\]/edit.vue
git commit -m "feat(admin): replace edit page spinner with skeleton loading

Skeleton mirrors the two-column layout with placeholder blocks
for translations, file upload, settings, thumbnail, and meta."
```

---

### Task 6: Edit Page Overhaul — Sidebar Reorganization + Status Badge

**Files:**
- Modify: `pages/admin/reports/[id]/edit.vue`

- [ ] **Step 1: Reorganize the sidebar**

Replace the entire sidebar `<div class="space-y-6">` block (lines 80-187 of the original edit.vue) with the reorganized version. The sidebar sections are reordered as:

1. **Status** (with badge + toggle + date)
2. **URL** (slug input)
3. **Classification** (category select)
4. **Thumbnail** (file upload)
5. **Meta** (timestamps)

```html
          <!-- Sidebar -->
          <div class="space-y-6">
            <!-- Status -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status</h2>
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      form.isPublished
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    ]"
                  >
                    {{ form.isPublished ? 'Published' : 'Draft' }}
                  </span>
                </div>

                <AdminFormAdminSwitch
                  v-model="form.isPublished"
                  label="Published"
                  description="Make this report visible to the public"
                />

                <AdminFormAdminDatePicker
                  v-if="form.isPublished"
                  v-model="form.publishedAt"
                  label="Publish Date"
                  type="datetime-local"
                />
              </div>
            </div>

            <!-- URL -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">URL</h2>
              <div>
                <AdminFormAdminInput
                  v-model="form.slug"
                  label="Slug"
                  required
                  help-text="URL-friendly identifier"
                  :error="errors.slug || slugError"
                  @update:model-value="handleSlugChange"
                >
                  <template #suffix>
                    <span v-if="isCheckingSlug" class="text-gray-400">
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                    <span v-else-if="isSlugAvailable === true" class="text-green-500">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span v-else-if="isSlugAvailable === false" class="text-red-500">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  </template>
                </AdminFormAdminInput>
                <p v-if="slugSuggestion" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Suggestion:
                  <button type="button" class="text-primary hover:underline" @click="useSlugSuggestion">
                    {{ slugSuggestion }}
                  </button>
                </p>
              </div>
            </div>

            <!-- Classification -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Classification</h2>
              <AdminFormAdminSelect
                v-model="form.category"
                :options="categories"
                label="Category"
                required
                :error="errors.category"
              />
            </div>

            <!-- Thumbnail -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thumbnail</h2>
              <AdminFormAdminFileUpload
                v-model="form.thumbnail"
                type="thumbnail"
                label="Cover Image"
                help-text="Optional cover image for the report"
              />
            </div>

            <!-- History section will be added in Task 7 -->

            <!-- Meta Info -->
            <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <p>Created: {{ formatDate(currentItem.createdAt) }}</p>
              <p>Updated: {{ formatDate(currentItem.updatedAt) }}</p>
            </div>
          </div>
```

- [ ] **Step 2: Verify no typecheck errors**

```bash
cd ghana-audit-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add pages/admin/reports/\[id\]/edit.vue
git commit -m "refactor(admin): reorganize report edit sidebar

Separate status/URL/classification/thumbnail into distinct cards.
Add prominent Published/Draft status badge pill."
```

---

### Task 7: Edit Page Overhaul — PDF Preview + History Timeline + Rich Text

**Files:**
- Modify: `pages/admin/reports/[id]/edit.vue`

- [ ] **Step 1: Add PDF preview section**

In the main content column (after the file upload card), add:

```html
            <!-- PDF Preview -->
            <div v-if="form.fileUrl" class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <button
                type="button"
                class="w-full flex items-center justify-between px-6 py-4 text-left"
                @click="previewExpanded = !previewExpanded"
              >
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Preview</h2>
                <svg
                  :class="['w-5 h-5 text-gray-400 transition-transform', previewExpanded ? 'rotate-180' : '']"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="previewExpanded" class="border-t border-gray-200 dark:border-gray-700">
                <iframe :src="form.fileUrl" class="w-full h-[500px]" title="PDF Preview" />
                <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-sm">
                  <a
                    :href="form.fileUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open in new tab
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
```

- [ ] **Step 2: Add history timeline section to sidebar**

Insert this between the Thumbnail card and the Meta Info card in the sidebar:

```html
            <!-- History -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <button
                type="button"
                class="w-full flex items-center justify-between px-6 py-4 text-left"
                @click="historyExpanded = !historyExpanded"
              >
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">History</h2>
                <svg
                  :class="['w-5 h-5 text-gray-400 transition-transform', historyExpanded ? 'rotate-180' : '']"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="historyExpanded" class="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <div v-if="historyLoading" class="flex justify-center py-4">
                  <div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
                <div v-else-if="historyEntries.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-2">
                  No history available
                </div>
                <div v-else class="relative">
                  <div class="absolute left-3 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-600" />
                  <div v-for="entry in historyEntries.slice(0, 10)" :key="entry.id" class="relative pl-8 pb-4 last:pb-0">
                    <div class="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
                      :class="{
                        'bg-green-500': entry.action === 'create',
                        'bg-blue-500': entry.action === 'update',
                        'bg-red-500': entry.action === 'delete'
                      }"
                    />
                    <div class="text-sm">
                      <span class="font-medium text-gray-900 dark:text-white">{{ entry.userName }}</span>
                      <span class="text-gray-500 dark:text-gray-400">
                        {{ entry.action === 'create' ? ' created' : entry.action === 'update' ? ' updated' : ' deleted' }} this report
                      </span>
                      <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {{ formatRelativeTime(entry.createdAt) }}
                      </p>
                      <div v-if="entry.action === 'update' && entry.changes">
                        <button
                          type="button"
                          class="text-xs text-primary hover:underline mt-1"
                          @click="entry._expanded = !entry._expanded"
                        >
                          {{ entry._expanded ? 'Hide changes' : 'View changes' }}
                        </button>
                        <div v-if="entry._expanded" class="mt-2 text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                          <div
                            v-for="(change, field) in getChangedFields(entry.changes)"
                            :key="field"
                            class="text-gray-600 dark:text-gray-400"
                          >
                            <span class="font-medium">{{ humanizeField(String(field)) }}:</span>
                            <span class="text-red-500 line-through">{{ truncate(String(change.before)) }}</span>
                            <span class="mx-1">&rarr;</span>
                            <span class="text-green-600">{{ truncate(String(change.after)) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
```

- [ ] **Step 3: Change summary field type to richtext**

In the `translationFields` array in the `<script setup>`, change the summary field's type:

```typescript
  const translationFields = [
    {
      key: 'title',
      label: 'Title',
      type: 'input' as const,
      required: true,
      placeholder: 'Enter report title'
    },
    {
      key: 'summary',
      label: 'Summary',
      type: 'richtext' as const,
      placeholder: 'Brief description of the report'
    }
  ]
```

- [ ] **Step 4: Add new reactive state and helper functions to the script section**

Add these to the `<script setup>` block:

```typescript
  // PDF preview state
  const previewExpanded = ref(false)

  // History state
  const historyExpanded = ref(false)
  const historyLoading = ref(false)
  const historyEntries = ref<Array<{
    id: number
    action: string
    userName: string
    changes: Record<string, unknown> | null
    createdAt: string
    _expanded?: boolean
  }>>([])

  // Fetch history
  async function fetchHistory() {
    historyLoading.value = true
    try {
      const response = await $fetch<{ data: typeof historyEntries.value }>(`/api/admin/reports/${id}/history`)
      historyEntries.value = response.data.map((e) => ({ ...e, _expanded: false }))
    } catch {
      historyEntries.value = []
    } finally {
      historyLoading.value = false
    }
  }

  // Format relative time
  function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    return date.toLocaleDateString()
  }

  // Get changed fields from audit log changes JSON
  function getChangedFields(changes: Record<string, unknown> | null): Record<string, { before: unknown; after: unknown }> {
    if (!changes) return {}
    const before = (changes.before || {}) as Record<string, unknown>
    const after = (changes.after || {}) as Record<string, unknown>
    const result: Record<string, { before: unknown; after: unknown }> = {}

    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        result[key] = { before: before[key], after: after[key] }
      }
    }
    return result
  }

  // Humanize field names
  function humanizeField(field: string): string {
    const map: Record<string, string> = {
      slug: 'Slug',
      category: 'Category',
      isPublished: 'Published',
      is_published: 'Published',
      publishedAt: 'Publish Date',
      published_at: 'Publish Date',
      fileUrl: 'File',
      file_url: 'File',
      fileSize: 'File Size',
      file_size: 'File Size',
      thumbnail: 'Thumbnail',
      translations: 'Content'
    }
    return map[field] || field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  }

  // Truncate long values for display
  function truncate(value: string, maxLength = 50): string {
    if (typeof value === 'object') return JSON.stringify(value).slice(0, maxLength)
    const str = String(value)
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str
  }
```

Update the `onMounted` to also fetch history:

```typescript
  onMounted(async () => {
    const report = await fetchOne(id)
    if (report) {
      form.slug = report.slug
      form.category = report.category
      form.fileUrl = report.fileUrl
      form.fileSize = report.fileSize || undefined
      form.thumbnail = report.thumbnail || ''
      form.isPublished = report.isPublished
      form.publishedAt = report.publishedAt || ''
      form.translations = report.translations || { en: { title: '', summary: '' } }
    }
    fetchHistory()
  })
```

- [ ] **Step 5: Verify build**

```bash
cd ghana-audit-service && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add pages/admin/reports/\[id\]/edit.vue
git commit -m "feat(admin): add PDF preview, history timeline, and rich text to edit page

Collapsible PDF iframe preview, audit trail timeline with change diffs,
and TipTap rich text for the summary field."
```

---

### Task 8: Edit Page Overhaul — Sticky Save Bar + Unsaved Changes + Post-Save Behavior

**Files:**
- Modify: `pages/admin/reports/[id]/edit.vue`

- [ ] **Step 1: Wire up useUnsavedChanges and useToast**

Add to the imports/composable calls in the `<script setup>`:

```typescript
  const toast = useToast()
  const { hasChanges, markSaved, markClean } = useUnsavedChanges(() => ({
    slug: form.slug,
    category: form.category,
    fileUrl: form.fileUrl,
    fileSize: form.fileSize,
    thumbnail: form.thumbnail,
    isPublished: form.isPublished,
    publishedAt: form.publishedAt,
    translations: form.translations
  }))
```

Update the `onMounted` to call `markSaved()` after form population:

```typescript
  onMounted(async () => {
    const report = await fetchOne(id)
    if (report) {
      form.slug = report.slug
      form.category = report.category
      form.fileUrl = report.fileUrl
      form.fileSize = report.fileSize || undefined
      form.thumbnail = report.thumbnail || ''
      form.isPublished = report.isPublished
      form.publishedAt = report.publishedAt || ''
      form.translations = report.translations || { en: { title: '', summary: '' } }
      nextTick(() => markSaved())
    }
    fetchHistory()
  })
```

- [ ] **Step 2: Update handleSubmit to stay on page with toast**

Replace the `handleSubmit` function:

```typescript
  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const data: ReportInput = {
      ...form,
      publishedAt:
        form.isPublished && form.publishedAt ? form.publishedAt : new Date().toISOString()
    }

    const result = await update(id, data)
    if (result) {
      toast.success('Report updated successfully')
      markSaved()
      await fetchOne(id)
      if (currentItem.value) {
        form.publishedAt = currentItem.value.publishedAt || ''
      }
      nextTick(() => markSaved())
      fetchHistory()
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
      toast.error(error.value || 'Failed to save report')
    }
  }

  // Discard changes
  function handleDiscard() {
    if (currentItem.value) {
      form.slug = currentItem.value.slug
      form.category = currentItem.value.category
      form.fileUrl = currentItem.value.fileUrl
      form.fileSize = currentItem.value.fileSize || undefined
      form.thumbnail = currentItem.value.thumbnail || ''
      form.isPublished = currentItem.value.isPublished
      form.publishedAt = currentItem.value.publishedAt || ''
      form.translations = currentItem.value.translations || { en: { title: '', summary: '' } }
      nextTick(() => markSaved())
    }
  }
```

- [ ] **Step 3: Replace the bottom action bar with sticky save bar**

Remove the old bottom actions block and replace with:

```html
        <!-- Sticky Save Bar -->
        <Transition name="slide-up">
          <div
            v-if="hasChanges || saving"
            class="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
          >
            <div class="flex items-center justify-between max-w-full">
              <div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <span class="w-2 h-2 rounded-full bg-amber-500" />
                Unsaved changes
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="btn btn-ghost" :disabled="saving" @click="handleDiscard">
                  Discard
                </button>
                <NuxtLink to="/admin/reports" class="btn btn-ghost" :disabled="saving">
                  Cancel
                </NuxtLink>
                <button
                  type="submit"
                  class="btn btn-primary inline-flex items-center gap-2"
                  :disabled="saving"
                >
                  <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {{ saving ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
```

Add the transition styles to the component (or a `<style>` block):

```vue
<style scoped>
  .slide-up-enter-active {
    transition: all 0.3s ease-out;
  }
  .slide-up-leave-active {
    transition: all 0.2s ease-in;
  }
  .slide-up-enter-from {
    opacity: 0;
    transform: translateY(100%);
  }
  .slide-up-leave-to {
    opacity: 0;
    transform: translateY(100%);
  }
</style>
```

- [ ] **Step 4: Verify build**

```bash
cd ghana-audit-service && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add pages/admin/reports/\[id\]/edit.vue
git commit -m "feat(admin): add sticky save bar with unsaved changes detection

Sticky bottom bar appears when form has changes, with discard/save buttons.
Post-save stays on page with toast confirmation and re-fetches data."
```

---

### Task 9: Update Create Page (Rich Text) + Final Verification

**Files:**
- Modify: `pages/admin/reports/create.vue`

- [ ] **Step 1: Update create page summary field to richtext**

In `pages/admin/reports/create.vue`, change the `translationFields` array — update the summary field type from `'textarea'` to `'richtext'`:

```typescript
  const translationFields = [
    {
      key: 'title',
      label: 'Title',
      type: 'input' as const,
      required: true,
      placeholder: 'Enter report title'
    },
    {
      key: 'summary',
      label: 'Summary',
      type: 'richtext' as const,
      placeholder: 'Brief description of the report'
    }
  ]
```

- [ ] **Step 2: Run full quality gate**

```bash
cd ghana-audit-service && npm run typecheck && npm run lint && npm run test:run
```

Expected: All pass

- [ ] **Step 3: Fix any lint/type issues**

If the quality gate reports issues, fix them. Common ones:
- TipTap types may need `@ts-expect-error` for some edge cases
- Unused imports flagged by ESLint
- Formatting issues caught by Prettier (run `npm run lint:fix`)

- [ ] **Step 4: Commit**

```bash
git add pages/admin/reports/create.vue
git commit -m "feat(admin): use rich text editor for summary on create page

Change summary field type from textarea to richtext on the
report create page for consistency with the edit page."
```

- [ ] **Step 5: Final commit with any lint/type fixes**

If there were fixes in step 3:

```bash
git add -u
git commit -m "chore: fix typecheck and lint issues from edit page overhaul"
```
