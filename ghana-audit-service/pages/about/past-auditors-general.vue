<template>
  <div>
    <CommonBreadcrumb :crumbs="breadcrumbs" />

    <!-- Page Header -->
    <section class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Past Auditors-General</h1>
        <p class="max-w-[600px] mx-auto text-lg text-white/90">
          Honoring the distinguished leaders who have shaped our institution
        </p>
      </div>
    </section>

    <!-- Current Auditor-General -->
    <section class="section">
      <div class="container">
        <UiProfileCard
          :name="currentAG.name"
          :subtitle="currentAG.tenure"
          :description="currentAG.bio"
          image="/images/ags/johnson_akuamoah_asiedu.jpg"
          size="lg"
          featured
        >
          <template #default>
            <UiBadge variant="primary" size="lg" class="mb-4">Current Auditor-General</UiBadge>
          </template>
        </UiProfileCard>
        <!-- <div class="mt-6 ml-0 md:ml-[calc(220px+2.5rem)]">
          <h4 class="text-base mb-3 font-semibold text-gray-900 dark:text-white">Key Achievements</h4>
          <UiCheckList :items="currentAG.achievements" icon="check" divided />
        </div> -->
      </div>
    </section>

    <!-- Past Auditors-General List -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Our Distinguished Predecessors"
          description="Leaders who established the foundation of public accountability in Ghana"
        />
        <div class="flex flex-col gap-6">
          <div
            v-for="(ag, index) in pastAuditorsGeneral"
            :key="ag.name"
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all hover:border-primary dark:hover:border-primary-light hover:shadow-md"
            :class="{
              'border-primary dark:border-primary-light bg-primary/5 dark:bg-primary/20':
                index === 0
            }"
          >
            <UiProfileCard
              :name="ag.name"
              :subtitle="ag.tenure"
              :description="ag.description"
              :image="ag.image"
              size="sm"
              layout="horizontal"
            />
            <!-- <div
              v-if="ag.legacy"
              class="mt-4 ml-0 md:ml-[calc(100px+1.5rem)] text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-100 dark:bg-gray-700 rounded-md border-l-[3px] border-accent"
            >
              <strong class="text-gray-900 dark:text-white">Legacy:</strong> {{ ag.legacy }}
            </div> -->
          </div>
        </div>
      </div>
    </section>

    <!-- Legacy Section -->
    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10 items-center">
          <div>
            <h2
              class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-4"
            >
              A Legacy of Excellence
            </h2>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              The Auditors-General of Ghana have collectively built an institution known for its
              integrity, professionalism, and commitment to public service. Each leader has
              contributed to strengthening the culture of accountability and transparency that
              defines the Ghana Audit Service today.
            </p>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              From the colonial era to the present day, these distinguished professionals have
              navigated changing political landscapes while maintaining the independence and
              credibility of the office.
            </p>
          </div>
          <UiStatGrid :stats="legacyStats" :columns="3" />
        </div>
      </div>
    </section>

    <!-- Role of the Auditor-General -->
    <section class="section bg-gradient-to-br from-primary to-primary-dark">
      <div class="container">
        <div class="text-center max-w-[1000px] mx-auto">
          <h2 class="text-2xl md:text-3xl font-heading font-bold text-white mb-4">
            The Role of the Auditor-General
          </h2>
          <p class="text-white/90 text-lg leading-relaxed mb-10">
            The Auditor-General of Ghana is a constitutional officer appointed by the President,
            acting on the advice of the Council of State, and approved by Parliament.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div
              v-for="role in agRoles"
              :key="role.title"
              class="bg-white/10 rounded-lg p-6 text-center"
            >
              <Icon
                :name="role.icon"
                class="w-12 h-12 mx-auto mb-3 text-accent"
                aria-hidden="true"
              />
              <h4 class="text-accent mb-2 font-semibold text-base">{{ role.title }}</h4>
              <p class="text-white/80 text-sm m-0 leading-relaxed">{{ role.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  useHead({ title: 'Past Auditors-General' })

  useSeoMeta({
    title: 'Past Auditors-General - Ghana Audit Service',
    description:
      'Learn about the distinguished Auditors-General who have led the Ghana Audit Service throughout its history.',
    ogTitle: 'Past Auditors-General - Ghana Audit Service',
    ogDescription: 'Honoring the distinguished leaders who have shaped our institution.'
  })

  const breadcrumbs = [
    { label: 'About Us', path: '/about' },
    { label: 'Past Auditors-General', path: '/about/past-auditors-general' }
  ]

  const currentAG = {
    name: 'Johnson Akuamoah Asiedu',
    tenure: '2021 - Present',
    bio: 'Mr. Johnson Akuamoah Asiedu is the current Auditor-General of Ghana. He brings decades of experience in public sector auditing and financial management to the role. Under his leadership, the Ghana Audit Service has continued to strengthen its operations and impact.',
    achievements: [
      'Enhanced digitalization of audit processes through AMIS',
      'Strengthened collaboration with Parliament on audit findings',
      'Improved timely submission of audit reports',
      'Advanced capacity building programs for staff',
      'Promoted citizen engagement through the CitizensEye App'
    ]
  }

  const pastAuditorsGeneral = [
    {
      name: 'Daniel Yaw Domelevo',
      tenure: '2016 - 2020',
      image: '/images/ags/daniel_yaw_domelevo.jpg',
      description:
        'Served as Auditor-General with a focus on fighting corruption and improving public financial management.',
      legacy: 'Known for landmark audit reports and anti-corruption stance.'
    },
    {
      name: 'Richard Quartei Quartey',
      image: '/images/ags/richard_q._quartey.jpg',
      tenure: '2009 - 2016',
      description:
        'Led the Service through significant modernization efforts and strengthened international cooperation.',
      legacy: 'Expanded the scope of performance auditing.'
    },
    {
      name: 'Edward Dua Agyeman',
      tenure: '2001 - 2009',
      image: '/images/ags/edward_dua_agyeman.jpg',
      description:
        'Oversaw the implementation of the Audit Service Act and transformation into a corporate body.',
      legacy: 'Established the foundation for modern audit practices.'
    },
    {
      name: 'Osei Tutu Prempeh',
      tenure: '1990 - 2001',
      image: '/images/ags/osei_tutu_prempeh.jpg',
      description:
        'First Auditor-General of the Fourth Republic, establishing audit practices under the 1992 Constitution.',
      legacy: 'Built institutional framework for constitutional mandate.'
    },
    {
      name: 'Richard Tello Nelson',
      tenure: '1983 - 1989',
      image: '/images/ags/richard_tello_nelson.jpg'
      // description:
      //   'Several distinguished professionals served as Auditor-General (or equivalent) during the colonial period and early independence era.',
      // legacy: 'Established the foundational practices of public sector auditing in Ghana.'
    },
    {
      name: 'James Benoni Haizel Coleman',
      tenure: '1982 - 1983',
      image: '/images/ags/james_benoni_haizel_coleman.jpg'
      // description:
      //   'Several distinguished professionals served as Auditor-General (or equivalent) during the colonial period and early independence era.',
      // legacy: 'Established the foundational practices of public sector auditing in Ghana.'
    },
    {
      name: 'Ahenkora Osei',
      tenure: '1963 - 1981',
      image: '/images/ags/ahenkora_osei.jpg'
      // description:
      //   'Several distinguished professionals served as Auditor-General (or equivalent) during the colonial period and early independence era.',
      // legacy: 'Established the foundational practices of public sector auditing in Ghana.'
    },
    {
      name: 'Neville Warde Sabine',
      tenure: '1963 - 1981',
      image: '/images/ags/neville-warde-sabine.jpeg'
      // description:
      //   'Several distinguished professionals served as Auditor-General (or equivalent) during the colonial period and early independence era.',
      // legacy: 'Established the foundational practices of public sector auditing in Ghana.'
    },
    {
      name: 'R. F. Pinder',
      tenure: '1946 - 1951'
      // description:
      //   'Several distinguished professionals served as Auditor-General (or equivalent) during the colonial period and early independence era.',
      // legacy: 'Established the foundational practices of public sector auditing in Ghana.'
    },
    {
      name: 'Henry Vernon Cusack',
      tenure: '1938 - 1946'
      // description:
      //   'Several distinguished professionals served as Auditor-General (or equivalent) during the colonial period and early independence era.',
      // legacy: 'Established the foundational practices of public sector auditing in Ghana.'
    },
    {
      name: 'Arthur Stanley Cramer',
      tenure: '1933 - 1938'
      // description:
      //   'Several distinguished professionals served as Auditor-General (or equivalent) during the colonial period and early independence era.',
      // legacy: 'Established the foundational practices of public sector auditing in Ghana.'
    },
    {
      name: 'Walter Bowerley',
      tenure: '1910 - 1932'
      // description:
      //   'Several distinguished professionals served as Auditor-General (or equivalent) during the colonial period and early independence era.',
      // legacy: 'Established the foundational practices of public sector auditing in Ghana.'
    }
  ]

  const legacyStats = [
    { icon: 'heroicons:document', value: 115, label: 'Years of Service', suffix: '+' },
    { icon: 'heroicons:user', value: pastAuditorsGeneral.length + 1, label: 'Auditors-General' },
    { icon: 'heroicons:flag', value: 4, label: 'Republics Served' }
  ]

  const agRoles = [
    {
      icon: 'heroicons:scale',
      title: 'Constitutional Authority',
      description: 'Exercises authority derived from Articles 187-189 of the Constitution'
    },
    {
      icon: 'heroicons:chart-bar',
      title: 'Audit Responsibility',
      description: 'Responsible for auditing all public accounts and reporting to Parliament'
    },
    {
      icon: 'heroicons:shield-check',
      title: 'Independence',
      description: 'Not subject to direction or control of any person or authority'
    },
    {
      icon: 'heroicons:pencil-square',
      title: 'Reporting',
      description: 'Submits annual reports and special reports to Parliament'
    }
  ]
</script>
