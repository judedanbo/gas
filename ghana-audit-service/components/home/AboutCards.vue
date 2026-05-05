<template>
  <section class="section bg-gray-50 dark:bg-gray-900">
    <div class="container">
      <UiSectionHeader
        title="About Audit Service"
        description="Established over a century ago, we continue to uphold the highest standards of public accountability."
      />
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <UiInfoCard
          v-for="card in aboutCards"
          :key="card.title"
          :icon="card.icon"
          :title="card.title"
          :description="card.description"
          variant="centered"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  const aboutCards = [
    {
      icon: 'heroicons:building-library',
      title: 'Who We Are',
      description:
        'The supreme audit institution of Ghana established by the Constitution to ensure public accountability.'
    },
    {
      icon: 'heroicons:flag',
      title: 'Our Mission',
      description:
        'To promote good governance, accountability and transparency in the management of public resources.'
    },
    {
      icon: 'heroicons:eye',
      title: 'Our Vision',
      description:
        'To be a world-class supreme audit institution that contributes to improved public financial management.'
    },
    {
      icon: 'heroicons:document',
      title: 'Our Mandate',
      description:
        'Constitutional mandate to audit all public accounts and report to Parliament on the proper use of public funds.'
    }
  ]
</script>
