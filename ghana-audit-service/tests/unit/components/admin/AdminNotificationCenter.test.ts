import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from 'vue'
import AdminNotificationCenter from '~/components/admin/layout/AdminNotificationCenter.vue'
import AdminNotificationItem from '~/components/admin/ui/AdminNotificationItem.vue'
import type { AdminNotification } from '~/types/admin'

// Nuxt auto-imports the components rely on.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)

const route = reactive({ fullPath: '/admin' })
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useAdminAuth', () => ({ user: ref({ id: 7 }) }))

function notification(overrides: Partial<AdminNotification> = {}): AdminNotification {
  return {
    id: 'upload:1',
    source: 'report-upload',
    category: 'upload',
    status: 'success',
    title: 'Report upload complete',
    subject: 'AG Report 2025.pdf',
    meta: '5.0 MB',
    progress: null,
    progressLabel: null,
    progressDetail: null,
    thumbnailUrl: null,
    notes: [{ text: 'Reduced 20 MB → 5 MB', tone: 'success' }],
    actions: [{ label: 'Open report', to: '/admin/reports/42/edit' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    ...overrides
  }
}

const running = notification({
  id: 'upload:2',
  status: 'running',
  title: 'Uploading report',
  progress: 40,
  progressLabel: 'Classifying pages…',
  progressDetail: 'Page 3 of 10',
  notes: [],
  actions: [],
  finishedAt: null
})

interface FakeStore {
  notifications: Ref<AdminNotification[]>
  activeCount: Ref<number>
  unreadCount: Ref<number>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  openPanel: ReturnType<typeof vi.fn>
  closePanel: ReturnType<typeof vi.fn>
  dismiss: ReturnType<typeof vi.fn>
  clearFinished: ReturnType<typeof vi.fn>
}

let store: FakeStore
vi.stubGlobal('useAdminNotifications', () => store)

function mountCenter() {
  return mount(AdminNotificationCenter, {
    attachTo: document.body,
    global: {
      components: { AdminUiAdminNotificationItem: AdminNotificationItem },
      stubs: { NuxtLink: RouterLinkStub, UiBaseImage: true }
    }
  })
}

beforeEach(() => {
  route.fullPath = '/admin'
  store = {
    notifications: ref([running, notification()]),
    activeCount: ref(1),
    unreadCount: ref(1),
    start: vi.fn(),
    stop: vi.fn(),
    openPanel: vi.fn(() => ['upload:1']),
    closePanel: vi.fn(),
    dismiss: vi.fn(async () => true),
    clearFinished: vi.fn(async () => true)
  }
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AdminNotificationCenter', () => {
  it('starts the feed and summarizes it on the bell', () => {
    const wrapper = mountCenter()
    expect(store.start).toHaveBeenCalled()

    const bell = wrapper.get('button[aria-haspopup="dialog"]')
    expect(bell.attributes('aria-label')).toBe('Notifications (1 in progress, 1 unread)')
    expect(bell.attributes('aria-expanded')).toBe('false')
    expect(bell.text()).toContain('1')
    wrapper.unmount()
    expect(store.stop).toHaveBeenCalled()
  })

  it('opens a labelled dialog that splits running work from outcomes', async () => {
    const wrapper = mountCenter()
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')

    expect(store.openPanel).toHaveBeenCalled()
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-labelledby')).toBe('admin-notifications-title')
    expect(wrapper.get('button[aria-haspopup="dialog"]').attributes('aria-expanded')).toBe('true')
    await nextTick()
    expect(document.activeElement).toBe(dialog.element)

    const headings = dialog.findAll('h3').map((h) => h.text())
    expect(headings).toEqual(['In progress', 'Recent'])

    // Running work shows an accessible progress bar; outcomes can be dismissed.
    const bar = dialog.get('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('40')
    expect(bar.attributes('aria-valuetext')).toBe('40% — Classifying pages… — Page 3 of 10')
    expect(dialog.findAll('button').filter((b) => b.text() === 'Dismiss')).toHaveLength(1)

    // The entry that was unread when opened is flagged for screen readers.
    expect(dialog.text()).toContain('New:')
    wrapper.unmount()
  })

  it('links each entry and the whole feed to the notification pages', async () => {
    const wrapper = mountCenter()
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    const links = wrapper.findAllComponents(RouterLinkStub).map((l) => l.props('to'))
    expect(links).toContain('/admin/notifications')
    expect(links).toContain('/admin/notifications/upload%3A1')
    expect(links).toContain('/admin/notifications/upload%3A2')
    wrapper.unmount()
  })

  it('closes on Escape and hands focus back to the bell', async () => {
    const wrapper = mountCenter()
    const bell = wrapper.get('button[aria-haspopup="dialog"]')
    await bell.trigger('click')

    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(store.closePanel).toHaveBeenCalled()
    expect(document.activeElement).toBe(bell.element)
    wrapper.unmount()
  })

  it('closes when the admin clicks elsewhere or navigates', async () => {
    const wrapper = mountCenter()
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    document.body.click()
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    route.fullPath = '/admin/reports'
    await nextTick()
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('dismisses one entry or clears every finished one', async () => {
    const wrapper = mountCenter()
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    const dialog = wrapper.get('[role="dialog"]')

    const dismiss = dialog.findAll('button').find((b) => b.text() === 'Dismiss')!
    expect(dismiss.attributes('aria-label')).toBe(
      'Dismiss notification: Report upload complete — AG Report 2025.pdf'
    )
    await dismiss.trigger('click')
    expect(store.dismiss).toHaveBeenCalledWith('upload:1')

    const clear = dialog.findAll('button').find((b) => b.text() === 'Clear all')!
    await clear.trigger('click')
    expect(store.clearFinished).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows an empty state when there is nothing to report', async () => {
    store.notifications.value = []
    store.activeCount.value = 0
    store.unreadCount.value = 0
    const wrapper = mountCenter()
    expect(wrapper.get('button[aria-haspopup="dialog"]').attributes('aria-label')).toBe(
      'Notifications'
    )
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain("You're all caught up")
    expect(wrapper.findAll('button').some((b) => b.text() === 'Clear all')).toBe(false)
    wrapper.unmount()
  })
})
