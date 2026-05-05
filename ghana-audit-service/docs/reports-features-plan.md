# Reports Section Feature Enhancement Plan

## Overview

This document outlines the plan for adding new features to the Reports section of the Ghana Audit Service admin dashboard.

## Current State

- Reports have a simple `isPublished` boolean flag
- Thumbnails exist in database but not displayed in list view
- No bulk operations available
- Single-user publishing (no approval workflow)

---

## Feature 1: Approval Hierarchy for Publishing

### Objective

Implement a multi-stage approval workflow where reports must be reviewed and approved before publication.

### Proposed Workflow States

```
DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED
                ↓
            REJECTED (returns to DRAFT)
```

### Database Changes

**New columns in `audit_reports` table:**

```sql
ALTER TABLE audit_reports ADD COLUMN status ENUM('draft', 'pending_review', 'approved', 'rejected', 'published') DEFAULT 'draft';
ALTER TABLE audit_reports ADD COLUMN submitted_at DATETIME NULL;
ALTER TABLE audit_reports ADD COLUMN submitted_by INT NULL;
ALTER TABLE audit_reports ADD COLUMN reviewed_at DATETIME NULL;
ALTER TABLE audit_reports ADD COLUMN reviewed_by INT NULL;
ALTER TABLE audit_reports ADD COLUMN approved_at DATETIME NULL;
ALTER TABLE audit_reports ADD COLUMN approved_by INT NULL;
ALTER TABLE audit_reports ADD COLUMN rejection_reason TEXT NULL;
```

**New table for approval history:**

```sql
CREATE TABLE audit_report_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  action ENUM('submit', 'approve', 'reject', 'publish', 'unpublish') NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  user_id INT NOT NULL,
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES audit_reports(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Role-Based Permissions

| Role     | Can Create | Can Edit Own | Can Submit | Can Review | Can Approve | Can Publish |
| -------- | ---------- | ------------ | ---------- | ---------- | ----------- | ----------- |
| Editor   | Yes        | Yes          | Yes        | No         | No          | No          |
| Reviewer | Yes        | Yes          | Yes        | Yes        | No          | No          |
| Approver | Yes        | Yes          | Yes        | Yes        | Yes         | No          |
| Admin    | Yes        | Yes          | Yes        | Yes        | Yes         | Yes         |

### UI Changes

**List Page (`pages/admin/reports/index.vue`):**

- Replace simple Published/Draft badge with status workflow badge
- Add status filter dropdown (Draft, Pending Review, Approved, Rejected, Published)
- Show "Submit for Review" button for draft reports
- Show "Approve/Reject" buttons for reviewers on pending reports

**Edit Page (`pages/admin/reports/[id]/edit.vue`):**

- Add status timeline/history component
- Show current status with action buttons based on user role
- Add rejection reason display for rejected reports
- Add comment field for approval/rejection actions

**New Components:**

- `AdminStatusBadge.vue` - Color-coded status badges
- `AdminApprovalTimeline.vue` - Visual workflow history
- `AdminApprovalDialog.vue` - Modal for approve/reject with comments

### API Endpoints

```
POST /api/admin/reports/[id]/submit      - Submit for review
POST /api/admin/reports/[id]/approve     - Approve report
POST /api/admin/reports/[id]/reject      - Reject with reason
POST /api/admin/reports/[id]/publish     - Publish approved report
POST /api/admin/reports/[id]/unpublish   - Unpublish report
GET  /api/admin/reports/[id]/history     - Get approval history
```

### Implementation Tasks

1. [ ] Add new database columns and migration
2. [ ] Create approval history table
3. [ ] Update Zod validation schema
4. [ ] Add new API endpoints for workflow actions
5. [ ] Update user roles/permissions system
6. [ ] Create status badge component
7. [ ] Create approval timeline component
8. [ ] Create approval dialog component
9. [ ] Update list page with new filters and actions
10. [ ] Update edit page with workflow controls
11. [ ] Add email notifications for status changes (optional)

---

## Feature 2: Show Thumbnails in List of Reports

### Objective

Display report thumbnail images in the reports list for better visual identification.

### UI Changes

**List Page Modifications:**

```vue
<!-- New thumbnail column -->
<template #cell-thumbnail="{ row }">
  <div class="w-16 h-20 rounded overflow-hidden bg-gray-100">
    <img
      v-if="row.thumbnail"
      :src="row.thumbnail"
      :alt="row.translations?.en?.title"
      class="w-full h-full object-cover"
    />
    <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    </div>
  </div>
