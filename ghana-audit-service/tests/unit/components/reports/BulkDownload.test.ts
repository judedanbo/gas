import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AuditReport } from '~/types'
import type {
  BulkDownloadError,
  StartedBulkDownload
} from '../../../../composables/useReportBulkDownload'
import SelectToggle from '../../../../components/reports/SelectToggle.vue'
import ReportCard from '../../../../components/reports/ReportCard.vue'
import BulkDownloadBar from '../../../../components/reports/BulkDownloadBar.vue'

// Nuxt auto-imports the components rely on. Translations echo the key and its
// parameters, so assertions read as "this message, with these values".
const translate = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key
const barHeight = ref(0)
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
vi.stubGlobal('useI18n', () => ({ t: translate }))
vi.stubGlobal('useElementSize', () => ({ height: barHeight }))
vi.stubGlobal('useCategoryBadge', () => ({
  getAuditCategoryVariant: () => 'primary',
  getAuditCategoryLabel: (category: string) => category
}))
vi.stubGlobal('useLocaleDate', () => ({ formatDateShort: (date: string) => date }))

const global = {
  mocks: { $t: translate },
  stubs: {
    Icon: true,
    UiLoadingSpinner: true,
    UiBaseImage: true,
    UiBadge: { template: '<span><slot /></span>' },
    UiTooltip: { template: '<div><slot /></div>' },
    UiDownloadButton: { template: '<a><slot /></a>' },
    NuxtLink: { props: ['to'], template: '<a href="#"><slot /></a>' },
    ReportsSelectToggle: SelectToggle
  }
}

const REPORT: AuditReport = {
  id: '12',
  title: 'Report on the Public Accounts of Ghana',
  slug: 'public-accounts',
  category: 'financial',
  publishedAt: '2024-06-30',
  year: 2024,
  fileUrl: '/api/downloads/reports/12',
  fileSize: '4.2 MB'
}

