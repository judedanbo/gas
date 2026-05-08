<template>
  <div>
    <CommonBreadcrumb
      :crumbs="[
        { label: 'About Us', path: '/about' },
        { label: 'Management Team', path: '/about/management-team' },
        {
          label: member?.name || 'Profile',
          path: `/about/management-team/${route.params.slug}`,
        },
      ]"
    />

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container">
        <div class="flex justify-center py-12" role="status">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
          ></div>
          <span class="sr-only">Loading profile...</span>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="section">
      <div class="container text-center py-12">
        <Icon
          name="heroicons:user"
          class="w-16 h-16 text-primary dark:text-primary-light mb-4 mx-auto"
          aria-hidden="true"
        />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Member Not Found
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          The team member you're looking for doesn't exist or has been removed.
        </p>
        <NuxtLink to="/about/management-team" class="btn-primary">
          View Management Team
        </NuxtLink>
      </div>
    </div>

    <!-- Profile Content -->
    <template v-else-if="member">
      <!-- Profile Header -->
      <section class="bg-gradient-to-br from-primary to-primary-dark text-white py-12">
        <div class="container">
          <div
            class="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-8"
          >
            <div class="flex-shrink-0">
              <img
                v-if="member.photo"
                :src="member.photo"
                :alt="member.name"
                class="w-48 h-56 object-cover rounded-lg shadow-lg"
              />
              <div
                v-else
                class="w-48 h-56 bg-white/10 rounded-lg flex items-center justify-center"
              >
                <Icon
                  name="heroicons:user"
                  class="w-20 h-20 text-white/50"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div>
              <UiBadge
                :variant="
                  member.role === 'auditor-general' ? 'accent' : 'primary'
                "
                size="lg"
                class="mb-3"
              >
                {{
                  member.role === 'auditor-general'
                    ? 'Auditor-General'
                    : 'Deputy Auditor-General'
                }}
              </UiBadge>
              <h1
                class="text-3xl md:text-4xl font-heading font-bold text-white mb-2"
              >
                {{ member.name }}
              </h1>
              <p class="text-xl text-white/90 mb-4">{{ member.title }}</p>
              <p v-if="member.departmentName" class="text-white/80 mb-4">
                <Icon
                  name="heroicons:building-library"
                  class="w-5 h-5 inline mr-1"
                  aria-hidden="true"
                />
                {{ member.departmentName }}
              </p>
              <div class="flex flex-wrap gap-4">
                <a
                  v-if="member.email"
                  :href="`mailto:${member.email}`"
                  class="text-white/90 hover:text-white transition-colors no-underline"
                >
                  <UiIconText icon="heroicons:envelope" color="default">
                    {{ member.email }}
                  </UiIconText>
                </a>
                <span v-if="member.phone" class="text-white/90">
                  <UiIconText icon="heroicons:phone" color="default">
                    {{ member.phone }}
                  </UiIconText>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Bio Sections + Sidebar -->
      <section class="section">
        <div class="container">
          <div class="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10">
            <!-- Bio Content -->
            <div class="flex-1 min-w-0">
              <div class="space-y-8">
                <div
                  v-for="(section, index) in bioSections"
                  :key="index"
                  class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8"
                >
                  <h2
                    v-if="section.heading"
                    class="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4"
                  >
                    {{ section.heading }}
                  </h2>
                  <div
                    class="prose prose-gray dark:prose-invert max-w-none whitespace-pre-line"
                  >
                    {{ section.content }}
                  </div>
                </div>
              </div>

              <!-- Back Link -->
              <div class="mt-10">
                <NuxtLink
                  to="/about/management-team"
                  class="btn-outline inline-flex items-center gap-2"
                >
                  <Icon
                    name="heroicons:arrow-left"
                    class="w-5 h-5"
                    aria-hidden="true"
                  />
                  Back to Management Team
                </NuxtLink>
              </div>
            </div>

            <!-- Team Sidebar -->
            <aside
              v-if="otherMembers.length > 0"
              class="lg:w-72 flex-shrink-0"
            >
              <div
                class="lg:sticky lg:top-24 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5"
              >
                <h3
                  class="text-sm font-heading font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4"
                >
                  Management Team
                </h3>
                <nav aria-label="Management team members">
                  <ul class="space-y-3">
                    <li v-for="m in otherMembers" :key="m.id">
                      <NuxtLink
                        :to="`/about/management-team/${m.slug}`"
                        class="flex items-center gap-3 p-2 rounded-md no-underline transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <img
                          v-if="m.photo"
                          :src="m.photo"
                          :alt="m.name"
                          class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                        <div
                          v-else
                          class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0"
                        >
                          <Icon
                            name="heroicons:user"
                            class="w-5 h-5 text-gray-400 dark:text-gray-500"
                            aria-hidden="true"
                          />
                        </div>
                        <div class="min-w-0">
                          <p
                            class="text-sm font-semibold text-gray-900 dark:text-white truncate m-0"
                          >
                            {{ m.name }}
                          </p>
                          <p
                            class="text-xs text-gray-500 dark:text-gray-400 truncate m-0"
                          >
                            {{
                              m.role === 'auditor-general'
                                ? 'Auditor-General'
                                : 'DAG'
                            }}
                          </p>
                        </div>
                      </NuxtLink>
                    </li>
                  </ul>
                </nav>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { ManagementTeamMember } from '~/types'
  import { parseBioSections } from '~/utils/parseBioSections'

  const route = useRoute()

  const {
    data: member,
    pending,
    error,
  } = await useFetch<ManagementTeamMember>(
    `/api/management-team/${route.params.slug}`
  )

  const { data: allMembers } =
    await useFetch<ManagementTeamMember[]>('/api/management-team')

  const otherMembers = computed(() =>
    (allMembers.value || []).filter((m) => m.slug !== route.params.slug)
  )

  const bioSections = computed(() => {
    if (!member.value?.bio) return []
    return parseBioSections(member.value.bio)
  })

  useSeoMeta({
    title: () =>
      member.value
        ? `${member.value.name} - ${member.value.title} | Ghana Audit Service`
        : 'Team Member | Ghana Audit Service',
    description: () =>
      member.value
        ? `Profile of ${member.value.name}, ${member.value.title} at the Ghana Audit Service.`
        : 'Management team member profile at the Ghana Audit Service.',
  })
</script>
