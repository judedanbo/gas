import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoCard from '../../../../components/media/VideoCard.vue'
import type { Video } from '../../../../types'

const baseVideo: Video = {
  id: '1',
  title: 'Auditor-General briefing',
  description: 'Highlights from the briefing',
  url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  duration: '12:34',
  publishedAt: '2026-07-01'
}

function mountCard(video: Video) {
  return mount(VideoCard, {
    props: { video },
    global: {
      mocks: { $t: (key: string) => key }
    }
  })
}

describe('MediaVideoCard', () => {
  it('renders duration and date, and no live badge, for a regular video', () => {
    const wrapper = mountCard(baseVideo)

    expect(wrapper.text()).toContain('12:34')
    expect(wrapper.find('time').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('videos.liveBadge')
    expect(wrapper.text()).not.toContain('videos.streamingNow')
    expect(wrapper.find('article').attributes('aria-label')).toBeUndefined()
  })

  it('renders the live badge with screen-reader context for a live video', () => {
    const wrapper = mountCard({ ...baseVideo, isLive: true })

    expect(wrapper.text()).toContain('videos.liveBadge')
    expect(wrapper.find('.sr-only').text()).toBe('videos.liveNowA11y')
  })

  it('hides duration and shows the streaming label instead of a date when live', () => {
    const wrapper = mountCard({ ...baseVideo, isLive: true })

    expect(wrapper.text()).not.toContain('12:34')
    expect(wrapper.find('time').exists()).toBe(false)
    expect(wrapper.text()).toContain('videos.streamingNow')
  })

  it('labels the card with the live status for assistive tech when live', () => {
    const wrapper = mountCard({ ...baseVideo, isLive: true })

    expect(wrapper.find('article').attributes('aria-label')).toBe(
      'Auditor-General briefing — videos.liveNowA11y'
    )
  })

  it('emits play with the video when the thumbnail is clicked', async () => {
    const wrapper = mountCard(baseVideo)

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('play')).toHaveLength(1)
    expect(wrapper.emitted('play')![0][0]).toEqual(baseVideo)
  })
})
