<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Site Statistics</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Manage the figures shown on the home page and About pages. Figures can be entered manually
          or pulled from the HR application, with a manual override on every figure.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-secondary inline-flex items-center gap-2 whitespace-nowrap"
        :disabled="syncing"
        @click="syncFromHr"
      >
        <svg
          class="w-5 h-5"
          :class="{ 'animate-spin': syncing }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {{ syncing ? 'Syncing...' : 'Sync from HR' }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <div v-else class="space-y-8">
      <section
        v-for="group in groupedStats"
        :key="group.section"
        class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
      >
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ group.title }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ group.description }}</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
              >
                <th class="px-6 py-3 font-medium">Label</th>
                <th class="px-6 py-3 font-medium">Displayed value</th>
                <th class="px-6 py-3 font-medium">Source</th>
                <th class="px-6 py-3 font-medium">Status</th>
                <th class="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="stat in group.stats"
                :key="stat.id"
                class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                @click="navigateTo(`/admin/site-stats/${stat.id}/edit`)"
              >
                <td class="px-6 py-4">
                  <p class="font-medium text-gray-900 dark:text-white">{{ stat.label }}</p>
                  <p class="text-xs text-gray-400 font-mono">{{ stat.statKey }}</p>
                </td>
                <td class="px-6 py-4 font-semibold text-gray-900 dark:text-white tabular-nums">
                  {{ displayedValue(stat) }}{{ stat.suffix || '' }}
                </td>
                <td class="px-6 py-4">
                  <span v-if="stat.source === 'hr_api'" class="badge badge-primary">HR API</span>
                  <span v-else class="badge badge-secondary">Manual</span>
                  <span
                    v-if="stat.source === 'hr_api' && stat.overrideEnabled"
                    class="badge badge-warning ml-1"
                    title="Manual override is active — the HR value is ignored"
                    >Overridden</span
                  >
                </td>
                <td class="px-6 py-4">
                  <span :class="stat.isActive ? 'badge badge-success' : 'badge badge-secondary'">{{
                    stat.isActive ? 'Active' : 'Hidden'
                  }}</span>
                </td>
                <td class="px-6 py-4 text-right">
                  <NuxtLink
                    :to="`/admin/site-stats/${stat.id}/edit`"
                    aria-label="Edit"
                    class="inline-flex p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    @click.stop
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { AdminSiteStat, SiteStatSection } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, fetchAll } = useAdminCrud<AdminSiteStat>('site-stats')
  const { post } = useAdminApi()
  const toast = useToast()

  const syncing = ref(false)

  const SECTION_META: Record<SiteStatSection, { title: string; description: string }> = {
    home: {
      title: 'Home Page',
      description: 'Animated counters in the hero statistics band on the home page.'
    },
    about_service: {
      title: 'About — The Service',
      description: 'The "Our Audit Universe" figures on /about/the-service.'
    },
    about_legacy: {
      title: 'About — Past Auditors-General',
      description: 'The "A Legacy of Excellence" figures on /about/past-auditors-general.'
    }
  }

  const SECTION_ORDER: SiteStatSection[] = ['home', 'about_service', 'about_legacy']

  const groupedStats = computed(() =>
    SECTION_ORDER.map((section) => ({
      section,
      title: SECTION_META[section].title,
      description: SECTION_META[section].description,
      stats: items.value
        .filter((s) => s.section === section)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    })).filter((g) => g.stats.length > 0)
  )

  // Mirrors resolveStatValue on the server so the admin table shows what the
  // public site will render.
  function displayedValue(stat: AdminSiteStat): number {
    const useApi = stat.source === 'hr_api' && !stat.overrideEnabled && stat.apiValue != null
    return useApi ? (stat.apiValue as number) : stat.manualValue
  }

  async function syncFromHr() {
    syncing.value = true
    try {
      const result = await post<{ synced: number; skipped: number }>('site-stats/sync')
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} figure${result.synced === 1 ? '' : 's'} from HR.`)
      } else {
        toast.info(
          'No figures updated. The HR API may not be configured yet, or no metrics matched.'
        )
      }
      await fetchAll()
    } catch {
      toast.error('Failed to sync from HR.')
    } finally {
      syncing.value = false
    }
  }

  onMounted(() => fetchAll())
</script>
