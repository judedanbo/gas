import { z } from 'zod'
import {
  APP_AUDIENCE_MAX_POINTS,
  APP_SECTION_LIMITS,
  APP_TEXT_LIMITS,
  appSlugProblem,
  isAppIcon,
  isEmptyAppTranslation
} from '../../utils/serviceApps'
import { POPUP_IMAGE_SIZE_LABEL } from '~/utils/popupImage'

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
export function createValidationError(errors: Record<string, string>) {
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
  category: z.enum([
    'financial',
    'compliance',
    'it',
    'performance',
    'technical',
    'follow-up',
    'special'
  ]),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  fileUrl: z.string().max(500).or(z.literal('')),
  fileSize: z.coerce.number().optional().nullable(),
  thumbnail: z.string().max(500).optional().nullable().or(z.literal('')),
  isPublished: z.boolean().default(false),
  // Optimization snapshot from the create flow's upload modal. Only used on
  // create — the update endpoint ignores these so stale form data can never
  // clobber server-written optimization state.
  optimizedAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date')
    .optional()
    .nullable(),
  optimizationMeta: z
    .object({
      preset: z.enum(['screen', 'ebook', 'printer']),
      originalSize: z.number(),
      optimizedSize: z.number(),
      savedBytes: z.number(),
      pageCount: z.number(),
      nativePages: z.number(),
      scannedPages: z.number(),
      ocrFailedPages: z.number(),
      skippedCompression: z.boolean()
    })
    .optional()
    .nullable(),
  // Background upload job that produced fileUrl (see reports/upload.post.ts).
  // Lets the server link the saved report to the job and pull the job's
  // thumbnail/size/optimization outputs, whichever side finishes first.
  uploadJobId: z.string().uuid().optional().nullable(),
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
    excerpt: z.string().min(1),
    content: z.string().min(1)
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
      const rolesRequiringOffice = [
        'regional-auditor',
        'district-auditor',
        'sector-head',
        'branch-head'
      ]
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

// Board Members (English only — flat name/title/bio, no translations)
export const boardMemberSchema = z.object({
  slug: slugSchema,
  role: z.enum(['chairperson', 'member']),
  name: z.string().min(1).max(255),
  title: z.string().max(255).optional().nullable(),
  bio: z.string().optional().nullable(),
  photo: z.string().max(500).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  displayOrder: z.number().default(0),
  isActive: z.boolean().default(true)
})

// Site Statistics (edit-only — statKey/section are fixed and not editable)
export const siteStatUpdateSchema = z.object({
  label: z.string().min(1).max(255),
  suffix: z.string().max(16).optional().nullable(),
  icon: z.string().max(255).optional().nullable(),
  source: z.enum(['manual', 'hr_api']).default('manual'),
  hrMetricKey: z.string().max(100).optional().nullable(),
  manualValue: z.coerce.number().int().min(0),
  overrideEnabled: z.boolean().default(false),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true)
})

// Site pop-ups
export const POPUP_DEFAULT_DISPLAY_SECONDS = 30
export const POPUP_MAX_DISPLAY_SECONDS = 300

/** Root-relative path ("/about", not "//host") or an absolute http(s) URL. */
function isSafeUrl(value: string, { allowHttp }: { allowHttp: boolean }): boolean {
  if (value.startsWith('/')) return !value.startsWith('//') && !value.includes('\\')
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || (allowHttp && protocol === 'http:')
  } catch {
    return false
  }
}

const popupDateSchema = z.preprocess(
  (val) => (val === '' ? null : val),
  z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date')
    .optional()
    .nullable()
)

export const popupSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    // Uploaded images are root-relative (/uploads/popups/…); the CSP only
    // allows https for remote ones. Which images a pop-up may use is
    // popupImageError()'s call: it needs the pop-up's current image.
    imageUrl: z
      .string()
      .trim()
      .min(1, 'An image is required')
      .max(500)
      .refine(
        (val) => isSafeUrl(val, { allowHttp: false }),
        'Must be an uploaded image or an https URL'
      ),
    altText: z.string().trim().max(500).optional().nullable(),
    linkUrl: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
      z
        .string()
        .trim()
        .max(500)
        .refine(
          (val) => isSafeUrl(val, { allowHttp: true }),
          'Must be a path on this site (e.g. /reports) or a full http(s) URL'
        )
        .optional()
        .nullable()
    ),
    openInNewTab: z.boolean().default(false),
    startsAt: popupDateSchema,
    endsAt: popupDateSchema,
    displaySeconds: z.coerce
      .number()
      .int('Must be a whole number of seconds')
      .min(1, 'Must be at least 1 second')
      .max(POPUP_MAX_DISPLAY_SECONDS, `Must be at most ${POPUP_MAX_DISPLAY_SECONDS} seconds`)
      .default(POPUP_DEFAULT_DISPLAY_SECONDS),
    isDismissible: z.boolean().default(false),
    isActive: z.boolean().default(true)
  })
  .refine(
    (val) => !val.startsAt || !val.endsAt || Date.parse(val.endsAt) > Date.parse(val.startsAt),
    { path: ['endsAt'], message: 'End must be after the start' }
  )

