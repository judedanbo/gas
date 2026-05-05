# Admin Dashboard UI Implementation Plan

## Overview

Build a complete admin dashboard UI for the Ghana Audit Service website to manage all 13 content types via the already-implemented admin API routes. The dashboard will support JWT authentication, role-based access, multilingual content (English/Akan), and file uploads.

---

## File Structure

```
layouts/
  admin.vue                           # Admin dashboard layout

middleware/
  admin-auth.ts                       # Client-side route protection

pages/admin/
  index.vue                           # Dashboard home
  login.vue                           # Login page
  reports/
    index.vue                         # List reports
    create.vue                        # Create report
    [id]/edit.vue                     # Edit report
  publications/
    index.vue, create.vue, [id]/edit.vue
  news/
    index.vue, create.vue, [id]/edit.vue
  events/
    index.vue, create.vue, [id]/edit.vue
  vacancies/
    index.vue, create.vue, [id]/edit.vue
  tenders/
    index.vue, create.vue, [id]/edit.vue
  departments/
    index.vue, create.vue, [id]/edit.vue
  team-members/
    index.vue, create.vue, [id]/edit.vue
  regional-offices/
    index.vue, create.vue, [id]/edit.vue
  gallery/
    index.vue, create.vue
  videos/
    index.vue, create.vue, [id]/edit.vue
  tags/
    index.vue                         # Inline create/list
  users/
    index.vue, create.vue, [id]/edit.vue  # Admin only
  audit-logs/
    index.vue                         # Read-only
  newsletter/
    index.vue                         # Read-only
  contact-submissions/
    index.vue                         # Read-only

components/admin/
  layout/
    AdminSidebar.vue                  # Collapsible navigation
    AdminHeader.vue                   # Top bar with user menu
  ui/
    AdminDataTable.vue                # Table with pagination
    AdminPagination.vue               # Pagination controls
    AdminSearchFilter.vue             # Search + filters
    AdminConfirmDialog.vue            # Delete confirmation
    AdminEmptyState.vue               # No data placeholder
    AdminStatsCard.vue                # Dashboard stats
  form/
    AdminFormGroup.vue                # Label + input + error
    AdminInput.vue                    # Text input
    AdminTextarea.vue                 # Multi-line text
    AdminSelect.vue                   # Dropdown
    AdminSwitch.vue                   # Boolean toggle
    AdminDatePicker.vue               # Date selection
    AdminFileUpload.vue               # File upload with preview
    AdminRichEditor.vue               # Rich text (content fields)
    AdminTranslationTabs.vue          # English/Akan tabs
  content/
    ReportForm.vue                    # Report-specific fields
    PublicationForm.vue
    NewsForm.vue
    EventForm.vue
    VacancyForm.vue
    TenderForm.vue
    DepartmentForm.vue
    TeamMemberForm.vue
    RegionalOfficeForm.vue
    GalleryForm.vue
    VideoForm.vue
    UserForm.vue

composables/
  useAdminAuth.ts                     # Auth state & methods
  useAdminApi.ts                      # API wrapper with JWT
  useAdminCrud.ts                     # Generic CRUD operations

types/
  admin.ts                            # Admin-specific types
```

---

## Implementation Phases

### Phase 1: Foundation

**Files to create:**
- `composables/useAdminAuth.ts` - Token storage, login/logout, permission checks
- `composables/useAdminApi.ts` - $fetch wrapper with Authorization header
- `middleware/admin-auth.ts` - Route guard for `/admin/*` (except login)
- `pages/admin/login.vue` - Login form with email/password
- `layouts/admin.vue` - Sidebar + header + content area
- `components/admin/layout/AdminSidebar.vue` - Navigation groups
- `components/admin/layout/AdminHeader.vue` - User menu, breadcrumb
- `types/admin.ts` - AdminUser, LoginResponse, Permission types

**Key patterns:**
```typescript
// useAdminAuth.ts
export function useAdminAuth() {
  const user = useState<AdminUser | null>('admin-user', () => null)
  const token = useState<string | null>('admin-token', () => null)

  async function login(email: string, password: string): Promise<boolean>
  async function logout(): Promise<void>
  function isAuthenticated(): boolean
  function hasPermission(p: Permission): boolean
}

// middleware/admin-auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAdminAuth()
  if (!isAuthenticated() && to.path !== '/admin/login') {
    return navigateTo('/admin/login')
  }
})
```

### Phase 2: Core UI Components

**Files to create:**
- `components/admin/ui/AdminDataTable.vue` - Columns, rows, sorting, actions
- `components/admin/ui/AdminPagination.vue` - Page controls
- `components/admin/ui/AdminSearchFilter.vue` - Search input + filter dropdowns
- `components/admin/ui/AdminConfirmDialog.vue` - Wraps BaseModal for delete
- `components/admin/ui/AdminEmptyState.vue` - No results illustration
- `components/admin/ui/AdminStatsCard.vue` - Metric display

**AdminDataTable props:**
```typescript
interface Props {
  columns: { key: string; label: string; sortable?: boolean }[]
  data: any[]
  loading: boolean
  meta: { total: number; page: number; perPage: number; lastPage: number }
}
// Emits: sort, page-change, row-click
```

