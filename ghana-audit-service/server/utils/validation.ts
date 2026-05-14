import { z } from 'zod'
import type { H3Error } from 'h3'

/**
 * Collect all Zod issues into dot-path keyed errors, preserving nested paths.
 * e.g. { "translations.en.description": "Required", "requirements.0.translations.en.description": "Too small" }
 */
export function collectZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !errors[path]) {
      errors[path] = issue.message
    }
  }
  return errors
}

/**
 * Flatten Zod field errors from arrays to single strings (legacy helper, kept for direct callers)
 */
export function flattenZodErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      errors[field] = messages[0]
    }
  }
  return errors
}

/**
 * Create a validation error with field-level errors
 * Use this for both Zod validation errors and custom field errors (e.g., duplicate slug)
 */
export function createValidationError(errors: Record<string, string>): H3Error {
  return createError({
    statusCode: 400,
    statusMessage: 'Validation Error',
    data: { errors }
  })
}

/**
 * Validate request body with a Zod schema and throw formatted errors
 * Returns parsed data if valid, throws H3Error with field errors if invalid
 */
export function validateBody<T extends z.ZodSchema>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createValidationError(collectZodErrors(parsed.error))
  }
  return parsed.data
}

// Common schemas
export const localeSchema = z.enum(['en', 'ak'])

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20)
})

export const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')

// Translation schema helper
function translationsSchema<T extends z.ZodRawShape>(fields: T) {
  const akFields = Object.fromEntries(
    Object.entries(fields).map(([key, schema]) => [
      key,
      z.preprocess(
        (val) => (val === '' || val === null ? undefined : val),
        (schema as z.ZodTypeAny).optional()
      )
    ])
  )
  return z.object({
    en: z.object(fields),
    ak: z
      .object(akFields)
      .optional()
      .transform((ak) => {
        if (!ak) return undefined
        const hasValue = Object.values(ak).some((v) => v !== undefined)
        return hasValue ? ak : undefined
      })
  })
}

// Audit Reports
export const auditReportSchema = z.object({
  slug: slugSchema,
  category: z.enum(['financial', 'compliance', 'it', 'performance', 'technical', 'follow-up', 'special']),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  fileUrl: z.string().max(500).or(z.literal('')),
  fileSize: z.coerce.number().optional().nullable(),
  thumbnail: z.string().max(500).optional().nullable().or(z.literal('')),
  isPublished: z.boolean().default(false),
  translations: translationsSchema({
    title: z.string().min(1).max(500),
    summary: z.string().optional().nullable()
  })
})

// Publications
export const publicationSchema = z.object({
  slug: slugSchema,
  type: z.enum(['press-statement', 'bulletin', 'guideline', 'manual', 'strategy', 'law']),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  fileUrl: z.string().max(500).optional().nullable(),
  fileSize: z.coerce.number().optional().nullable(),
  thumbnail: z.string().max(500).optional().nullable(),
  isPublished: z.boolean().default(false),
  translations: translationsSchema({
    title: z.string().min(1).max(500),
    excerpt: z.string().optional().nullable(),
    content: z.string().optional().nullable()
  })
})

// News Articles
export const newsArticleSchema = z.object({
  slug: slugSchema,
  author: z.string().max(255).optional().nullable(),
  thumbnail: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  isPublished: z.boolean().default(false),
  tagIds: z.array(z.number()).optional().default([]),
  translations: translationsSchema({
    title: z.string().min(1).max(500),
    excerpt: z.string().optional().nullable(),
    content: z.string().optional().nullable()
  })
})

// Events
export const eventSchema = z
  .object({
    slug: slugSchema,
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
    endDate: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date'),
    isVirtual: z.boolean().default(false),
    registrationUrl: z.string().max(500).optional().nullable(),
    thumbnail: z.string().max(500).optional().nullable(),
    isPublished: z.boolean().default(false),
    translations: translationsSchema({
      title: z.string().min(1).max(500),
      description: z.string().optional().nullable(),
      location: z.string().max(500).optional().nullable()
    })
  })
  .superRefine((data, ctx) => {
    if (data.endDate && data.startDate) {
      if (Date.parse(data.endDate) <= Date.parse(data.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date must be after start date',
          path: ['endDate']
        })
      }
    }
  })

// Vacancies
export const vacancySchema = z.object({
  slug: slugSchema,
  departmentId: z.number().optional().nullable(),
  location: z.string().max(255),
  type: z.enum(['full-time', 'part-time', 'contract']),
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  isActive: z.boolean().default(true),
  translations: translationsSchema({
    title: z.string().min(1).max(500),
    description: z.string().optional().nullable()
  }),
  requirements: z
    .array(
      z.object({
        displayOrder: z.number().default(0),
        translations: translationsSchema({
          description: z.string().min(1).max(500)
        })
      })
    )
    .optional()
    .default([])
})

// Tenders
export const tenderSchema = z.object({
  slug: slugSchema,
  referenceNumber: z.string().min(1).max(100),
  category: z.string().max(100),
  submissionDeadline: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  openingDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date')
    .optional()
    .nullable(),
  documentUrl: z.string().max(500).optional().nullable(),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  status: z.enum(['open', 'closed', 'awarded', 'cancelled']).default('open'),
  translations: translationsSchema({
    title: z.string().min(1).max(500),
    description: z.string().optional().nullable()
  })
})

