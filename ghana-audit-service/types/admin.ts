// Admin Dashboard Types

/**
 * Functional area a user may operate in. Orthogonal to `role`: the role sets
 * CRUD depth, modules scope which areas. Admins implicitly have all modules.
 */
export type ModuleKey =
  | 'reports'
  | 'content'
  | 'careers'
  | 'organization'
  | 'media'
  | 'analytics'
  | 'communications'

export const ALL_MODULES: ModuleKey[] = [
  'reports',
  'content',
  'careers',
  'organization',
  'media',
  'analytics',
  'communications'
]

export interface AdminUser {
  id: number
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  modules: ModuleKey[]
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type Permission = 'read' | 'create' | 'update' | 'delete' | 'manage_users'

export interface SessionTiming {
  createdAt: string
  lastActivityAt: string
  idleExpiresAt: string
  absoluteExpiresAt: string
  /** Soonest of idle/absolute expiry — what the client counts down to. */
  expiresAt: string
  /** Lead time (ms) before `expiresAt` to show the warning modal. */
  warningBeforeMs: number
}

export interface LoginResponse {
  user: AdminUser
  token: string
  expiresAt: string | null
  session?: SessionTiming
}

export interface RefreshResponse {
  session: SessionTiming
  expiresAt: string
}

export interface MeResponse {
  user: AdminUser
  session?: SessionTiming
}

export interface AdminSessionInfo {
  id: number
  current: boolean
  createdAt: string
  lastActivityAt: string
  absoluteExpiresAt: string
  ipAddress: string | null
  userAgent: string | null
}

export interface AuthContext {
  user: AdminUser
  token: string
}

// Pagination
export interface PaginationMeta {
  total: number
  page: number
  perPage: number
  lastPage: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// Translation structure
export interface Translations<T> {
  en: T
  ak?: T
}

// Audit log entry
export interface AuditLogEntry {
  id: number
  user: {
    id: number
    name: string
    email: string
  } | null
  action: 'create' | 'update' | 'delete' | 'restore' | 'login' | 'logout' | 'export'
  entityType: string
  entityId: number | null
  changes: Record<string, unknown>
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

// Upload response
export interface UploadResponse {
  success: boolean
  filename: string
  originalName: string
  size: number
  mimeType: string
  url: string
}

// Content type categories
export type AuditCategory =
  | 'financial'
  | 'compliance'
  | 'it'
  | 'performance'
  | 'technical'
  | 'follow-up'
  | 'special'
export type PublicationType =
  | 'press-statement'
  | 'bulletin'
  | 'guideline'
  | 'manual'
  | 'strategy'
  | 'law'
export type VacancyType = 'full-time' | 'part-time' | 'contract'
export type TenderStatus = 'open' | 'closed' | 'awarded' | 'cancelled'
export type SubmissionStatus = 'pending' | 'read' | 'responded' | 'archived'

// Admin content types with translations
export interface AdminAuditReport {
  id: number
  slug: string
  category: AuditCategory
  fileUrl: string
  fileSize: number | null
  thumbnail: string | null
  isPublished: boolean
  publishedAt: string | null
  createdBy: number
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    title: string
    summary?: string | null
  }>
}

export interface AdminPublication {
  id: number
  slug: string
  type: PublicationType
  fileUrl: string | null
  fileSize: number | null
  thumbnail: string | null
  isPublished: boolean
  publishedAt: string | null
  createdBy: number
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    title: string
    excerpt?: string | null
    content?: string | null
  }>
}

export interface AdminNewsArticle {
  id: number
  slug: string
  author: string | null
  thumbnail: string | null
  category: string | null
  isPublished: boolean
  publishedAt: string | null
  createdBy: number
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    title: string
    excerpt?: string | null
    content?: string | null
  }>
  tags: Array<{ id: number; name: string; slug: string }>
}

export interface AdminEvent {
  id: number
  slug: string
  startDate: string
  endDate: string | null
  isVirtual: boolean
  registrationUrl: string | null
  thumbnail: string | null
  isPublished: boolean
  createdBy: number
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    title: string
    description?: string | null
    location?: string | null
  }>
}

export interface AdminVacancy {
  id: number
  slug: string
  departmentId: number | null
  location: string
  type: VacancyType
  deadline: string
  publishedAt: string | null
  isActive: boolean
  createdBy: number
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    title: string
    description?: string | null
  }>
  requirements?: Array<{
    id?: number
    displayOrder: number
    translations: Translations<{
      description: string
    }>
  }>
}

export interface AdminTender {
  id: number
  slug: string
  referenceNumber: string
  category: string
  submissionDeadline: string
  openingDate: string | null
  documentUrl: string | null
  publishedAt: string | null
  status: TenderStatus
  createdBy: number
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    title: string
    description?: string | null
  }>
}

export interface AdminDepartment {
  id: number
  slug: string
  headId: number | null
  displayOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    name: string
    description?: string | null
  }>
  functions?: Array<{
    id?: number
    displayOrder: number
    translations: Translations<{
      description: string
    }>
  }>
}

export interface AdminTeamMember {
  id: number
  departmentId: number | null
  photo: string | null
  email: string | null
  phone: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    name: string
    position: string
    bio?: string | null
  }>
}

export type ManagementRole =
  | 'auditor-general'
  | 'deputy-auditor-general'
  | 'regional-auditor'
  | 'district-auditor'
  | 'sector-head'
  | 'branch-head'

export interface AdminManagementTeamMember {
  id: number
  slug: string
  role: ManagementRole
  officeId: number | null
  departmentId: number | null
  icon: string | null
  photo: string | null
  email: string | null
  phone: string | null
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    name: string
    title?: string | null
    bio?: string | null
  }>
  responsibilities?: Array<{
    id?: number
    displayOrder: number
    translations: Translations<{
      description: string
    }>
  }>
  regionalOffice?: {
    id: number
    region: string
    translations: Translations<{
      name: string
    }>
  }
}

