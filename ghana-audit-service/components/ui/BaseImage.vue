<template>
  <!--
    Each source is tried through NuxtImg (IPX) first when it is root-relative,
    then as a plain <img>. IPX cannot handle anything else: remote hosts are
    rejected unless listed in `image.domains` (nuxt.config.ts sets none), which
    would break the i.ytimg.com covers synthesised for live broadcasts in
    utils/liveVideos.ts, and blob:/data: URLs are not fetchable server-side.
  -->
  <img
    v-if="attempt && !attempt.optimise"
    ref="plainEl"
    :src="attempt.src"
    :alt="alt"
    :width="width"
    :height="height"
    :loading="loading"
    @error="onError"
  />
  <NuxtImg
    v-else-if="attempt"
    ref="optimisedImg"
    :src="attempt.src"
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
   * so a truthy-but-404 src renders the browser's broken-image box. This works
   * through a list of attempts instead and ends on a placeholder icon, so a
   * missing file degrades instead of breaking:
   *
   *   1. `src` through IPX (root-relative only), for resizing and caching;
   *   2. `src` as a plain <img>. IPX only reads files present in the build's
   *      public dir, so it 404s on runtime uploads it can't see — thumbnails
   *      kept in Azure Blob, and any `/uploads/**` file when the uploads
   *      folder isn't mounted into `.output/public` (Docker Compose, a plain
   *      `node .output/server/index.mjs`). The direct URL is served by
   *      server/routes/uploads/** from disk or Blob, so it still loads;
   *   3. and 4. the same for `fallbackSrc`;
   *   5. the placeholder.
   *
   * An image can also fail before the page hydrates, when no Vue listener is
   * attached yet. NuxtImg's server-rendered `onerror` attribute would flag
   * that, but the CSP (no inline handlers) blocks it — so on mount the
   * rendered element is checked and a broken one moves on to the next attempt.
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
    /** Tried when `src` fails. Must be a build-time asset, or it can fail too. */
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

  interface Attempt {
    src: string
    /** Through NuxtImg/IPX rather than a plain <img>. */
    optimise: boolean
  }

  /** IPX only takes paths on this site; `//host/x` is another host. */
  function isOptimisable(src: string): boolean {
    return src.startsWith('/') && !src.startsWith('//')
  }

  const attempts = computed<Attempt[]>(() => {
    const list: Attempt[] = []
    const sources = [props.src, props.fallbackSrc].filter(
      (source, index, all): source is string => !!source && all.indexOf(source) === index
    )
    for (const src of sources) {
      if (isOptimisable(src)) list.push({ src, optimise: true })
      list.push({ src, optimise: false })
    }
    return list
  })

  const attemptIndex = ref(0)
  const attempt = computed<Attempt | undefined>(() => attempts.value[attemptIndex.value])

  function onError() {
    if (attemptIndex.value < attempts.value.length) attemptIndex.value++
  }

  const plainEl = ref<HTMLImageElement | null>(null)
  const optimisedImg = ref<{ imgEl?: HTMLImageElement | null } | null>(null)

  /** Finished loading with nothing to show: the request failed. */
  function isBroken(el: HTMLImageElement): boolean {
    const src = el.getAttribute('src') || ''
    // An SVG without intrinsic dimensions also reports naturalWidth 0.
    return !!src && el.complete && el.naturalWidth === 0 && !/\.svg(?:$|[?#])/i.test(src)
  }

  // Catch a failure that happened before hydration attached @error.
  onMounted(() => {
    const el = plainEl.value ?? optimisedImg.value?.imgEl ?? null
    if (el && isBroken(el)) onError()
  })

  // Lists reuse component instances across items; without this a card that
  // failed once would keep showing the placeholder for the next article.
  watch(
    () => [props.src, props.fallbackSrc],
    () => {
      attemptIndex.value = 0
    }
  )
</script>
