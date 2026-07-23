import { describe, it, expect } from 'vitest'
import { applyLiveStatus, extractVideoId, videoFromLiveEvent } from '../../../utils/liveVideos'
import type { LiveEvent, Video } from '../../../types'

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: '1',
    title: 'A video',
    url: 'https://www.youtube.com/embed/aaaaaaaaaaa',
    publishedAt: '2026-01-01',
    ...overrides
  }
}

function makeLiveEvent(videoId: string, overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    videoId,
    title: 'Live stream',
    url: `https://www.youtube.com/embed/${videoId}`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    ...overrides
  }
}

describe('extractVideoId', () => {
  it('extracts from embed, watch, and short URLs', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns the input when no id is found', () => {
    expect(extractVideoId('https://example.com/video.mp4')).toBe('https://example.com/video.mp4')
  })
})

describe('videoFromLiveEvent', () => {
  it('builds a live synthetic video', () => {
    const video = videoFromLiveEvent(
      makeLiveEvent('bbbbbbbbbbb', { thumbnail: 'https://t.jpg', startedAt: '2026-07-23' })
    )

    expect(video).toEqual({
      id: 'live-bbbbbbbbbbb',
      title: 'Live stream',
      url: 'https://www.youtube.com/embed/bbbbbbbbbbb',
      thumbnail: 'https://t.jpg',
      publishedAt: '2026-07-23',
      isLive: true
    })
  })
})

describe('applyLiveStatus', () => {
  it('returns the list unchanged when nothing is live', () => {
    const videos = [makeVideo()]
    expect(applyLiveStatus(videos, [])).toBe(videos)
  })

  it('marks a matching video as live and sorts it first', () => {
    const videos = [
      makeVideo({
        id: '1',
        url: 'https://www.youtube.com/embed/aaaaaaaaaaa',
        publishedAt: '2026-07-01'
      }),
      makeVideo({
        id: '2',
        url: 'https://www.youtube.com/embed/bbbbbbbbbbb',
        publishedAt: '2026-01-01'
      })
    ]

    const result = applyLiveStatus(videos, [makeLiveEvent('bbbbbbbbbbb')])

    expect(result[0].id).toBe('2')
    expect(result[0].isLive).toBe(true)
    expect(result[1].id).toBe('1')
    expect(result[1].isLive).toBeUndefined()
    // input is not mutated
    expect(videos[1].isLive).toBeUndefined()
  })

  it('prepends a synthetic card when the live broadcast is not in the list', () => {
    const videos = [makeVideo({ publishedAt: '2026-07-01' })]

    const result = applyLiveStatus(videos, [makeLiveEvent('ccccccccccc')])

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('live-ccccccccccc')
    expect(result[0].isLive).toBe(true)
  })

  it('keeps non-live videos sorted by publish date descending', () => {
    const videos = [
      makeVideo({ id: 'old', url: 'https://youtu.be/ddddddddddd', publishedAt: '2020-01-01' }),
      makeVideo({ id: 'new', url: 'https://youtu.be/eeeeeeeeeee', publishedAt: '2026-07-01' })
    ]

    const result = applyLiveStatus(videos, [makeLiveEvent('fffffffffff')])

    expect(result.map((v) => v.id)).toEqual(['live-fffffffffff', 'new', 'old'])
  })
})
