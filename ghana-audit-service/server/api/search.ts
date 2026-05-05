import type { SearchResult, PaginatedResponse } from '~/types'

// Mock search results combining reports, publications, and pages
const mockSearchData: SearchResult[] = [
  {
    id: 'report-1',
    type: 'report',
    title: 'Report of the Auditor-General on the Public Accounts of Ghana - MDAs 2023',
    excerpt: 'Annual audit report covering all Ministries, Departments and Agencies for the 2023 fiscal year.',
    url: '/reports/ag-report-mdas-2023',
    publishedAt: '2024-06-15'
  },
  {
    id: 'report-2',
    type: 'report',
    title: 'Performance Audit Report on the Management of Government Payroll',
    excerpt: 'Assessment of the effectiveness of payroll management systems across government.',
    url: '/reports/performance-audit-payroll-2023',
    publishedAt: '2024-03-10'
  },
  {
    id: 'pub-1',
    type: 'publication',
    title: 'Press Statement on the Release of 2023 Audit Reports',
    excerpt: 'The Ghana Audit Service announces the release of the 2023 annual audit reports.',
    url: '/publications/press-statements/press-statement-2023-audit-reports',
    publishedAt: '2024-06-15'
  },
  {
    id: 'pub-2',
    type: 'publication',
    title: 'Financial Audit Manual',
    excerpt: 'Comprehensive guide for conducting financial audits in accordance with ISSAI standards.',
    url: '/publications/amis-manuals',
    publishedAt: '2023-01-15'
  },
  {
    id: 'news-1',
    type: 'news',
    title: 'Ghana Audit Service Partners with World Bank on Capacity Building',
    excerpt: 'New partnership aims to strengthen audit capabilities and promote international best practices.',
    url: '/media/news/world-bank-partnership',
    publishedAt: '2024-05-20'
  },
  {
    id: 'news-2',
    type: 'news',
    title: 'Auditor-General Addresses Parliament on Audit Findings',
    excerpt: 'Johnson Akuamoah Asiedu presents key findings from the 2023 audit reports to Parliament.',
    url: '/media/news/ag-parliament-address',
    publishedAt: '2024-06-18'
  },
  {
    id: 'page-1',
    type: 'page',
    title: 'About the Ghana Audit Service',
    excerpt: 'Learn about our constitutional mandate, history, and role in ensuring public accountability.',
    url: '/about'
  },
  {
    id: 'page-2',
    type: 'page',
    title: 'Contact Us',
    excerpt: 'Get in touch with the Ghana Audit Service headquarters or regional offices.',
    url: '/contact'
  },
  {
    id: 'page-3',
    type: 'page',
    title: 'CitizensEye App',
    excerpt: 'Report concerns and engage with the Ghana Audit Service through our citizen platform.',
    url: '/citizenseye'
  }
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  if (!query.query) {
    return {
      data: [],
      meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
    }
  }

  const searchTerm = String(query.query).toLowerCase()
  let filtered = mockSearchData.filter(item =>
    item.title.toLowerCase().includes(searchTerm) ||
    item.excerpt.toLowerCase().includes(searchTerm)
  )

  // Filter by type
  if (query.type) {
    filtered = filtered.filter(item => item.type === query.type)
  }

  // Filter by date range
  if (query.dateFrom) {
    filtered = filtered.filter(item =>
      item.publishedAt && item.publishedAt >= String(query.dateFrom)
    )
  }
  if (query.dateTo) {
    filtered = filtered.filter(item =>
      item.publishedAt && item.publishedAt <= String(query.dateTo)
    )
  }

  // Pagination
  const page = Number(query.page) || 1
  const perPage = Number(query.perPage) || 10
  const total = filtered.length
  const lastPage = Math.ceil(total / perPage) || 1
  const start = (page - 1) * perPage
  const data = filtered.slice(start, start + perPage)

  const response: PaginatedResponse<SearchResult> = {
    data,
    meta: {
      total,
      page,
      perPage,
      lastPage
    }
  }

  return response
})