</template>
```

**Column Configuration:**

```typescript
const columns = [
  {
    key: 'thumbnail',
    label: '',
    sortable: false,
    width: '80px'
  },
  { key: 'title', label: 'Title', sortable: true }
  // ... existing columns
]
```

### Design Considerations

- Thumbnail size: 64x80px (4:5 aspect ratio for document preview)
- Fallback: PDF icon placeholder when no thumbnail
- Lazy loading for performance with many reports
- Optional: Generate thumbnails automatically from PDF first page

### Implementation Tasks

1. [ ] Add thumbnail column to DataTable configuration
2. [ ] Create thumbnail cell template with fallback
3. [ ] Add lazy loading for images
4. [ ] Style thumbnail container with proper aspect ratio
5. [ ] Optional: Add automatic thumbnail generation from PDF

---

## Feature 3: Bulk Download of Reports

### Objective

Allow users to select multiple reports and download them as a ZIP archive.

### UI Changes

**List Page Enhancements:**

```vue
<!-- Checkbox column for selection -->
<template #cell-select="{ row }">
  <input
    type="checkbox"
    :checked="selectedReports.includes(row.id)"
    @change="toggleSelection(row.id)"
    class="rounded border-gray-300"
  />
</template>

<!-- Bulk actions bar -->
<div v-if="selectedReports.length > 0"
     class="sticky bottom-4 left-0 right-0 mx-4 p-4 bg-primary text-white rounded-lg shadow-lg flex items-center justify-between">
  <span>{{ selectedReports.length }} report(s) selected</span>
  <div class="flex gap-2">
    <button @click="clearSelection" class="btn btn-ghost">
      Clear Selection
    </button>
    <button @click="downloadSelected" class="btn btn-secondary" :disabled="downloading">
      <svg v-if="downloading" class="w-4 h-4 animate-spin mr-2">...</svg>
      Download Selected
    </button>
  </div>
</div>
```

**Script Logic:**

```typescript
const selectedReports = ref<number[]>([])
const downloading = ref(false)

function toggleSelection(id: number) {
  const index = selectedReports.value.indexOf(id)
  if (index === -1) {
    selectedReports.value.push(id)
  } else {
    selectedReports.value.splice(index, 1)
  }
}

function selectAll() {
  selectedReports.value = items.value.map((r) => r.id)
}

function clearSelection() {
  selectedReports.value = []
}

async function downloadSelected() {
  downloading.value = true
  try {
    const response = await $fetch('/api/admin/reports/bulk-download', {
      method: 'POST',
      body: { ids: selectedReports.value },
      responseType: 'blob'
    })

    // Trigger download
    const url = URL.createObjectURL(response)
    const a = document.createElement('a')
    a.href = url
    a.download = `reports-${new Date().toISOString().split('T')[0]}.zip`
    a.click()
    URL.revokeObjectURL(url)

    clearSelection()
  } finally {
    downloading.value = false
  }
}
```

### API Endpoint

**POST `/api/admin/reports/bulk-download`**

```typescript
import archiver from 'archiver'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  const { ids } = await readBody(event)

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, message: 'No reports selected' })
  }

  if (ids.length > 50) {
    throw createError({ statusCode: 400, message: 'Maximum 50 reports per download' })
  }

  // Fetch reports
  const reports = await db
    .select()
    .from(schema.auditReports)
    .where(inArray(schema.auditReports.id, ids))

  // Create ZIP archive
  const archive = archiver('zip', { zlib: { level: 5 } })

  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', 'attachment; filename="reports.zip"')

  for (const report of reports) {
    if (report.fileUrl) {
      const filePath = report.fileUrl.replace('/uploads/', 'public/uploads/')
      const fileName = `${report.slug}-${report.year}.pdf`
      archive.file(filePath, { name: fileName })
    }
  }

  archive.finalize()
  return sendStream(event, archive)
})
```

### Dependencies

```bash
npm install archiver @types/archiver
```

### Implementation Tasks

1. [ ] Install archiver package
2. [ ] Add checkbox column to DataTable
3. [ ] Implement selection state management
4. [ ] Create bulk actions bar component
5. [ ] Create bulk download API endpoint
6. [ ] Handle download progress/errors
7. [ ] Add "Select All" / "Select Page" options
8. [ ] Add download limit (e.g., max 50 reports)

---

## Additional Suggested Features

### Feature 4: Report Versioning

**Objective:** Track multiple versions of the same report.

**Database Changes:**

```sql
CREATE TABLE audit_report_versions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  version_number INT NOT NULL,
  file_url VARCHAR(500),
  file_size VARCHAR(50),
  changelog TEXT,
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES audit_reports(id)
);
```

**Benefits:**

- Keep history of report updates
- Allow rollback to previous versions
- Track what changed between versions

---

### Feature 5: Scheduled Publishing

**Objective:** Allow reports to be scheduled for future publication.

**Database Changes:**

```sql
ALTER TABLE audit_reports ADD COLUMN scheduled_publish_at DATETIME NULL;
```

**Implementation:**

- Add date/time picker for scheduled publication
- Background job to publish reports at scheduled time
- Show "Scheduled" status in list

---

### Feature 6: Report Categories Management

**Objective:** Allow admins to manage report categories dynamically.

**Benefits:**

- Add new categories without code changes
- Rename/reorder categories
- Set category icons/colors

---

### Feature 7: Report Viewing & Download Analytics

**Objective:** Track and analyze report views and downloads to understand user engagement and report popularity.

### Database Changes

**Analytics Events Table:**

```sql
CREATE TABLE audit_report_analytics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  event_type ENUM('view', 'download', 'preview', 'share') NOT NULL,
  session_id VARCHAR(64),
  user_id INT NULL,                    -- NULL for anonymous users
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  country VARCHAR(100),
  city VARCHAR(100),
  device_type ENUM('desktop', 'mobile', 'tablet') DEFAULT 'desktop',
  browser VARCHAR(50),
  os VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES audit_reports(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_report_event (report_id, event_type),
  INDEX idx_created_at (created_at),
  INDEX idx_session (session_id)
);
```

**Daily Aggregates Table (for performance):**

```sql
CREATE TABLE audit_report_analytics_daily (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  date DATE NOT NULL,
  views INT DEFAULT 0,
  downloads INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  UNIQUE KEY unique_report_date (report_id, date),
  FOREIGN KEY (report_id) REFERENCES audit_reports(id)
);
```

**Add counters to main reports table:**

```sql
ALTER TABLE audit_reports
  ADD COLUMN view_count INT DEFAULT 0,
  ADD COLUMN download_count INT DEFAULT 0;