export interface AdminOffice {
  id: number
  slug: string
  typeId: number
  parentId: number | null
  typeName?: string
  typeSlug?: string
  region: string
  phone: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  displayOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    name: string
    address?: string | null
  }>
}

/** @deprecated Use AdminOffice instead */
export type AdminRegionalOffice = AdminOffice

export interface AdminGalleryImage {
  id: number
  url: string
  category: string | null
  albumId: number | null
  createdBy: number
  uploadedAt: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    alt?: string | null
    caption?: string | null
  }>
}

export interface AdminGalleryAlbum {
  id: number
  slug: string
  coverImageId: number | null
  publishedAt: string
  isPublished: boolean
  imageCount: number
  previewImages: string[]
  createdBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    title: string
    description?: string | null
  }>
}

export interface AdminVideo {
  id: number
  url: string
  thumbnail: string | null
  duration: string | null
  isPublished: boolean
  publishedAt: string | null
  createdBy: number
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  translations: Translations<{
    title: string
    description?: string | null
  }>
}

export interface AdminTag {
  id: number
  name: string
  slug: string
  createdAt: string
}

export interface NewsletterSubscriber {
  id: number
  email: string
  confirmed: boolean
  subscribedAt: string
  unsubscribedAt: string | null
}

export interface ContactSubmission {
  id: number
  name: string
  email: string
  subject: string
  message: string
  status: SubmissionStatus
  respondedAt: string | null
  respondedBy: number | null
  submittedAt: string
  createdAt: string
}

// Form input types for create/update
export interface ReportInput {
  slug: string
  category: AuditCategory
  fileUrl: string
  fileSize?: number | null
  thumbnail?: string | null
  isPublished: boolean
  publishedAt?: string | null
  translations: Translations<{
    title: string
    summary?: string | null
  }>
}

export interface PublicationInput {
  slug: string
  type: PublicationType
  fileUrl?: string | null
  fileSize?: number | null
  thumbnail?: string | null
  isPublished: boolean
  publishedAt?: string | null
  translations: Translations<{
    title: string
    excerpt?: string | null
    content?: string | null
  }>
}

export interface NewsInput {
  slug: string
  author?: string | null
  thumbnail?: string | null
  category?: string | null
  isPublished: boolean
  publishedAt?: string | null
  tagIds?: number[]
  translations: Translations<{
    title: string
    excerpt?: string | null
    content?: string | null
  }>
}

export interface EventInput {
  slug: string
  startDate: string
  endDate?: string | null
  isVirtual: boolean
  registrationUrl?: string | null
  thumbnail?: string | null
  isPublished: boolean
  translations: Translations<{
    title: string
    description?: string | null
    location?: string | null
  }>
}

export interface VacancyInput {
  slug: string
  departmentId?: number | null
  location: string
  type: VacancyType
  deadline: string
  publishedAt?: string | null
  isActive: boolean
  translations: Translations<{
    title: string
    description?: string | null
  }>
  requirements?: Array<{
    displayOrder: number
    translations: Translations<{
      description: string
    }>
  }>
}

export interface TenderInput {
  slug: string
  referenceNumber: string
  category: string
  submissionDeadline: string
  openingDate?: string | null
  documentUrl?: string | null
  publishedAt?: string | null
  status: TenderStatus
  translations: Translations<{
    title: string
    description?: string | null
  }>
}

export interface DepartmentInput {
  slug: string
  headId?: number | null
  displayOrder: number
  translations: Translations<{
    name: string
    description?: string | null
  }>
  functions?: Array<{
    displayOrder: number
    translations: Translations<{
      description: string
    }>
  }>
}

export interface TeamMemberInput {
  departmentId?: number | null
  photo?: string | null
  email?: string | null
  phone?: string | null
  displayOrder: number
  translations: Translations<{
    name: string
    position: string
    bio?: string | null
  }>
}

export interface OfficeInput {
  slug: string
  typeId: number
  parentId?: number | null
  region: string
  phone?: string | null
  email?: string | null
  latitude?: number | null
  longitude?: number | null
  displayOrder: number
  translations: Translations<{
    name: string
    address?: string | null
  }>
}

/** @deprecated Use OfficeInput instead */
export type RegionalOfficeInput = OfficeInput

export interface GalleryImageInput {
  url: string
  category?: string | null
  albumId?: number | null
  translations: Translations<{
    alt?: string | null
    caption?: string | null
  }>
}

export interface GalleryAlbumInput {
  slug: string
  coverImageId?: number | null
  publishedAt: string
  isPublished: boolean
  translations: Translations<{
    title: string
    description?: string | null
  }>
}

export interface VideoInput {
  url: string
  thumbnail?: string | null
  duration?: string | null
  isPublished: boolean
  publishedAt?: string | null
  translations: Translations<{
    title: string
    description?: string | null
  }>
}

export interface TagInput {
  name: string
  slug: string
}

export interface UserInput {
  email: string
  name: string
  password?: string
  role: 'admin' | 'editor' | 'viewer'
  modules?: ModuleKey[]
  isActive: boolean
}

export interface ManagementTeamMemberInput {
  slug: string
  role: ManagementRole
  officeId?: number | null
  departmentId?: number | null
  icon?: string | null
  photo?: string | null
  email?: string | null
  phone?: string | null
  displayOrder: number
  isActive: boolean
  translations: Translations<{
    name: string
    title?: string | null
    bio?: string | null
  }>
  responsibilities?: Array<{
    displayOrder: number
    translations: Translations<{
      description: string
    }>
  }>
}
