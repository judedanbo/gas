<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 dark:bg-gray-800"
    :class="
      selected
        ? 'border-primary ring-2 ring-primary/20'
        : 'border-gray-200 hover:border-primary/40 hover:shadow-md dark:border-gray-700'
    "
  >
    <div
      class="relative bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
      @click="$emit('click')"
    >
      <div class="aspect-[3/2] w-full">
        <img
          :src="thumbnail || '/img/reports/default-cover.svg'"
          alt=""
          class="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>

      <label
        class="absolute top-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 bg-white/90 backdrop-blur-sm transition-colors cursor-pointer"
        :class="
          selected
            ? 'border-primary bg-primary text-white'
            : 'border-gray-300 hover:border-primary dark:border-gray-500 dark:bg-gray-800/90'
        "
        @click.stop
      >
        <input
          type="checkbox"
          class="sr-only"
          :checked="selected"
          @change="$emit('toggle-select')"
        />
        <svg
          v-if="selected"
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </label>

      <span
        class="absolute top-2 right-2 z-10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shadow-sm"
        :class="
          isPublished
            ? 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
        "
      >
        {{ isPublished ? 'Published' : 'Draft' }}
      </span>
    </div>

    <div class="flex flex-1 flex-col p-4">
      <h3
        class="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-white cursor-pointer hover:text-primary transition-colors"
        :title="title"
        @click="$emit('click')"
      >
        {{ title }}
      </h3>

      <div v-if="badgeLabel" class="mb-3">
        <span
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          :class="badgeClass"
        >
          {{ badgeLabel }}
        </span>
      </div>

      <div
        v-if="metadata.length > 0"
        class="mt-auto flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
      >
        <span v-for="(item, i) in metadata" :key="i">{{ item }}</span>
      </div>

      <div class="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <NuxtLink
          :to="editUrl"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-primary"
          @click.stop
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Edit
        </NuxtLink>
        <button
          type="button"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          @click.stop="$emit('delete')"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Delete
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
  defineProps<{
    title: string
    thumbnail: string | null
    selected: boolean
    editUrl: string
    badgeLabel: string | null
    badgeClass: string
    metadata: string[]
    isPublished: boolean
  }>()

  defineEmits<{
    click: []
    'toggle-select': []
    delete: []
  }>()
</script>
