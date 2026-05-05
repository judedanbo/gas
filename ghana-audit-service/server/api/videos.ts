import type { Video } from '~/types'

const mockVideos: Video[] = [
  {
    id: '1',
    title: 'About the Ghana Audit Service',
    description: 'An overview of the Ghana Audit Service, its mandate, and role in promoting accountability.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: '/images/videos/about-gas-thumb.jpg',
    duration: '5:30',
    publishedAt: '2024-01-15'
  },
  {
    id: '2',
    title: 'Auditor-General\'s Message 2024',
    description: 'The Auditor-General addresses stakeholders on the priorities for 2024.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: '/images/videos/ag-message-thumb.jpg',
    duration: '8:45',
    publishedAt: '2024-02-01'
  },
  {
    id: '3',
    title: 'Understanding Performance Audits',
    description: 'A guide to understanding what performance audits are and why they matter.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: '/images/videos/performance-audit-thumb.jpg',
    duration: '12:20',
    publishedAt: '2023-11-10'
  },
  {
    id: '4',
    title: 'CitizensEye App Tutorial',
    description: 'How to use the CitizensEye app to report financial irregularities.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: '/images/videos/citizenseye-thumb.jpg',
    duration: '4:15',
    publishedAt: '2023-08-20'
  },
  {
    id: '5',
    title: '115 Years of Service',
    description: 'Documentary on the history and achievements of the Ghana Audit Service.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: '/images/videos/115-years-thumb.jpg',
    duration: '25:00',
    publishedAt: '2024-02-15'
  },
  {
    id: '6',
    title: 'Public Financial Management in Ghana',
    description: 'Overview of the public financial management framework and the role of external audit.',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: '/images/videos/pfm-thumb.jpg',
    duration: '15:40',
    publishedAt: '2023-06-15'
  }
]

export default defineEventHandler(async () => {
  // Sort by publish date (newest first)
  const videos = [...mockVideos].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return videos
})
