<template>
  <!--
    Only root-relative paths go through NuxtImg. IPX cannot handle anything else:
    remote hosts are rejected unless listed in `image.domains` (nuxt.config.ts
    sets none), which would break the i.ytimg.com covers synthesised for live
    broadcasts in utils/liveVideos.ts, and blob:/data: URLs — the client-side
    upload previews in AdminFileUpload — are not fetchable server-side at all.
  -->
  <img
    v-if="displaySrc && isRaw"
    :src="displaySrc"
    :alt="alt"
    :width="width"
    :height="height"
    :loading="loading"
    @error="onError"
  />
  <NuxtImg
    v-else-if="displaySrc"
    :src="displaySrc"
    :alt="alt"
    :width="width"
    :height="height"
    :sizes="sizes"
    :loading="loading"
    @error="onError"
  />
  <div
    v-else
    class="flex items-center justify-center bg-gray-100 dark:bg-gray-700"
    :role="alt ? 'img' : undefined"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : 'true'"
  >
    <Icon :name="fallbackIcon" class="w-1/3 h-1/3 text-gray-400 dark:text-gray-500" />
  </div>
</template>

<script setup lang="ts">
  /**
   * Image with a real failure path.
   *
   * Every other image site in this app guards only on the URL being non-empty,
   * so a truthy-but-404 src renders the browser's broken-image box. This
   * listens for the load error and swaps in `fallbackSrc` (once) and then a
   * placeholder icon, so a missing file degrades instead of breaking.
   *
   * Layout classes land on whichever element renders — img, NuxtImg or the
   * placeholder — via attribute fallthrough, so callers style it exactly as
   * they styled the <img> it replaces.
   */
  interface Props {
    src?: string | null
    alt?: string
    width?: number | string
    height?: number | string
    sizes?: string
    loading?: 'lazy' | 'eager'
    /** Tried once when `src` fails. Must be a build-time asset, or it can fail too. */
    fallbackSrc?: string
    fallbackIcon?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    src: undefined,
    alt: '',
    width: undefined,
    height: undefined,
    sizes: undefined,
    loading: 'lazy',
    fallbackSrc: undefined,
    fallbackIcon: 'heroicons:photo'
  })

  const failed = ref(false)
  const usingFallback = ref(false)

  const displaySrc = computed(() => {
    if (failed.value) return undefined
    if (usingFallback.value) return props.fallbackSrc
    return props.src || props.fallbackSrc || undefined
  })

  /** Anything not root-relative (https:, blob:, data:) must skip IPX. */
  const isRaw = computed(() => !displaySrc.value?.startsWith('/'))

  function onError() {
    // Only worth retrying if there is a distinct fallback we have not shown yet.
    if (!usingFallback.value && props.fallbackSrc && props.src && props.src !== props.fallbackSrc) {
      usingFallback.value = true
      return
    }
    failed.value = true
  }

  // Lists reuse component instances across items; without this a card that
  // failed once would keep showing the placeholder for the next article.
  watch(
    () => props.src,
    () => {
      failed.value = false
      usingFallback.value = false
    }
  )
</script>