```

### API Endpoints

**Track Events (Public):**

```
POST /api/reports/[slug]/track
Body: { event: 'view' | 'download' | 'preview' | 'share' }
```

**Get Report Analytics (Admin):**

```
GET /api/admin/reports/[id]/analytics
Query: ?from=2024-01-01&to=2024-12-31&granularity=day|week|month

Response:
{
  summary: {
    totalViews: 1234,
    totalDownloads: 567,
    uniqueVisitors: 890,
    avgTimeOnPage: 45,
    bounceRate: 32.5
  },
  timeline: [
    { date: '2024-01-01', views: 50, downloads: 12 },
    ...
  ],
  topReferrers: [
    { source: 'google.com', count: 200 },
    { source: 'direct', count: 150 },
    ...
  ],
  deviceBreakdown: {
    desktop: 60,
    mobile: 35,
    tablet: 5
  },
  geographicData: [
    { country: 'Ghana', views: 800, downloads: 300 },
    { country: 'Nigeria', views: 150, downloads: 50 },
    ...
  ]
}
```

**Get Overall Reports Analytics (Admin Dashboard):**

```
GET /api/admin/reports/analytics/overview
Query: ?from=2024-01-01&to=2024-12-31

Response:
{
  totals: {
    views: 50000,
    downloads: 12000,
    uniqueVisitors: 25000,
    reportsPublished: 150
  },
  topReports: [
    { id: 1, title: '...', views: 5000, downloads: 1200 },
    ...
  ],
  trendingReports: [...],  // Fastest growing in last 7 days
  categoryBreakdown: {
    financial: { views: 20000, downloads: 5000 },
    compliance: { views: 15000, downloads: 3500 },
    ...
  },
  timeline: [...]
}
```

### UI Components

**Admin Dashboard Widget (`components/admin/analytics/ReportAnalyticsWidget.vue`):**

```vue
<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <h3 class="text-lg font-semibold mb-4">Report Analytics</h3>

    <!-- Summary Stats -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="text-center">
        <p class="text-3xl font-bold text-primary">{{ stats.totalViews }}</p>
        <p class="text-sm text-gray-500">Total Views</p>
      </div>
      <div class="text-center">
        <p class="text-3xl font-bold text-green-600">{{ stats.totalDownloads }}</p>
        <p class="text-sm text-gray-500">Downloads</p>
      </div>
      <div class="text-center">
        <p class="text-3xl font-bold text-blue-600">{{ stats.uniqueVisitors }}</p>
        <p class="text-sm text-gray-500">Unique Visitors</p>
      </div>
      <div class="text-center">
        <p class="text-3xl font-bold text-purple-600">{{ downloadRate }}%</p>
        <p class="text-sm text-gray-500">Download Rate</p>
      </div>
    </div>

    <!-- Chart -->
    <LineChart :data="timelineData" />
  </div>
