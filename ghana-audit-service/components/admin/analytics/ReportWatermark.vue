<template>
  <header
    class="mb-8 flex items-center justify-between border-b-4 pb-4"
    style="border-color: #006b3f"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex h-12 w-12 items-center justify-center rounded-lg font-bold text-white"
        style="background-color: #006b3f"
      >
        GAS
      </div>
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Ghana Audit Service</h1>
        <p class="text-sm text-gray-600">Unified Analytics Report</p>
      </div>
    </div>
    <div class="text-right text-xs text-gray-600">
      <div>
        <span class="font-semibold">Window:</span>
        {{ windowLabel }}
      </div>
      <div>
        <span class="font-semibold">Generated:</span>
        {{ generatedAt }}
      </div>
      <div v-if="email">
        <span class="font-semibold">By:</span>
        {{ email }}
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
  defineProps<{
    windowLabel: string
    generatedAt: string
    email?: string | null
  }>()
</script>
