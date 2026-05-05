<template>
  <div :class="gridClasses">
    <div
      v-for="stat in stats"
      :key="stat.label"
      :class="itemClasses"
    >
      <span v-if="stat.icon" class="block mb-2">
        <Icon
          v-if="isHeroicon(stat.icon)"
          :name="stat.icon"
          class="w-8 h-8 mx-auto"
          :class="iconColorClass"
          aria-hidden="true"
        />
        <span v-else class="text-3xl">{{ stat.icon }}</span>
      </span>
      <span class="block text-3xl md:text-4xl font-bold text-primary">
        {{ animated ? animatedValues[stat.label] || 0 : stat.value }}{{ stat.suffix }}
      </span>
      <span class="text-sm text-gray-500 dark:text-gray-400 mt-1 block">{{ stat.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Stat {
  icon?: string
  value: number
  label: string
  suffix?: string
}

interface Props {
  stats: Stat[]
  columns?: 2 | 3 | 4
  animated?: boolean
  variant?: 'default' | 'card' | 'transparent' | 'bordered'
}

const props = withDefaults(defineProps<Props>(), {
  columns: 4,
  animated: false,
  variant: 'default'
})

// Helper to detect heroicon names
const isHeroicon = (icon: string) => icon.includes(':')

// Icon color based on variant
const iconColorClass = computed(() => {
  return props.variant === 'transparent' ? 'text-accent' : 'text-primary'
})

const gridClasses = computed(() => {
  const cols = {
    2: 'grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4'
  }
  return `grid ${cols[props.columns]} gap-4 md:gap-6`
})

const itemClasses = computed(() => {
  const base = 'text-center p-6 rounded-lg'
  const variants = {
    default: 'bg-gray-100 dark:bg-gray-700',
    card: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm',
    transparent: 'bg-white/10 text-white',
    bordered: 'border-2 border-primary/20 bg-primary/5 dark:bg-primary/10'
  }
  return `${base} ${variants[props.variant]}`
})

// Animation logic
const animatedValues = ref<Record<string, number>>({})
const hasAnimated = ref(false)

function animateValues() {
  if (hasAnimated.value || !props.animated) return
  hasAnimated.value = true

  props.stats.forEach(stat => {
    animatedValues.value[stat.label] = 0
    const target = stat.value
    const duration = 2000
    const steps = 60
    const increment = target / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      current = Math.min(Math.round(increment * step), target)
      animatedValues.value[stat.label] = current

      if (step >= steps) {
        clearInterval(timer)
        animatedValues.value[stat.label] = target
      }
    }, duration / steps)
  })
}

// Use Intersection Observer for scroll-triggered animation
onMounted(() => {
  if (props.animated && typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateValues()
            observer.disconnect()
          }
        })
      },
      { threshold: 0.2 }
    )

    nextTick(() => {
      const el = document.querySelector('[data-stat-grid]')
      if (el) observer.observe(el)
    })
  } else if (props.animated) {
    animateValues()
  }
})
</script>
