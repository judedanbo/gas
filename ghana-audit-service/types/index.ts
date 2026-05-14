/**
 * Ghana Audit Service - TypeScript Type Definitions
 */

// ============================================
// Navigation Types
// ============================================

export interface NavItem {
  label: string
  href: string
  icon?: string
  children?: NavItem[]
  isExternal?: boolean
}

export interface Breadcrumb {
  label: string
  href?: string
}

// ============================================
// Content Types
// ============================================

export interface AuditReport {
  id: string
  title: string
  slug: string
  category: AuditCategory
  publishedAt: string
  year: number
  fileUrl: string
  fileSize: string
  summary?: string
  thumbnail?: string
}

export type AuditCategory =
  | 'financial'
  | 'compliance'
  | 'it'
  | 'performance'
  | 'technical'
  | 'follow-up'
  | 'special'

export interface Publication {
  id: string
  title: string
  slug: string
  type: PublicationType
  publishedAt: string
  fileUrl?: string
  content?: string
  excerpt?: string
  thumbnail?: string
}

export type PublicationType =
  | 'press-statement'
  | 'bulletin'
  | 'guideline'
  | 'manual'
  | 'strategy'
  | 'law'

export interface NewsArticleImage {
  url: string
  alt: string
  caption?: string
}

export interface NewsArticle {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  publishedAt: string
  author?: string
  thumbnail?: string
  category?: string
  tags?: string[]
  images?: NewsArticleImage[]
}

export interface EventImage {
  url: string
  alt: string
  caption?: string
}

export interface Event {
  id: string
  title: string
  slug: string
  description: string
  content?: string
  startDate: string
  endDate?: string
  location?: string
  isVirtual?: boolean
  registrationUrl?: string
  thumbnail?: string
  images?: EventImage[]
}

// ============================================
// Organization Types
// ============================================

export interface TeamMember {
  id: string
  name: string
  position: string
  department?: string
  bio?: string
  photo?: string
  email?: string
  phone?: string
  order: number
}

export interface Department {
  id: string
  name: string
  description: string
  head?: TeamMember
  functions: string[]
  order: number
}

export interface PastAuditorGeneral {
  id: string
  name: string
  tenureStart: string
  tenureEnd: string
  photo?: string
  achievements?: string[]
  order: number
}

export interface ManagementTeamMember {
  id: string
  slug: string
  role: 'auditor-general' | 'deputy-auditor-general' | 'regional-auditor'
  name: string
  title?: string
  bio?: string
  icon?: string
  photo?: string
  email?: string
  phone?: string
  responsibilities: string[]
  order: number
  isActive: boolean
  regionalOfficeId?: number
  regionalOfficeName?: string
  departmentId?: number
  departmentName?: string
}

// ============================================
// Career & Procurement Types
// ============================================

export interface Vacancy {
  id: string
  title: string
  slug: string
  department: string
  location: string
  type: 'full-time' | 'part-time' | 'contract'
  description: string
  requirements: string[]
  deadline: string
  publishedAt: string
  isActive: boolean
}

export interface Tender {
  id: string
  title: string
  slug: string
  referenceNumber: string
  description: string
  category: string
  submissionDeadline: string
  openingDate?: string
  documentUrl?: string
  publishedAt: string
  status: 'open' | 'closed' | 'awarded'
}

// ============================================
// Contact & Form Types
// ============================================

export interface ContactInfo {
  phones: string[]
  email: string
  postalAddress: string
  physicalAddress: string
  digitalAddress: string
  workingHours?: string
}

export interface ContactFormData {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
}

export interface RegionalOffice {
  id: string
  name: string
  region: string
  address: string
  phone?: string
  email?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

// ============================================
// Statistics Types
// ============================================

export interface OrganizationStats {
  yearsOfExistence: number
  staffCount: number
  departments: number
  regions: number
  branches: number
  districts: number
}

export interface StatItem {
  label: string
  value: number
  suffix?: string
  icon?: string
}

// ============================================
// Slideshow Types
// ============================================

export interface HeroSlide {
  id: string
  type: 'news' | 'event' | 'gallery' | 'report'
  image: string
  imageAlt: string
  title: string
  excerpt: string
  linkUrl: string
  linkLabel: string
  categoryLabel?: string
  publishedAt?: string
}

// ============================================
// Media Types
// ============================================

export interface GalleryImage {
  id: string
  url: string
  alt: string
  caption?: string
  category?: string
  uploadedAt: string
}

export interface Video {
  id: string
  title: string
  description?: string
  url: string
  thumbnail?: string
  duration?: string
  publishedAt: string
}

// ============================================
// API Response Types
// ============================================

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    perPage: number
    lastPage: number
    typeCounts?: Record<string, number>
  }
}

export interface ApiError {
  message: string
  code?: string
  errors?: Record<string, string[]>
}

// ============================================
// Search Types
// ============================================

export interface SearchResult {
  id: string
  type:
    | 'report'
    | 'publication'
    | 'news'
    | 'event'
    | 'tender'
    | 'vacancy'
    | 'video'
    | 'gallery'
    | 'team'
    | 'office'
    | 'page'
  title: string
  excerpt: string
  url: string
  publishedAt?: string
}

export interface SearchFilters {
  query: string
  type?: string
  category?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  perPage?: number
}
