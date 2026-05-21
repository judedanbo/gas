<template>
  <ClientOnly>
    <VChart
      class="h-full w-full"
      :option="option"
      :autoresize="true"
      :loading="loading"
      :theme="theme"
      @finished="onFinished"
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
  import { LineChart, BarChart, PieChart, HeatmapChart } from 'echarts/charts'
  import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    DataZoomComponent,
    VisualMapComponent
  } from 'echarts/components'
  import type { EChartsOption } from 'echarts'

  // Lazy-import only the chart types and components actually used by the
  // analytics pages. Adding a new chart kind elsewhere? Extend this list.
  use([
    CanvasRenderer,
    LineChart,
    BarChart,
    PieChart,
    HeatmapChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    DataZoomComponent,
    VisualMapComponent
  ])

  defineProps<{
    option: EChartsOption
    loading?: boolean
  }>()

  // ECharts' `finished` event fires after each render pass. The report
  // page subscribes to it to detect when all charts are visible so the
  // PDF capture knows the document is ready.
  const emit = defineEmits<{ ready: [] }>()

  function onFinished() {
    emit('ready')
  }

  const colorMode = useColorMode()
  const theme = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'))
</script>
