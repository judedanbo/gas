<template>
  <ClientOnly>
    <VChart
      class="h-full w-full"
      :option="option"
      :autoresize="true"
      :loading="loading"
      :theme="theme"
    />
    <template #fallback>
      <div
        class="flex h-full w-full items-center justify-center text-sm text-gray-400 dark:text-gray-500"
      >
        Loading chart…
      </div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
  import VChart from 'vue-echarts'
  import { use } from 'echarts/core'
  import { CanvasRenderer } from 'echarts/renderers'
  import { LineChart, BarChart, PieChart } from 'echarts/charts'
  import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    DataZoomComponent
  } from 'echarts/components'
  import type { EChartsOption } from 'echarts'

  // Lazy-import only the chart types and components actually used by the
  // analytics pages. Adding a new chart kind elsewhere? Extend this list.
  use([
    CanvasRenderer,
    LineChart,
    BarChart,
    PieChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    DataZoomComponent
  ])

  defineProps<{
    option: EChartsOption
    loading?: boolean
  }>()

  const colorMode = useColorMode()
  const theme = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'))
</script>