// Audit Service apps and websites (/admin/apps). Shape and limits live in
// utils/serviceApps.ts, shared with the admin form.

/** Optional text: null/undefined become '' so stored rows are uniform. */
const appText = (max: number) =>
  z.preprocess((val) => (val == null ? '' : val), z.string().trim().max(max))

const appRequiredText = (max: number, message: string) =>
  z.preprocess((val) => (val == null ? '' : val), z.string().trim().min(1, message).max(max))

const appIconSchema = z.string().refine(isAppIcon, 'Pick an icon from the list')

const appOptionalIconSchema = z.preprocess(
  (val) => (val == null ? '' : val),
  z.string().refine((val) => val === '' || isAppIcon(val), 'Pick an icon from the list')
)

function appSectionSchema<T extends z.ZodTypeAny>(item: T, max: number) {
  return z.preprocess(
    (val) => (val == null ? {} : val),
    z.object({
      title: appText(APP_TEXT_LIMITS.sectionTitle),
      intro: appText(APP_TEXT_LIMITS.sectionIntro),
      items: z.preprocess(
        (val) => (val == null ? [] : val),
        z.array(item).max(max, `Add at most ${max} items`)
      )
    })
  )
}

const appItemTitle = appRequiredText(APP_TEXT_LIMITS.itemTitle, 'Enter a title')

const appContentSchema = z.preprocess(
  (val) => (val == null ? {} : val),
  z.object({
    features: appSectionSchema(
      z.object({
        icon: appIconSchema,
        title: appItemTitle,
        description: appText(APP_TEXT_LIMITS.itemText)
      }),
      APP_SECTION_LIMITS.features
    ),
    steps: appSectionSchema(
      z.object({
        icon: appOptionalIconSchema,
        title: appItemTitle,
        description: appText(APP_TEXT_LIMITS.itemText)
      }),
      APP_SECTION_LIMITS.steps
    ),
    audiences: appSectionSchema(
      z.object({
        icon: appIconSchema,
        title: appItemTitle,
        points: z
          .array(z.string().trim().min(1, 'Remove empty points').max(APP_TEXT_LIMITS.point))
          .max(APP_AUDIENCE_MAX_POINTS, `Add at most ${APP_AUDIENCE_MAX_POINTS} points`)
      }),
      APP_SECTION_LIMITS.audiences
    ),
    highlights: appSectionSchema(
      z.object({ icon: appIconSchema, title: appItemTitle }),
      APP_SECTION_LIMITS.highlights
    ),
    faqs: appSectionSchema(
      z.object({
        question: appRequiredText(APP_TEXT_LIMITS.question, 'Enter the question'),
        answer: appRequiredText(APP_TEXT_LIMITS.answer, 'Enter the answer')
      }),
      APP_SECTION_LIMITS.faqs
    )
  })
)

function appTranslationSchema(isDefaultLanguage: boolean) {
  return z.object({
    name: isDefaultLanguage
      ? appRequiredText(APP_TEXT_LIMITS.name, 'Enter the name of the app')
      : appText(APP_TEXT_LIMITS.name),
    tagline: appText(APP_TEXT_LIMITS.tagline),
    summary: isDefaultLanguage
      ? appRequiredText(APP_TEXT_LIMITS.summary, 'Enter a short summary')
      : appText(APP_TEXT_LIMITS.summary),
    headline: appText(APP_TEXT_LIMITS.headline),
    body: appText(APP_TEXT_LIMITS.body),
    launchLabel: appText(APP_TEXT_LIMITS.launchLabel),
    imageAlt: appText(APP_TEXT_LIMITS.imageAlt),
    ctaTitle: appText(APP_TEXT_LIMITS.ctaTitle),
    ctaText: appText(APP_TEXT_LIMITS.ctaText),
    content: appContentSchema
  })
}