describe('ReportsSelectToggle', () => {
  it('is a checkbox named after the report it selects', () => {
    const wrapper = mount(SelectToggle, { props: { title: REPORT.title, selected: false }, global })
    const checkbox = wrapper.get('input[type="checkbox"]')

    expect(checkbox.attributes('aria-label')).toBe(
      `reports.bulk.selectReport ${JSON.stringify({ title: REPORT.title })}`
    )
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
    // The visible word is decoration for assistive tech; it is in the name already.
    expect(wrapper.get('span').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('span').text()).toBe('reports.bulk.select')
  })

  it('reflects the selection it is given and asks to toggle on change', async () => {
    const wrapper = mount(SelectToggle, { props: { title: REPORT.title, selected: true }, global })
    const checkbox = wrapper.get('input')

    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    await checkbox.trigger('change')

    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('is disabled, with the reason on hover, when the selection is full', () => {
    const wrapper = mount(SelectToggle, {
      props: {
        title: REPORT.title,
        selected: false,
        disabled: true,
        disabledReason: 'Limit reached'
      },
      global
    })

    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('label').attributes('title')).toBe('Limit reached')
  })

  it('spells out what selecting is for where there is room', () => {
    const wrapper = mount(SelectToggle, {
      props: { title: REPORT.title, selected: false, long: true },
      global
    })

    expect(wrapper.get('span').text()).toBe('reports.bulk.selectLong')
  })
})

describe('ReportsReportCard selection', () => {
  it('has no checkbox unless selection is switched on', () => {
    const wrapper = mount(ReportCard, { props: { report: REPORT }, global })

    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('emits the report when its checkbox is toggled', async () => {
    const wrapper = mount(ReportCard, { props: { report: REPORT, selectable: true }, global })

    await wrapper.get('input[type="checkbox"]').trigger('change')

    expect(wrapper.emitted('toggle-select')).toEqual([[REPORT]])
  })

  it('marks a selected card beyond the checkbox alone', () => {
    const plain = mount(ReportCard, { props: { report: REPORT, selectable: true }, global })
    const selected = mount(ReportCard, {
      props: { report: REPORT, selectable: true, selected: true },
      global
    })

    expect(plain.get('article').classes()).not.toContain('ring-primary')
    expect(selected.get('article').classes()).toContain('ring-primary')
    expect((selected.get('input').element as HTMLInputElement).checked).toBe(true)
  })

  it('keeps the checkbox out of the way of the card link and download button', () => {
    const wrapper = mount(ReportCard, { props: { report: REPORT, selectable: true }, global })

    // The title link stretches over the whole card; the checkbox must sit above it.
    expect(wrapper.get('label').classes()).toContain('z-10')
  })
})

describe('ReportsBulkDownloadBar', () => {
  function mountBar(
    props: Partial<{
      count: number
      estimatedBytes: number
      hasUnknownSizes: boolean
      checking: boolean
      error: BulkDownloadError | null
      started: StartedBulkDownload | null
    }> = {}
  ) {
    return mount(BulkDownloadBar, {
      props: {
        count: 0,
        maxFiles: 25,
        estimatedBytes: 0,
        hasUnknownSizes: false,
        checking: false,
        error: null,
        started: null,
        ...props
      },
      global,
      attachTo: document.body
    })
  }

  const buttonWith = (wrapper: ReturnType<typeof mountBar>, text: string) =>
    wrapper.findAll('button').find((button) => button.text().includes(text))!

  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.style.scrollPaddingBottom = ''
    barHeight.value = 0
  })

  it('stays out of the way until something is selected', () => {
    const wrapper = mountBar()

    expect(wrapper.find('section').exists()).toBe(false)
    // The live region is there from the start, ready to announce.
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('')
  })

  it('shows how many reports are selected and roughly how large they are', () => {
    const wrapper = mountBar({ count: 3, estimatedBytes: 12 * 1024 ** 2 })

    expect(wrapper.get('section').attributes('aria-label')).toBe('reports.bulk.barLabel')
    expect(wrapper.text()).toContain('reports.bulk.selectedCount {"count":3}')
    expect(wrapper.text()).toContain('reports.bulk.sizeAbout {"size":"12.0 MB"}')
  })

  it('says the size is a minimum when some reports have no size listed', () => {
    const wrapper = mountBar({ count: 2, estimatedBytes: 5 * 1024 ** 2, hasUnknownSizes: true })

    expect(wrapper.text()).toContain('reports.bulk.sizeAtLeast {"size":"5.0 MB"}')
  })

  it('says so when the selection is full', () => {
    const wrapper = mountBar({ count: 25 })

    expect(wrapper.text()).toContain('reports.bulk.limitReached {"max":25}')
  })

  it('asks to download or clear', async () => {
    const wrapper = mountBar({ count: 2 })

    await buttonWith(wrapper, 'reports.bulk.download').trigger('click')
    await buttonWith(wrapper, 'reports.bulk.clear').trigger('click')

    expect(wrapper.emitted('download')).toHaveLength(1)
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('stays focusable but ignores clicks while the server is being asked', async () => {
    const wrapper = mountBar({ count: 2, checking: true })
    const button = buttonWith(wrapper, 'reports.bulk.preparing')

    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')

    expect(wrapper.emitted('download')).toBeUndefined()
  })

  it('announces selection changes to screen readers', async () => {
    const wrapper = mountBar()
    const live = wrapper.get('[aria-live="polite"]')

    await wrapper.setProps({ count: 1 })
    expect(live.text()).toBe('reports.bulk.selectedCount {"count":1}')

    await wrapper.setProps({ count: 25 })
    expect(live.text()).toContain('reports.bulk.selectedCount {"count":25}')
    expect(live.text()).toContain('reports.bulk.limitReached {"max":25}')

    await wrapper.setProps({ count: 0 })
    expect(live.text()).toBe('reports.bulk.cleared')
  })

  describe('once a download has started', () => {
    const started: StartedBulkDownload = {
      ids: [1, 2, 3],
      count: 3,
      bytes: 96 * 1024 ** 2,
      unavailable: 0
    }

    it('confirms it, with the real size, and offers to repeat or close', async () => {
      const wrapper = mountBar({ started })

      expect(wrapper.text()).toContain('reports.bulk.started {"count":3,"size":"96.0 MB"}')
      await buttonWith(wrapper, 'reports.bulk.downloadAgain').trigger('click')
      await buttonWith(wrapper, 'common.close').trigger('click')

      expect(wrapper.emitted('download-again')).toHaveLength(1)
      expect(wrapper.emitted('dismiss')).toHaveLength(1)
    })

    it('mentions reports that had to be left out', () => {
      const wrapper = mountBar({ started: { ...started, count: 2, unavailable: 1 } })

      expect(wrapper.text()).toContain('reports.bulk.startedUnavailable {"count":1}')
    })

    it('announces the start and moves keyboard focus to the confirmation', async () => {
      const wrapper = mountBar({ count: 3 })
      buttonWith(wrapper, 'reports.bulk.download').element.focus()

      // What a successful download does: selection cleared, confirmation shown.
      await wrapper.setProps({ count: 0, started })
      await nextTick()

      expect(wrapper.get('[aria-live="polite"]').text()).toContain('reports.bulk.started')
      expect(document.activeElement?.textContent).toContain('reports.bulk.started')
    })

    it('leaves focus alone if the visitor was not using the bar', async () => {
      const wrapper = mountBar({ count: 3 })
      const elsewhere = document.createElement('button')
      document.body.appendChild(elsewhere)
      elsewhere.focus()

      await wrapper.setProps({ count: 0, started })
      await nextTick()

      expect(document.activeElement).toBe(elsewhere)
    })
  })

  describe('when the download cannot start', () => {
    const alertText = (error: BulkDownloadError, count = 10) =>
      mountBar({ count, error }).get('[role="alert"]').text()

    it('says how long to wait when the download limit is reached', () => {
      expect(alertText({ kind: 'rate-limited', retryAfterSeconds: 754, remaining: 0 })).toBe(
        `reports.bulk.errorLimit ${JSON.stringify({ wait: 'reports.bulk.waitMinutes {"count":13}' })}`
      )
      expect(alertText({ kind: 'rate-limited', retryAfterSeconds: 42, remaining: 0 })).toContain(
        'reports.bulk.waitSeconds {\\"count\\":42}'
      )
      expect(alertText({ kind: 'rate-limited', retryAfterSeconds: null, remaining: 0 })).toContain(
        'reports.bulk.waitLater'
      )
    })

    it('suggests a smaller selection when part of it would still go through', () => {
      const text = alertText({ kind: 'rate-limited', retryAfterSeconds: 1800, remaining: 4 })

      expect(text).toContain('reports.bulk.errorLimitPartial')
      expect(text).toContain('"count":4')
    })

    it('does not suggest removing reports when the whole selection would already fit', () => {
      // Blocked by the per-minute window: waiting is the only fix.
      const text = alertText({ kind: 'rate-limited', retryAfterSeconds: 30, remaining: 20 }, 10)

      expect(text).toContain('reports.bulk.errorLimit ')
    })

    it('gives both sizes when the selection is too large', () => {
      expect(
        alertText({ kind: 'too-large', totalBytes: 1.5 * 1024 ** 3, maxBytes: 1024 ** 3 })
      ).toBe('reports.bulk.errorTooLarge {"size":"1.5 GB","max":"1.0 GB"}')
      expect(alertText({ kind: 'too-large', totalBytes: null, maxBytes: 1024 ** 3 })).toBe(
        'reports.bulk.errorTooLargeUnknown {"max":"1.0 GB"}'
      )
    })

    it('has a message for unavailable files and for anything else', () => {
      expect(alertText({ kind: 'unavailable' })).toBe('reports.bulk.errorUnavailable')
      expect(alertText({ kind: 'failed' })).toBe('reports.bulk.errorFailed')
    })

    it('shows no alert when there is no error', () => {
      expect(mountBar({ count: 2 }).find('[role="alert"]').exists()).toBe(false)
    })
  })

  it('keeps focused content clear of the bar while it is on screen', async () => {
    const wrapper = mountBar({ count: 1 })

    barHeight.value = 72
    await nextTick()
    expect(document.documentElement.style.scrollPaddingBottom).toBe('88px')

    await wrapper.setProps({ count: 0 })
    expect(document.documentElement.style.scrollPaddingBottom).toBe('')
  })

  it('removes the scroll padding when the page is left', async () => {
    const wrapper = mountBar({ count: 1 })
    barHeight.value = 72
    await nextTick()

    wrapper.unmount()

    expect(document.documentElement.style.scrollPaddingBottom).toBe('')
  })
})
