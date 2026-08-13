<template>
  <div>
    <CommonBreadcrumb :crumbs="breadcrumbs" />

    <!-- Page Header -->
    <section class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Board Members</h1>
        <p class="max-w-[600px] mx-auto text-lg text-white/90">
          Meet the members of the governing board of the Ghana Audit Service
        </p>
      </div>
    </section>

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container flex justify-center py-12" role="status">
        <div
          class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
        <span class="sr-only">Loading board members...</span>
      </div>
    </div>

    <template v-else>
      <!-- Chairperson -->
      <section v-if="chairperson" class="section">
        <div class="container">
          <div class="max-w-[900px] mx-auto">
            <NuxtLink
              :to="`/about/board-members/${chairperson.slug}`"
              class="block no-underline text-inherit hover:no-underline"
            >
              <UiProfileCard
                :name="chairperson.name"
                :title="chairperson.title"
                :bio="getIntro(chairperson.bio)"
                :image="chairperson.photo"
                size="lg"
                featured
              >
                <template #default>
                  <UiBadge variant="accent" size="lg" class="mb-4">Chairperson</UiBadge>
                </template>
                <template v-if="chairperson.email" #actions>
                  <a
                    :href="`mailto:${chairperson.email}`"
                    class="no-underline hover:text-primary transition-colors"
                  >
                    <UiIconText icon="heroicons:envelope" color="default">{{
                      chairperson.email
                    }}</UiIconText>
                  </a>
                </template>
              </UiProfileCard>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Board Members -->
      <section
        v-if="members.length > 0"
        class="section"
        :class="{ 'bg-gray-50 dark:bg-gray-900': chairperson }"
      >
        <div class="container">
          <UiSectionHeader title="Members" description="Members of the governing board" />
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div
              v-for="member in members"
              :key="member.id"
              class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6"
            >
              <NuxtLink
                :to="`/about/board-members/${member.slug}`"
                class="block no-underline text-inherit hover:no-underline"
              >
                <UiProfileCard
                  :name="member.name"
                  :title="member.title"
                  :bio="getIntro(member.bio)"
                  :image="member.photo"
                  size="sm"
                  layout="horizontal"
                >
                  <template #default>
                    <UiBadge variant="primary" size="sm" class="mb-2">Board Member</UiBadge>
                  </template>
                </UiProfileCard>
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- Empty State -->
      <section v-if="!chairperson && members.length === 0" class="section">
        <div class="container text-center py-12">
          <Icon
            name="heroicons:user-group"
            class="w-16 h-16 text-primary dark:text-primary-light mb-4 mx-auto"
            aria-hidden="true"
          />
          <p class="text-gray-600 dark:text-gray-400">
            Board member information will be available soon.
          </p>
        </div>
      </section>
    </template>

    <!-- Contact CTA -->
    <section class="section bg-gradient-to-br from-primary to-primary-dark">
      <div class="container">
        <div class="text-center max-w-[600px] mx-auto">
          <h2 class="text-2xl md:text-3xl font-heading font-bold text-white mb-4">
            Contact the Board
          </h2>
          <p class="text-white/90 leading-relaxed mb-8">
            For official inquiries to the governing board, please contact our Corporate Affairs
            unit.
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
  import type { BoardMember } from '~/types'
  import { parseBioSections } from '~/utils/parseBioSections'
  import { htmlToExcerpt } from '~/utils/htmlToPlainText'

  // Flattened to text: ProfileCard interpolates this, and admin-authored bios are HTML.
  function getIntro(bio?: string): string | undefined {
    if (!bio) return undefined
    const sections = parseBioSections(bio)
    // Prefer the untitled preamble, else the first section's content
    const content = sections.find((s) => s.heading === null)?.content || sections[0]?.content
    return htmlToExcerpt(content, 200) || undefined
  }

  useHead({ title: 'Board Members' })

  useSeoMeta({
    title: 'Board Members - Ghana Audit Service',
    description: 'Meet the members of the governing board of the Ghana Audit Service.',
    ogTitle: 'Board Members - Ghana Audit Service',
    ogDescription: 'Meet the members of the governing board of the Ghana Audit Service.'
  })

  const breadcrumbs = [
    { label: 'About Us', path: '/about' },
    { label: 'Board Members', path: '/about/board-members' }
  ]

  const { data: boardMembers, pending } = await useFetch<BoardMember[]>('/api/board-members')

  const chairperson = computed(
    () => boardMembers.value?.find((m) => m.role === 'chairperson') || null
  )

  // Everyone except the featured chairperson — filtering by id (not role) so an
  // unexpected second chairperson is still shown rather than silently dropped
  const members = computed(
    () => boardMembers.value?.filter((m) => m.id !== chairperson.value?.id) || []
  )
</script>