/** An absolute http(s) URL — where an app lives. */
function isWebAddress(value: string): boolean {
  return !value.startsWith('/') && isSafeUrl(value, { allowHttp: true })
}

const optionalUrl = (refine: (val: string) => boolean, message: string) =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().trim().max(500).refine(refine, message).optional().nullable()
  )

export const serviceAppSchema = z.object({
  slug: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.string().superRefine((val, ctx) => {
      const problem = appSlugProblem(val)
      if (problem) ctx.addIssue({ code: 'custom', message: problem })
    })
  ),
  url: z
    .string()
    .trim()
    .min(1, "Enter the app's web address")
    .max(500)
    .refine(isWebAddress, 'Enter a full web address, e.g. https://tracker.audit.gov.gh'),
  // Uploaded images are root-relative (/uploads/images/…); the CSP only
  // allows https for remote ones. No logo shows the GAS logo.
  logoUrl: optionalUrl(
    (val) => isSafeUrl(val, { allowHttp: false }),
    'Must be an uploaded image or an https URL'
  ),
  imageUrl: optionalUrl(
    (val) => isSafeUrl(val, { allowHttp: false }),
    'Must be an uploaded image or an https URL'
  ),
  privacyUrl: optionalUrl(
    (val) => isSafeUrl(val, { allowHttp: true }),
    'Must be a path on this site (e.g. /citizenseye/privacy) or a full http(s) URL'
  ),
  sortOrder: z.coerce.number().int('Enter a whole number').min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  translations: z.object({
    en: appTranslationSchema(true),
    ak: appTranslationSchema(false)
      .optional()
      .nullable()
      .transform((ak) => (ak && !isEmptyAppTranslation(ak) ? ak : undefined))
  })
})

/**
 * Where `popup` uploads land: /uploads/popups/<generated name> (see
 * uploadConfigs.popup and serveUpload's name pattern).
 */
const POPUP_UPLOAD_URL = /^\/uploads\/popups\/[A-Za-z0-9-]+\.(?:jpe?g|png|webp|gif)$/i

/**
 * Pop-up images are always exactly 1600 × 800. Only the `popup` upload type
 * checks the pixels, so a pop-up may only be saved with an image uploaded
 * through it. One saved before the rule existed keeps the image it has
 * (`currentImageUrl`) until that image is replaced, so an old pop-up can still
 * be edited or switched off. Returns the field error, or null when allowed.
 */
export function popupImageError(imageUrl: string, currentImageUrl?: string): string | null {
  if (imageUrl === currentImageUrl || POPUP_UPLOAD_URL.test(imageUrl)) return null
  return `Upload an image of exactly ${POPUP_IMAGE_SIZE_LABEL} pixels`
}

// Auditor-General message (singleton, edit-only)
export const auditorGeneralMessageSchema = z.object({
  photo: z.string().max(500).optional().nullable().or(z.literal('')),
  isActive: z.boolean().default(true),
  translations: translationsSchema({
    name: z.string().min(1).max(255),
    title: z.string().min(1).max(255),
    excerpt: z.string().min(1).max(1000),
    fullMessage: z.string().min(1)
  }).refine((t) => !t.ak || (t.ak.name && t.ak.title && t.ak.excerpt && t.ak.fullMessage), {
    message: 'All Akan fields are required when providing an Akan translation',
    path: ['ak']
  })
})

// Offices
export const officeSchema = z.object({
  slug: slugSchema,
  typeId: z.number().min(1),
  parentId: z.number().optional().nullable(),
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
  albumId: z.number().int().positive().optional().nullable(),
  translations: translationsSchema({
    alt: z.string().max(255).optional().nullable(),
    caption: z.string().max(500).optional().nullable()
  })
})

// Home page carousel (whole configuration, replaced on every save)
const carouselItemSchema = z
  .object({
    type: z.enum(['news', 'event', 'report', 'gallery']),
    refId: z.coerce.number().int().positive(),
    mode: z.enum(['pinned', 'hidden']),
    pinnedUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')
      .nullable()
      .default(null),
    imageCount: z.coerce.number().int().min(1).max(10).nullable().default(null),
    imageIds: z.array(z.coerce.number().int().positive()).max(10).default([])
  })
  .refine((item) => item.type !== 'gallery' || (item.mode === 'pinned' && item.imageCount), {
    message: 'Gallery albums need a number of photos to show',
    path: ['imageCount']
  })
  .refine((item) => item.imageIds.length <= (item.imageCount ?? 0) || item.type !== 'gallery', {
    message: 'More photos selected than the number to show',
    path: ['imageIds']
  })

