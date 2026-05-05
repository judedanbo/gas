<template>
  <section ref="sectionRef" class="bg-gray-100 dark:bg-gray-900 py-12">
    <div class="container">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div v-for="(stat, index) in stats" :key="stat.label" class="text-center">
          <span class="block text-3xl md:text-4xl font-bold text-primary dark:text-accent mb-2">
            <span class="tabular-nums">{{ animatedValues[index] }}</span>
            <span class="text-xl md:text-2xl">{{ stat.suffix }}</span>
          </span>
          <span class="text-gray-600 dark:text-gray-400 text-sm uppercase tracking-wider">{{ stat.label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface StatItem {
  label: string
  value: number
  suffix: string
}

const props = defineProps<{
  stats: StatItem[]
}>()

const sectionRef = ref<HTMLElement | null>(null)
const hasAnimated = ref(false)
const animatedValues = ref<number[]>(props.stats.map(() => 0))

// Easing function for smooth animation
const easeOutQuart = (t: number): number => {
  return 1 - Math.pow(1 - t, 4)
}

// Animate a single number
const animateNumber = (index: number, target: number, duration: number = 2000) => {
  const startTime = performance.now()
  const startValue = 0

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easedProgress = easeOutQuart(progress)

    animatedValues.value[index] = Math.round(startValue + (target - startValue) * easedProgress)

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}

// Start animation when section is visible
const startAnimation = () => {
  if (hasAnimated.value) return
  hasAnimated.value = true

  props.stats.forEach((stat, index) => {
    // Stagger the animations slightly
    setTimeout(() => {
      animateNumber(index, stat.value)
    }, index * 150)
  })
}

// Intersection Observer to trigger animation when visible
onMounted(() => {
  if (!sectionRef.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          startAnimation()
          observer.disconnect()
        }
      })
    },
    { threshold: 0.3 }
  )

  observer.observe(sectionRef.value)
})
</script>