// Departments
export const departmentSchema = z.object({
  slug: slugSchema,
  headId: z.number().optional().nullable(),
  displayOrder: z.number().default(0),
  translations: translationsSchema({
    name: z.string().min(1).max(255),
    description: z.string().optional().nullable()
  }),
  functions: z
    .array(
      z.object({
        displayOrder: z.number().default(0),
        translations: translationsSchema({
          description: z.string().min(1).max(500)
        })
      })
    )
    .optional()
    .default([])
})

// Team Members
export const teamMemberSchema = z.object({
  departmentId: z.number().optional().nullable(),
  photo: z.string().max(500).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  displayOrder: z.number().default(0),
  translations: translationsSchema({
    name: z.string().min(1).max(255),
    position: z.string().min(1).max(255),
    bio: z.string().optional().nullable()
  })
})

// Past Auditors General
export const pastAGSchema = z.object({
  tenureStart: z.string().max(10),
  tenureEnd: z.string().max(10),
  photo: z.string().max(500).optional().nullable(),
  displayOrder: z.number().default(0),
  translations: translationsSchema({
    name: z.string().min(1).max(255),
    description: z.string().optional().nullable(),
    legacy: z.string().optional().nullable()
  }),
  achievements: z
    .array(
      z.object({
        displayOrder: z.number().default(0),
        translations: translationsSchema({
          description: z.string().min(1).max(500)
        })
      })
    )
    .optional()
    .default([])
})

// Management Team
export const managementTeamSchema = z
  .object({
    slug: slugSchema,
    role: z.enum([
      'auditor-general',
      'deputy-auditor-general',
      'regional-auditor',
      'district-auditor',
      'sector-head',
      'branch-head'
    ]),
    officeId: z.number().optional().nullable(),
    departmentId: z.number().optional().nullable(),
    icon: z.string().max(100).optional().nullable(),
    photo: z.string().max(500).optional().nullable(),
    email: z.string().email().max(255).optional().nullable().or(z.literal('')),
    phone: z.string().max(50).optional().nullable(),
    displayOrder: z.number().default(0),
    isActive: z.boolean().default(true),
    translations: translationsSchema({
      name: z.string().min(1).max(255),
      title: z.string().max(255).optional().nullable(),
      bio: z.string().optional().nullable()
    }),
    responsibilities: z
      .array(
        z.object({
          displayOrder: z.number().default(0),
          translations: translationsSchema({
            description: z.string().min(1).max(500)
          })
        })
      )
      .optional()
      .default([])
  })
  .refine(
    (data) => {
      const rolesRequiringOffice = ['regional-auditor', 'district-auditor', 'sector-head', 'branch-head']
      if (rolesRequiringOffice.includes(data.role)) {
        return data.officeId !== null && data.officeId !== undefined
      }
      return true
    },
    {
      message: 'This role must be assigned to an office',
      path: ['officeId']
    }
  )
  .refine(
    (data) => {
      if (data.role === 'deputy-auditor-general') {
        return data.departmentId !== null && data.departmentId !== undefined
      }
      return true
    },
    {
      message: 'Deputy Auditors-General must be assigned to a department',
      path: ['departmentId']
    }
  )

// Offices
export const officeSchema = z.object({
  slug: slugSchema,
  typeId: z.number().min(1),
  region: z.string().min(1).max(100),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  displayOrder: z.number().default(0),
  translations: translationsSchema({
    name: z.string().min(1).max(255),
    address: z.string().optional().nullable()
  })
})

// Gallery Images
export const galleryImageSchema = z.object({
  url: z.string().max(500),
  category: z.string().max(100).optional().nullable(),
  translations: translationsSchema({
    alt: z.string().max(255).optional().nullable(),
    caption: z.string().max(500).optional().nullable()
  })
})

// Videos
export const videoSchema = z.object({
  url: z.string().max(500),
  thumbnail: z.string().max(500).optional().nullable(),
  duration: z.string().max(20).optional().nullable(),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  isPublished: z.boolean().default(false),
  translations: translationsSchema({
    title: z.string().min(1).max(500),
    description: z.string().optional().nullable()
  })
})

// Tags
export const tagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema
})

// Users (for admin management)
export const userSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).optional(),
  name: z.string().min(1).max(255),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  isActive: z.boolean().default(true)
})

export const userUpdateSchema = userSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: z.string().min(8).optional()
  })

// Contact Submissions
export const contactSubmissionUpdateSchema = z.object({
  status: z.enum(['pending', 'read', 'responded', 'archived'])
})

// Type exports for use in endpoints
export type AuditReportInput = z.infer<typeof auditReportSchema>
export type PublicationInput = z.infer<typeof publicationSchema>
export type NewsArticleInput = z.infer<typeof newsArticleSchema>
export type EventInput = z.infer<typeof eventSchema>
export type VacancyInput = z.infer<typeof vacancySchema>
export type TenderInput = z.infer<typeof tenderSchema>
export type DepartmentInput = z.infer<typeof departmentSchema>
export type TeamMemberInput = z.infer<typeof teamMemberSchema>
export type PastAGInput = z.infer<typeof pastAGSchema>
export type ManagementTeamInput = z.infer<typeof managementTeamSchema>
export type OfficeInput = z.infer<typeof officeSchema>
export type GalleryImageInput = z.infer<typeof galleryImageSchema>
export type VideoInput = z.infer<typeof videoSchema>
export type TagInput = z.infer<typeof tagSchema>
export type UserInput = z.infer<typeof userSchema>