</template>
```

**Report Detail Analytics Tab (`pages/admin/reports/[id]/analytics.vue`):**

- Views/downloads over time chart
- Geographic heatmap
- Device breakdown pie chart
- Top referrers list
- Comparison with similar reports
- Export analytics data button

**Reports List with Analytics Columns:**

```typescript
const columns = [
  // ... existing columns
  {
    key: 'viewCount',
    label: 'Views',
    sortable: true,
    template: (row) => `${formatNumber(row.viewCount)}`
  },
  {
    key: 'downloadCount',
    label: 'Downloads',
    sortable: true,
    template: (row) => `${formatNumber(row.downloadCount)}`
  },
  {
    key: 'downloadRate',
    label: 'DL Rate',
    sortable: true,
    template: (row) => `${((row.downloadCount / row.viewCount) * 100).toFixed(1)}%`
  }
]
```

### Tracking Implementation

**Public Report View Page:**

```typescript
// pages/reports/[slug].vue
onMounted(async () => {
  // Track view event
  await $fetch(`/api/reports/${route.params.slug}/track`, {
    method: 'POST',
    body: { event: 'view' }
  })
})

// Track download
async function downloadReport() {
  await $fetch(`/api/reports/${route.params.slug}/track`, {
    method: 'POST',
    body: { event: 'download' }
  })
  // Proceed with download...
}
```

**Server-Side Tracking Endpoint:**

```typescript
// server/api/reports/[slug]/track.post.ts
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const { event: eventType } = await readBody(event)

  const report = await getReportBySlug(slug)
  if (!report) throw createError({ statusCode: 404 })

  // Get user info
  const ip = getRequestIP(event, { xForwardedFor: true })
  const userAgent = getHeader(event, 'user-agent')
  const referrer = getHeader(event, 'referer')
  const sessionId = getCookie(event, 'session_id') || generateSessionId()

  // Parse user agent for device/browser info
  const ua = parseUserAgent(userAgent)

  // Get geo location (optional - requires IP geolocation service)
  const geo = await getGeoLocation(ip)

  // Insert analytics event
  await db.insert(schema.auditReportAnalytics).values({
    reportId: report.id,
    eventType,
    sessionId,
    ipAddress: ip,
    userAgent,
    referrer,
    country: geo?.country,
    city: geo?.city,
    deviceType: ua.device,
    browser: ua.browser,
    os: ua.os
  })

  // Update counters (use atomic increment)
  if (eventType === 'view') {
    await db.execute(
      sql`UPDATE audit_reports SET view_count = view_count + 1 WHERE id = ${report.id}`
    )
  } else if (eventType === 'download') {
    await db.execute(
      sql`UPDATE audit_reports SET download_count = download_count + 1 WHERE id = ${report.id}`
    )
  }

  return { success: true }
})
```

### Daily Aggregation Job

**Background Job (runs nightly):**

```typescript
// server/tasks/aggregate-analytics.ts
export default defineTask({
  meta: { name: 'aggregate-analytics' },
  async run() {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    // Aggregate daily stats
    await db.execute(sql`
      INSERT INTO audit_report_analytics_daily (report_id, date, views, downloads, unique_visitors)
      SELECT
        report_id,
        DATE(created_at) as date,
        SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN event_type = 'download' THEN 1 ELSE 0 END) as downloads,
        COUNT(DISTINCT session_id) as unique_visitors
      FROM audit_report_analytics
      WHERE DATE(created_at) = ${dateStr}
      GROUP BY report_id, DATE(created_at)
      ON DUPLICATE KEY UPDATE
        views = VALUES(views),
        downloads = VALUES(downloads),
        unique_visitors = VALUES(unique_visitors)
    `)

    // Optional: Clean up old raw events (keep last 90 days)
    await db.execute(sql`
      DELETE FROM audit_report_analytics
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
    `)
  }
})
```

### Admin Analytics Dashboard Page

**New Page: `pages/admin/analytics/reports.vue`**

Features:

- Date range selector (7d, 30d, 90d, custom)
- Overall metrics cards (views, downloads, unique visitors)
- Line chart: Views & downloads over time
- Bar chart: Top 10 most viewed reports
- Bar chart: Top 10 most downloaded reports
- Pie chart: Views by category
- Pie chart: Device breakdown
- Table: Geographic distribution
- Export to CSV/PDF

### Privacy Considerations

- Hash/anonymize IP addresses after 30 days
- Comply with GDPR/data protection laws
- Add cookie consent for tracking
- Option to disable analytics per user preference
- Don't track logged-in admin users' views

### Implementation Tasks

1. [ ] Create analytics database tables and migration
2. [ ] Add view_count/download_count columns to reports
3. [ ] Create tracking API endpoint
4. [ ] Implement user agent parsing utility
5. [ ] Optional: Integrate IP geolocation service
6. [ ] Add tracking to public report view page
7. [ ] Add tracking to report download action
8. [ ] Create analytics API endpoints for admin
9. [ ] Build analytics dashboard widget
10. [ ] Build report detail analytics tab
11. [ ] Add analytics columns to reports list
12. [ ] Create daily aggregation background job
13. [ ] Build full analytics dashboard page
14. [ ] Add charts library (Chart.js or similar)
15. [ ] Implement data export functionality
16. [ ] Add privacy controls and cookie consent

### Dependencies

```bash
npm install ua-parser-js chart.js vue-chartjs
# Optional for geolocation:
npm install maxmind @maxmind/geoip2-node
```

---

### Feature 8: Related Reports

**Objective:** Link related reports together.

**Database Changes:**

```sql
CREATE TABLE audit_report_relations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  related_report_id INT NOT NULL,
  relation_type ENUM('follow-up', 'amendment', 'related') NOT NULL,
  FOREIGN KEY (report_id) REFERENCES audit_reports(id),
  FOREIGN KEY (related_report_id) REFERENCES audit_reports(id)
);
```

**Benefits:**

- Link follow-up reports to original audits
- Show related reports on public view
- Build report series/collections

---

### Feature 9: Report Search Enhancement

**Objective:** Full-text search across report content.

**Implementation Options:**

1. MySQL FULLTEXT index on translations
2. Elasticsearch integration for advanced search
3. PDF text extraction for content search

---

### Feature 10: Export Reports Metadata

**Objective:** Export report list to CSV/Excel.

**API Endpoint:**

```
GET /api/admin/reports/export?format=csv&filters=...
```

**Export Fields:**

- Title, Category, Year, Status
- Published Date, Created Date
- File URL, File Size
- View/Download counts

---

## Implementation Priority

### Phase 1 (High Priority)

1. **Thumbnails in List** - Quick win, improves UX
2. **Bulk Download** - Frequently requested feature

### Phase 2 (Medium Priority)

3. **Approval Workflow** - Important for governance
4. **Scheduled Publishing** - Common CMS feature

### Phase 3 (Medium-High Priority)

5. **Report Analytics** - Track views/downloads, dashboard insights
6. **Report Versioning** - Nice to have
7. **Related Reports** - Content organization

### Phase 4 (Future)

8. **Dynamic Categories** - Admin flexibility
9. **Full-text Search** - Advanced feature
10. **Export to CSV** - Reporting needs

---

## Technical Considerations

### Performance

- Lazy load thumbnails in list view
- Paginate bulk downloads (max 50 per request)
- Cache approval workflow queries
- Index new status columns

### Security

- Role-based access for workflow actions
- Audit log all approval decisions
- Validate file access in bulk download
- Rate limit bulk operations

### Testing

- Unit tests for workflow state transitions
- Integration tests for bulk download
- E2E tests for approval flow UI

---

## Timeline Estimate

| Feature                   | Complexity | Estimated Effort |
| ------------------------- | ---------- | ---------------- |
| Thumbnails in List        | Low        | 2-4 hours        |
| Bulk Download             | Medium     | 4-8 hours        |
| Approval Workflow         | High       | 16-24 hours      |
| Scheduled Publishing      | Medium     | 4-6 hours        |
| Report Versioning         | High       | 12-16 hours      |
| Report Analytics (Full)   | High       | 24-32 hours      |
| - Database & Tracking     | Medium     | 6-8 hours        |
| - Admin API Endpoints     | Medium     | 4-6 hours        |
| - Analytics Dashboard     | High       | 8-12 hours       |
| - Charts & Visualizations | Medium     | 6-8 hours        |

---

## Next Steps

1. Review and prioritize features with stakeholders
2. Create detailed technical specs for Phase 1 features
3. Set up feature branches for development
4. Implement and test incrementally
5. Deploy features behind feature flags if needed
