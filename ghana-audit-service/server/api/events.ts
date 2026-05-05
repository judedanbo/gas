import type { Event } from '~/types'

const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Annual Audit Conference 2024',
    slug: 'annual-audit-conference-2024',
    description: 'Join us for the Annual Audit Conference bringing together auditors, stakeholders, and partners to discuss emerging trends in public sector auditing.',
    startDate: '2024-09-15',
    endDate: '2024-09-17',
    location: 'Accra International Conference Centre',
    isVirtual: false
  },
  {
    id: '2',
    title: 'ISSAI Implementation Workshop',
    slug: 'issai-workshop-2024',
    description: 'A hands-on workshop on implementing International Standards of Supreme Audit Institutions in audit practice.',
    startDate: '2024-08-20',
    endDate: '2024-08-22',
    location: 'Ghana Audit Service Training Centre',
    isVirtual: false
  },
  {
    id: '3',
    title: 'Digital Audit Tools Webinar',
    slug: 'digital-audit-webinar',
    description: 'Online session exploring the latest digital tools and technologies for modern auditing.',
    startDate: '2024-07-25',
    location: 'Online',
    isVirtual: true,
    registrationUrl: 'https://example.com/register'
  },
  {
    id: '4',
    title: 'Public Financial Management Forum',
    slug: 'pfm-forum-2024',
    description: 'Forum bringing together government officials, civil society, and development partners to discuss public financial management reforms.',
    startDate: '2024-10-10',
    endDate: '2024-10-11',
    location: 'Kempinski Hotel Gold Coast City, Accra',
    isVirtual: false
  },
  {
    id: '5',
    title: 'Staff Training: Performance Audit Methodology',
    slug: 'performance-audit-training',
    description: 'Internal training program on performance audit methodology and reporting.',
    startDate: '2024-06-10',
    endDate: '2024-06-14',
    location: 'GAS Training Centre, Accra',
    isVirtual: false
  },
  {
    id: '6',
    title: 'AFROSAI-E Technical Update Meeting',
    slug: 'afrosai-technical-meeting',
    description: 'Regional meeting of African SAIs to share experiences and technical updates.',
    startDate: '2024-11-05',
    endDate: '2024-11-08',
    location: 'Nairobi, Kenya',
    isVirtual: false
  }
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const now = new Date()

  let events = [...mockEvents]

  // Filter by upcoming or past
  if (query.filter === 'upcoming') {
    events = events.filter(e => new Date(e.startDate) >= now)
  } else if (query.filter === 'past') {
    events = events.filter(e => new Date(e.startDate) < now)
  }

  // Sort by date
  events.sort((a, b) => {
    const dateA = new Date(a.startDate)
    const dateB = new Date(b.startDate)
    return query.filter === 'past'
      ? dateB.getTime() - dateA.getTime()  // Past events: newest first
      : dateA.getTime() - dateB.getTime()  // Upcoming: soonest first
  })

  return events
})
