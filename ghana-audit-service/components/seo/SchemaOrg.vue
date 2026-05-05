<script setup lang="ts">
/**
 * SchemaOrg Component
 * Injects JSON-LD structured data into the page head
 */

interface Props {
  schema: Record<string, unknown> | Record<string, unknown>[]
}

const props = defineProps<Props>()

// Inject JSON-LD into head
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(props.schema)
    }
  ]
})
</script>

<template>
  <!-- No visual output - component only injects schema into head -->
  <slot />
</template>
