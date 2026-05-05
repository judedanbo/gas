import type { GalleryImage } from '~/types'

const mockGallery: GalleryImage[] = [
  {
    id: '1',
    url: '/images/gallery/ag-parliament-2024.jpg',
    alt: 'Auditor-General presenting reports to Parliament',
    caption: 'AG presenting 2023 Annual Reports to Parliament',
    category: 'Official Events',
    uploadedAt: '2024-06-15'
  },
  {
    id: '2',
    url: '/images/gallery/afrosai-workshop.jpg',
    alt: 'AFROSAI-E Workshop participants',
    caption: 'Participants at the AFROSAI-E Regional Workshop',
    category: 'Workshops',
    uploadedAt: '2024-05-20'
  },
  {
    id: '3',
    url: '/images/gallery/staff-training.jpg',
    alt: 'Staff training session',
    caption: 'ISSAI Implementation Training Program',
    category: 'Training',
    uploadedAt: '2024-03-25'
  },
  {
    id: '4',
    url: '/images/gallery/115-anniversary.jpg',
    alt: '115th Anniversary celebration',
    caption: 'Ghana Audit Service 115th Anniversary Celebration',
    category: 'Celebrations',
    uploadedAt: '2024-02-15'
  },
  {
    id: '5',
    url: '/images/gallery/management-meeting.jpg',
    alt: 'Management team meeting',
    caption: 'Annual Management Retreat',
    category: 'Official Events',
    uploadedAt: '2024-01-10'
  },
  {
    id: '6',
    url: '/images/gallery/world-bank-signing.jpg',
    alt: 'MoU signing with World Bank',
    caption: 'Signing ceremony for World Bank partnership',
    category: 'Partnerships',
    uploadedAt: '2024-06-10'
  },
  {
    id: '7',
    url: '/images/gallery/regional-directors.jpg',
    alt: 'Regional Directors conference',
    caption: 'Annual Regional Directors Conference',
    category: 'Official Events',
    uploadedAt: '2023-11-15'
  },
  {
    id: '8',
    url: '/images/gallery/it-audit-launch.jpg',
    alt: 'IT Audit Manual launch',
    caption: 'Launch of the updated IT Audit Manual',
    category: 'Publications',
    uploadedAt: '2024-04-15'
  },
  {
    id: '9',
    url: '/images/gallery/community-outreach.jpg',
    alt: 'Community outreach program',
    caption: 'Audit awareness community outreach',
    category: 'Outreach',
    uploadedAt: '2023-09-20'
  }
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  let images = [...mockGallery]

  // Filter by category
  if (query.category) {
    images = images.filter(img => img.category === query.category)
  }

  // Sort by upload date (newest first)
  images.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

  // Get unique categories
  const categories = [...new Set(mockGallery.map(img => img.category))]

  return {
    images,
    categories
  }
})
