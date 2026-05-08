<template>
  <div>
    <CommonBreadcrumb :crumbs="breadcrumbs" />

    <!-- Page Header -->
    <section class="page-header">
      <div class="container">
        <h1>Management Team</h1>
        <p class="max-w-[600px] mx-auto text-lg text-white/90">
          Meet the leadership team driving accountability and transparency in Ghana
        </p>
      </div>
    </section>

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container flex justify-center py-12">
        <div
          class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    </div>

    <template v-else>
      <!-- Auditor-General -->
      <section v-if="auditorGeneral" class="section">
        <div class="container">
          <div class="max-w-[900px] mx-auto">
            <UiProfileCard
              :name="auditorGeneral.name"
              :title="auditorGeneral.title"
              :description="auditorGeneral.bio"
              :image="auditorGeneral.photo || '/images/ags/johnson_akuamoah_asiedu.jpg'"
              size="lg"
              featured
            >
              <template #default>
                <UiBadge variant="accent" size="lg" class="mb-4">Auditor-General</UiBadge>
              </template>
              <template v-if="auditorGeneral.email" #actions>
                <a
                  :href="`mailto:${auditorGeneral.email}`"
                  class="no-underline hover:text-primary transition-colors"
                >
                  <UiIconText icon="heroicons:envelope" color="default">{{
                    auditorGeneral.email
                  }}</UiIconText>
                </a>
              </template>
            </UiProfileCard>
          </div>
        </div>
      </section>

      <!-- Organization Chart -->
      <!-- <section v-if="deputyAuditorsGeneral.length > 0" class="section bg-gray-50 dark:bg-gray-900">
        <div class="container">
          <UiSectionHeader
            title="Organizational Structure"
            :description="`The Ghana Audit Service is organized into ${deputyAuditorsGeneral.length} Deputy Auditor-General portfolios`"
          />
          <div class="max-w-[1000px] mx-auto">
            <div class="flex justify-center mb-8">
              <div class="bg-primary text-white rounded-lg p-6 text-center">
                <Icon name="heroicons:user" class="w-8 h-8 mx-auto mb-2" aria-hidden="true" />
                <span class="font-semibold block text-sm">Auditor-General</span>
              </div>
            </div>
            <div class="flex justify-center gap-4 flex-wrap">
              <div
                v-for="dag in deputyAuditorsGeneral"
                :key="dag.id"
                class="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center cursor-pointer transition-all hover:border-primary dark:hover:border-primary-light hover:shadow-lg min-w-[140px]"
                :class="{
                  'border-primary dark:border-primary-light bg-primary/5 dark:bg-primary/20':
                    activeDag === dag.id
                }"
                @click="toggleDag(dag.id)"
              >
                <Icon
                  :name="dag.icon || 'heroicons:building-library'"
                  class="w-8 h-8 mx-auto mb-2 text-primary dark:text-primary-light"
                  aria-hidden="true"
                />
                <span class="font-semibold block text-sm text-gray-900 dark:text-white">DAG</span>
                <span class="block text-xs text-gray-400 dark:text-gray-500 mt-1">{{
                  dag.title
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </section> -->

      <!-- Deputy Auditors-General Profiles -->
      <section v-if="deputyAuditorsGeneral.length > 0" class="section">
        <div class="container">
          <UiSectionHeader
            title="Deputy Auditors-General"
            description="Senior leadership overseeing key operational areas"
          />
          <div class="flex flex-col gap-8">
            <div
              v-for="dag in deputyAuditorsGeneral"
              :key="dag.id"
              class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6"
            >
              <UiProfileCard
                :name="dag.name"
                :title="dag.title"
                :description="dag.bio"
                :image="dag.photo"
                size="sm"
                layout="horizontal"
              >
                <template #default>
                  <UiBadge variant="primary" size="sm" class="mb-2">Deputy Auditor-General</UiBadge>
                </template>
              </UiProfileCard>
              <div
                v-if="dag.responsibilities.length > 0"
                class="mt-4 ml-0 md:ml-[calc(150px+1.5rem)]"
              >
                <h4 class="text-sm font-semibold mb-3 text-gray-900 dark:text-white">
                  Key Responsibilities
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <UiCheckList
                    :items="dag.responsibilities.slice(0, 2)"
                    icon="bullet"
                    spacing="sm"
                  />
                  <UiCheckList :items="dag.responsibilities.slice(2)" icon="bullet" spacing="sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Regional Auditors Section -->
    <section v-if="regionalAuditors.length > 0" class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Regional Auditors"
          description="Regional leaders ensuring audit coverage across Ghana"
        />
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UiInfoCard
            v-for="auditor in regionalAuditors"
            :key="auditor.id"
            :title="auditor.name"
            variant="centered"
            :bordered="true"
            hover
          >
            <template #icon>
              <div
                class="w-[70px] h-[85px] mx-auto bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center mb-3 overflow-hidden"
              >
                <img
                  v-if="auditor.photo"
                  :src="auditor.photo"
                  :alt="auditor.name"
                  class="w-full h-full object-cover"
                />
                <Icon
                  v-else
                  name="heroicons:user"
                  class="w-12 h-12 text-gray-400 dark:text-gray-500 opacity-30"
                  aria-hidden="true"
                />
              </div>
            </template>
            <template #description>
              <p class="text-xs text-gray-400 dark:text-gray-500 mb-1">{{ auditor.title }}</p>
              <p class="text-xs text-primary dark:text-primary-light font-semibold m-0">
                {{ auditor.regionalOfficeName }}
              </p>
            </template>
          </UiInfoCard>
        </div>
      </div>
    </section>

    <!-- Regional Structure -->
    <section class="section">
      <div class="container">
        <UiSectionHeader
          title="Regional Presence"
          description="Our nationwide network of offices ensures comprehensive audit coverage"
        />
        <UiStatGrid :stats="regionalStats" :columns="4" class="mb-10" />
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div
            v-for="region in regions"
            :key="region"
            class="p-3 bg-gray-100 dark:bg-gray-800 rounded-md"
          >
            <UiIconText icon="heroicons:map-pin" size="sm" color="default">{{ region }}</UiIconText>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact Leadership -->
    <section class="section bg-gradient-to-br from-primary to-primary-dark">
      <div class="container">
        <div class="text-center max-w-[600px] mx-auto">
          <h2 class="text-white mb-4">Contact Our Leadership</h2>
          <p class="text-white/90 leading-relaxed mb-8">
            For official inquiries or to reach our management team, please contact our Corporate
            Affairs unit.
          </p>
          <div class="flex gap-4 justify-center flex-wrap">
            <a href="mailto:info@audit.gov.gh" class="btn-accent btn-lg">Send Email</a>
            <NuxtLink
              to="/contact"
              class="btn border-2 border-white text-white hover:bg-white hover:text-primary"
              >Contact Page</NuxtLink
            >
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { ManagementTeamMember } from '~/types'

  useHead({ title: 'Management Team' })

  useSeoMeta({
    title: 'Management Team - Ghana Audit Service',
    description:
      'Meet the leadership team of the Ghana Audit Service - the Auditor-General and Deputy Auditors-General driving accountability in public financial management.',
    ogTitle: 'Management Team - Ghana Audit Service',
    ogDescription: 'Meet the leadership team driving accountability and transparency in Ghana.'
  })

  const breadcrumbs = [
    { label: 'About Us', path: '/about' },
    { label: 'Management Team', path: '/about/management-team' }
  ]

  // Fetch management team from API
  const { data: managementTeam, pending } =
    await useFetch<ManagementTeamMember[]>('/api/management-team')

  // Separate AG and DAGs
  const auditorGeneral = computed(
    () => managementTeam.value?.find((m) => m.role === 'auditor-general') || null
  )

  const deputyAuditorsGeneral = computed(
    () => managementTeam.value?.filter((m) => m.role === 'deputy-auditor-general') || []
  )

  const regionalAuditors = computed(
    () => managementTeam.value?.filter((m) => m.role === 'regional-auditor') || []
  )

  const activeDag = ref<string | null>(null)
  const toggleDag = (id: string) => {
    activeDag.value = activeDag.value === id ? null : id
  }

  const regionalStats = [
    { icon: 'heroicons:building-library', value: 1, label: 'Headquarters (Accra)' },
    { icon: 'heroicons:building-office', value: 17, label: 'Accra Branches' },
    { icon: 'heroicons:map-pin', value: 16, label: 'Regional Offices' },
    { icon: 'heroicons:map-pin', value: 95, label: 'District Offices' }
  ]

  const regions = [
    'Greater Accra',
    'Ashanti',
    'Western',
    'Central',
    'Eastern',
    'Volta',
    'Northern',
    'Upper East',
    'Upper West',
    'Bono',
    'Bono East',
    'Ahafo',
    'Western North',
    'Oti',
    'North East',
    'Savannah'
  ]
</script>
