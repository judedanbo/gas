<template>
  <AdminFormGroup :id="id" :label="label" :required="required" :error="error" :help-text="helpText">
    <div
      :class="[
        'border rounded-lg overflow-hidden transition-colors',
        error
          ? 'border-red-500'
          : isFocused
            ? 'border-primary ring-2 ring-primary'
            : 'border-gray-300 dark:border-gray-600'
      ]"
    >
      <!-- Toolbar -->
      <div
        class="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
      >
        <button
          type="button"
          title="Bold"
          :disabled="disabled"
          :class="toolbarButtonClass(editor?.isActive('bold'))"
          @click="editor?.chain().focus().toggleBold().run()"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"
            />
          </svg>
        </button>

        <button
          type="button"
          title="Italic"
          :disabled="disabled"
          :class="toolbarButtonClass(editor?.isActive('italic'))"
          @click="editor?.chain().focus().toggleItalic().run()"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
          </svg>
        </button>

        <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" role="separator" />

        <button
          type="button"
          title="Bullet List"
          :disabled="disabled"
          :class="toolbarButtonClass(editor?.isActive('bulletList'))"
          @click="editor?.chain().focus().toggleBulletList().run()"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"
            />
          </svg>
        </button>

        <button
          type="button"
          title="Ordered List"
          :disabled="disabled"
          :class="toolbarButtonClass(editor?.isActive('orderedList'))"
          @click="editor?.chain().focus().toggleOrderedList().run()"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"
            />
          </svg>
        </button>

        <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" role="separator" />

        <!-- Link button -->
        <div class="relative">
          <button
            type="button"
            title="Link"
            :disabled="disabled"
            :class="toolbarButtonClass(editor?.isActive('link'))"
            @click="toggleLinkInput"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
              />
            </svg>
          </button>

          <!-- Link URL popover -->
          <div
            v-if="showLinkInput"
            class="absolute left-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 flex items-center gap-2"
          >
            <input
              ref="linkInputRef"
              v-model="linkUrl"
              type="url"
              placeholder="https://example.com"
              class="form-input text-sm py-1 px-2 w-56"
              @keydown.enter.prevent="applyLink"
              @keydown.escape="closeLinkInput"
            />
            <button
              type="button"
              class="px-2 py-1 text-xs font-medium text-white bg-primary rounded hover:bg-primary-dark"
              @click="applyLink"
            >
              Apply
            </button>
            <button
              v-if="editor?.isActive('link')"
              type="button"
              class="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400"
              @click="removeLink"
            >
              Remove
            </button>
          </div>
        </div>

        <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" role="separator" />

        <button
          type="button"
          title="Clear Formatting"
          :disabled="disabled"
          :class="toolbarButtonClass(false)"
          @click="editor?.chain().focus().clearNodes().unsetAllMarks().run()"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"
            />
          </svg>
        </button>
      </div>

      <!-- Editor content -->
      <EditorContent
        :editor="editor"
        :class="['richtext-editor', disabled ? 'opacity-50 cursor-not-allowed' : '']"
      />
    </div>
  </AdminFormGroup>
</template>

<script setup lang="ts">
  import { useEditor, EditorContent } from '@tiptap/vue-3'
  import StarterKit from '@tiptap/starter-kit'
  import Link from '@tiptap/extension-link'
  import Placeholder from '@tiptap/extension-placeholder'

  interface Props {
    modelValue?: string | null
    label?: string
    id?: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    error?: string
    helpText?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    label: undefined,
    id: undefined,
    placeholder: undefined,
    required: false,
    disabled: false,
    error: undefined,
    helpText: undefined
  })

  const emit = defineEmits<{
    'update:modelValue': [value: string]
  }>()

  const isFocused = ref(false)
  const showLinkInput = ref(false)
  const linkUrl = ref('')
  const linkInputRef = ref<HTMLInputElement | null>(null)

  const editor = useEditor({
    content: props.modelValue || '',
    editable: !props.disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
        // StarterKit v3 bundles a link extension; disable it so the explicitly
        // configured Link below is the only one registered (avoids a duplicate).
        link: false
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline'
        }
      }),
      Placeholder.configure({
        placeholder: props.placeholder || ''
      })
    ],
    onUpdate: ({ editor: ed }) => {
      emit('update:modelValue', ed.getHTML())
    },
    onFocus: () => {
      isFocused.value = true
    },
    onBlur: () => {
      isFocused.value = false
    }
  })

  // Sync external modelValue changes
  watch(
    () => props.modelValue,
    (newValue) => {
      if (!editor.value) return
      const currentHTML = editor.value.getHTML()
      // Avoid infinite loop: only update if content actually differs
      if (currentHTML !== newValue) {
        editor.value.commands.setContent(newValue || '', { emitUpdate: false })
      }
    }
  )

  // Toggle editable when disabled changes
  watch(
    () => props.disabled,
    (newDisabled) => {
      editor.value?.setEditable(!newDisabled)
    }
  )

  // Clean up on unmount
  onBeforeUnmount(() => {
    editor.value?.destroy()
  })

  function toolbarButtonClass(isActive: boolean | undefined): string {
    const base = 'p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    if (isActive) {
      return `${base} bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white`
    }
    return `${base} text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white`
  }

  function toggleLinkInput() {
    if (showLinkInput.value) {
      closeLinkInput()
      return
    }

    // Pre-fill with existing link URL if cursor is on a link
    const attrs = editor.value?.getAttributes('link')
    linkUrl.value = (attrs?.href as string) || ''
    showLinkInput.value = true

    nextTick(() => {
      linkInputRef.value?.focus()
    })
  }

  function applyLink() {
    if (!editor.value) return

    if (linkUrl.value) {
      editor.value.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.value }).run()
    }

    closeLinkInput()
  }

  function removeLink() {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
    closeLinkInput()
  }

  function closeLinkInput() {
    showLinkInput.value = false
    linkUrl.value = ''
  }
</script>

<style scoped>
  .richtext-editor :deep(.tiptap) {
    @apply px-4 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800;
    min-height: 120px;
    max-height: 300px;
    overflow-y: auto;
    outline: none;
  }

  .richtext-editor :deep(.tiptap p.is-editor-empty:first-child::before) {
    @apply text-gray-400 dark:text-gray-500;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  /* Prose styling for editor content */
  .richtext-editor :deep(.tiptap p) {
    @apply mb-2 leading-relaxed;
  }

  .richtext-editor :deep(.tiptap p:last-child) {
    @apply mb-0;
  }

  .richtext-editor :deep(.tiptap ul) {
    @apply list-disc pl-6 mb-2;
  }

  .richtext-editor :deep(.tiptap ol) {
    @apply list-decimal pl-6 mb-2;
  }

  .richtext-editor :deep(.tiptap li) {
    @apply mb-1;
  }

  .richtext-editor :deep(.tiptap a) {
    @apply text-primary underline;
  }

  .richtext-editor :deep(.tiptap strong) {
    @apply font-bold;
  }

  .richtext-editor :deep(.tiptap em) {
    @apply italic;
  }
</style>
