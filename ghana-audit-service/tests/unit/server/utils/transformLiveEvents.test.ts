import { describe, it, expect } from 'vitest'
import {
  liveEventFromVideoId,
  transformLiveEvents
} from '../../../../server/utils/transformLiveEvents'

describe('transformLiveEvents', () => {
  it('builds a complete DTO from a video id', () => {
    const event = liveEventFromVideoId(
      'abc123DEF-_',
      'My Stream',
      'https://thumb.jpg',
      '2026-07-23'
    )

    expect(event).toEqual({
      videoId: 'abc123DEF-_',
      title: 'My Stream',
      thumbnail: 'https://thumb.jpg',
      url: 'https://www.youtube.com/embed/abc123DEF-_',
      watchUrl: 'https://www.youtube.com/watch?v=abc123DEF-_',
      startedAt: '2026-07-23'
    })
  })

  it('defaults title and thumbnail when missing', () => {
    const event = liveEventFromVideoId('abc123DEF-_', '')

    expect(event.title).toBe('Live broadcast')
    expect(event.thumbnail).toBe('https://i.ytimg.com/vi/abc123DEF-_/hqdefault.jpg')
    expect(event.startedAt).toBeUndefined()
  })

  it('keeps only items flagged live with a video id', () => {
    const events = transformLiveEvents([
      { id: { videoId: 'live0000001' }, snippet: { title: 'Live', liveBroadcastContent: 'live' } },
      {
        id: { videoId: 'upcoming001' },
        snippet: { title: 'Soon', liveBroadcastContent: 'upcoming' }
      },
      { id: {}, snippet: { title: 'No id', liveBroadcastContent: 'live' } },
      {}
    ])

    expect(events).toHaveLength(1)
    expect(events[0].videoId).toBe('live0000001')
  })

  it('prefers the highest-resolution thumbnail available', () => {
    const [event] = transformLiveEvents([
      {
        id: { videoId: 'live0000001' },
        snippet: {
          title: 'Live',
          liveBroadcastContent: 'live',
          thumbnails: {
            default: { url: 'https://t/default.jpg' },
            medium: { url: 'https://t/medium.jpg' }
          }
        }
      }
    ])

    expect(event.thumbnail).toBe('https://t/medium.jpg')
  })
})