export const carouselConfigSchema = z.object({
  settings: z.object({
    newsCount: z.coerce.number().int().min(0).max(10),
    eventsCount: z.coerce.number().int().min(0).max(10),
    reportsCount: z.coerce.number().int().min(0).max(10)
  }),
  items: z
    .array(carouselItemSchema)
    .max(100)
    .refine(
      (items) => new Set(items.map((i) => `${i.type}:${i.refId}`)).size === items.length,
      'Each item can only be listed once'
    )
})

// Gallery Albums
// Site languages (/admin/languages). `code` is checked against the language
// catalogue in the handler.
const languageNameSchema = z.string().trim().min(1, 'Required').max(100, 'Too long')

export const languageCreateSchema = z.object({
  code: z.string().regex(/^[a-z]{2,3}$/, 'Invalid language code'),
  name: languageNameSchema.optional(),
  nativeName: languageNameSchema.optional()
})

export const languageUpdateSchema = z
  .object({
    name: languageNameSchema.optional(),
    nativeName: languageNameSchema.optional(),
    isEnabled: z.boolean().optional()
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update'
  })

// Interface translations: message key → text, or null to remove the entry.
// Keys and message syntax are checked against en.json in the handler.
export const TRANSLATION_MAX_LENGTH = 2000

export const translationsUpdateSchema = z.object({
  translations: z
    .record(
      z.string().min(1).max(191),
      z.string().max(TRANSLATION_MAX_LENGTH, 'Too long').nullable()
    )
    .refine((value) => Object.keys(value).length <= 2000, { message: 'Too many entries' })
})

export const galleryAlbumSchema = z.object({
  slug: slugSchema,
  coverImageId: z.number().int().positive().optional().nullable(),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  isPublished: z.boolean().default(false),
  translations: translationsSchema({
    title: z.string().min(1).max(500),
    description: z.string().optional().nullable()
  })
})

// Bulk gallery image upload (post-upload DB persistence)
export const galleryBulkImageSchema = z.object({
  albumId: z.number().int().positive().nullable(),
  images: z
    .array(
      z.object({
        url: z.string().min(1).max(500),
        translations: translationsSchema({
          alt: z.string().max(255).optional().nullable(),
          caption: z.string().max(500).optional().nullable()
        })
      })
    )
    .min(1)
    .max(50)
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
const moduleKeysEnum = z.enum([
  'reports',
  'content',
  'careers',
  'organization',
  'media',
  'analytics',
  'communications'
])

// Admin accounts may only be created for official Ghana Audit Service
// addresses. Enforced at the field level so it survives `.partial()`/`.omit()`
// in the update schema below.
export const ORG_EMAIL_DOMAIN = 'audit.gov.gh'
const orgEmailSchema = z
  .string()
  .email()
  .max(255)
  .refine((email) => email.toLowerCase().endsWith(`@${ORG_EMAIL_DOMAIN}`), {
    message: `Email must be an @${ORG_EMAIL_DOMAIN} address`
  })

export const userSchema = z.object({
  email: orgEmailSchema,
  password: z.string().min(8).optional(),
  name: z.string().min(1).max(255),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  modules: z.array(moduleKeysEnum).optional(),
  isActive: z.boolean().default(true)
})

export const userUpdateSchema = userSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: z.string().min(8).optional()
  })

// Accepting an invitation: a valid token, plus an optional new password the
// user may choose instead of keeping their emailed initial password.
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional()
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
export type BoardMemberInput = z.infer<typeof boardMemberSchema>
export type SiteStatUpdateInput = z.infer<typeof siteStatUpdateSchema>
export type PopupInput = z.infer<typeof popupSchema>
export type ServiceAppInput = z.infer<typeof serviceAppSchema>
export type AuditorGeneralMessageInput = z.infer<typeof auditorGeneralMessageSchema>
export type OfficeInput = z.infer<typeof officeSchema>
export type GalleryImageInput = z.infer<typeof galleryImageSchema>
export type GalleryAlbumInput = z.infer<typeof galleryAlbumSchema>
export type GalleryBulkImageInput = z.infer<typeof galleryBulkImageSchema>
export type VideoInput = z.infer<typeof videoSchema>
export type TagInput = z.infer<typeof tagSchema>
export type UserInput = z.infer<typeof userSchema>