### Phase 3: Form Components

**Files to create:**
- `components/admin/form/AdminFormGroup.vue` - Label, slot, error message
- `components/admin/form/AdminInput.vue` - Text with validation state
- `components/admin/form/AdminTextarea.vue` - Multi-line
- `components/admin/form/AdminSelect.vue` - Options dropdown
- `components/admin/form/AdminSwitch.vue` - Toggle for isPublished
- `components/admin/form/AdminDatePicker.vue` - Native date input
- `components/admin/form/AdminFileUpload.vue` - Upload + preview
- `components/admin/form/AdminTranslationTabs.vue` - EN/AK tabs
- `composables/useAdminCrud.ts` - Generic fetchAll, fetchOne, create, update, remove

**Translation tabs pattern:**
```vue
<AdminTranslationTabs v-model="form.translations" :fields="[
  { key: 'title', label: 'Title', type: 'input', required: true },
  { key: 'summary', label: 'Summary', type: 'textarea' }
]" />
```

### Phase 4: Dashboard Home

**Files to create:**
- `pages/admin/index.vue` - Stats grid + recent activity

**Features:**
- Content counts by type (reports, publications, news, etc.)
- Recent audit log entries
- Quick action buttons (create report, create news, etc.)

### Phase 5: Content CRUD Pages

**Create pages for each content type following this pattern:**

```
pages/admin/{resource}/
  index.vue      # List with search, filters, pagination
  create.vue     # Form with translations
  [id]/edit.vue  # Pre-filled form
```

**Implementation order (by complexity):**
1. **Reports** - File upload + translations (reference implementation)
2. **Publications** - Similar to reports
3. **News** - Includes tag selection
4. **Events** - Date fields + virtual toggle
5. **Vacancies** - Nested requirements array
6. **Tenders** - Status dropdown
7. **Departments** - Nested functions array
8. **Team Members** - Photo upload
9. **Regional Offices** - Coordinates input
10. **Gallery** - Image upload
11. **Videos** - URL + thumbnail
12. **Tags** - Simple inline management
13. **Users** - Admin-only, role selection

**Content form components:**
- `components/admin/content/ReportForm.vue`
- `components/admin/content/PublicationForm.vue`
- ... (one per content type)

### Phase 6: Read-Only Pages

**Files to create:**
- `pages/admin/audit-logs/index.vue` - Activity log with filters
- `pages/admin/newsletter/index.vue` - Subscriber list + stats
- `pages/admin/contact-submissions/index.vue` - Form submissions

---

## Sidebar Navigation Structure

```
Content
├── A-G Reports        /admin/reports
├── Publications       /admin/publications
├── News              /admin/news
└── Events            /admin/events

Careers
├── Vacancies         /admin/vacancies
└── Tenders           /admin/tenders

Organization
├── Departments       /admin/departments
├── Team Members      /admin/team-members
└── Regional Offices  /admin/regional-offices

Media
├── Gallery           /admin/gallery
└── Videos            /admin/videos

Settings
├── Tags              /admin/tags
└── Users             /admin/users  [admin only]

Activity
├── Audit Logs        /admin/audit-logs
├── Newsletter        /admin/newsletter
└── Contact Forms     /admin/contact-submissions
```

---

## Key Technical Decisions

1. **Auth Storage**: localStorage for JWT token, useState for reactive state
2. **API Pattern**: All calls via `useAdminApi()` with auto-redirect on 401
3. **Form State**: `reactive()` for form data, reset on submit success
4. **File Uploads**: Upload first to `/api/admin/upload`, store URL in form
5. **Translations**: Single `AdminTranslationTabs` component for all content
6. **Styling**: Reuse existing `form-input`, `btn-*`, `card` Tailwind classes
7. **Role Visibility**: Hide admin-only UI (Users) based on `hasPermission()`

---

## Reference Files

| Purpose | File |
|---------|------|
| Composable pattern | `composables/useReports.ts` |
| Modal pattern | `components/ui/BaseModal.vue` |
| Layout pattern | `layouts/default.vue` |
| Form classes | `assets/css/tailwind.css` |
| API response format | `server/api/admin/reports/index.ts` |
| Server auth middleware | `server/middleware/adminAuth.ts` |

---

## API Endpoints Summary

| Resource | Endpoints |
|----------|-----------|
| Auth | POST /login, POST /logout, GET /me |
| reports | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| publications | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| news | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| events | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| vacancies | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| tenders | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| departments | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| team-members | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| regional-offices | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| gallery | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| videos | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| tags | GET, POST |
| users | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| audit-logs | GET |
| newsletter | GET |
| contact-submissions | GET, GET/:id, PUT/:id |
| upload | POST?type=report\|publication\|image\|thumbnail |

---

## Estimated Files Count

| Category | Count |
|----------|-------|
| Layouts | 1 |
| Middleware | 1 |
| Pages | ~45 |
| Components | ~25 |
| Composables | 3 |
| Types | 1 |
| **Total** | **~76 files** |
