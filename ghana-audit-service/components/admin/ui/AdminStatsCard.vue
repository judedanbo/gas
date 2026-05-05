<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
          {{ displayLabel }}
        </p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
          {{ formattedValue }}
        </p>
        <p v-if="change" :class="['mt-1 text-sm', changeColor]">
          <span class="inline-flex items-center gap-0.5">
            <svg
              v-if="change > 0"
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            <svg
              v-else-if="change < 0"
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
            {{ Math.abs(change) }}%
          </span>
          <span class="text-gray-500 dark:text-gray-400 ml-1">vs last month</span>
        </p>
      </div>
      <div
        v-if="icon"
        :class="['w-12 h-12 rounded-lg flex items-center justify-center', iconBgClass]"
      >
        <component :is="iconComponent" class="w-6 h-6" :class="iconClass" />
      </div>
    </div>

    <!-- Link -->
    <NuxtLink
      v-if="to"
      :to="to"
      class="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
    >
      View all
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    label?: string
    title?: string // Alias for label
    value: number
    change?: number
    icon?: string
    iconColor?:
      | 'primary'
      | 'secondary'
      | 'accent'
      | 'success'
      | 'warning'
      | 'danger'
      | 'green'
      | 'red'
      | 'yellow'
      | 'blue'
    color?: string // Alias for iconColor
    to?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    iconColor: 'primary',
    label: undefined,
    title: undefined,
    change: undefined,
    icon: undefined,
    color: undefined,
    to: undefined
  })

  // Support both label and title props
  const displayLabel = computed(() => props.label || props.title || '')

  // Support both iconColor and color props, normalize color names
  const normalizedIconColor = computed(() => {
    const color = props.color || props.iconColor || 'primary'
    const colorMap: Record<string, string> = {
      green: 'success',
      red: 'danger',
      yellow: 'warning',
      blue: 'primary'
    }
    return colorMap[color] || color
  })

  // Format large numbers
  const formattedValue = computed(() => {
    if (props.value >= 1000000) {
      return `${(props.value / 1000000).toFixed(1)}M`
    }
    if (props.value >= 1000) {
      return `${(props.value / 1000).toFixed(1)}K`
    }
    return props.value.toLocaleString()
  })

  // Change color
  const changeColor = computed(() => {
    if (!props.change) return ''
    return props.change > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
  })

  // Icon background class
  const iconBgClass = computed(() => {
    const colors: Record<string, string> = {
      primary: 'bg-primary/10',
      secondary: 'bg-secondary/10',
      accent: 'bg-accent/10',
      success: 'bg-green-100 dark:bg-green-900/20',
      warning: 'bg-yellow-100 dark:bg-yellow-900/20',
      danger: 'bg-red-100 dark:bg-red-900/20'
    }
    return colors[normalizedIconColor.value] || colors.primary
  })

  // Icon class
  const iconClass = computed(() => {
    const colors: Record<string, string> = {
      primary: 'text-primary',
      secondary: 'text-secondary',
      accent: 'text-accent',
      success: 'text-green-600 dark:text-green-400',
      warning: 'text-yellow-600 dark:text-yellow-400',
      danger: 'text-red-600 dark:text-red-400'
    }
    return colors[normalizedIconColor.value] || colors.primary
  })

  // Icon component
  const iconComponent = computed(() => {
    const icons: Record<string, { render: () => ReturnType<typeof h> }> = {
      document: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            })
          ])
        }
      },
      users: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
            })
          ])
        }
      },
      mail: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
            })
          ])
        }
      },
      calendar: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
            })
          ])
        }
      },
      inbox: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
            })
          ])
        }
      },
      clock: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
            })
          ])
        }
      },
      eye: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
            }),
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
            })
          ])
        }
      },
      check: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M5 13l4 4L19 7'
            })
          ])
        }
      },
      x: {
        render() {
          return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M6 18L18 6M6 6l12 12'
            })
          ])
        }
      }
    }

    return icons[props.icon || ''] || icons.document
  })
</script>
