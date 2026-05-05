# Database Schema Plan for Ghana Audit Service Website

## Overview

This document outlines the comprehensive MySQL/MariaDB database schema for the Ghana Audit Service website, including multi-language support (English/Akan) and admin dashboard capabilities.

## Technology Stack

- **Database**: MySQL/MariaDB
- **ORM**: Drizzle ORM
- **Framework**: Nuxt 3
- **Authentication**: JWT-based admin auth
- **i18n**: Separate translation tables for English & Akan

---

## Database Schema Summary

| Category                                      | Main Tables | Translation Tables | Total  |
| --------------------------------------------- | ----------- | ------------------ | ------ |
| Users & Auth                                  | 2           | 0                  | 2      |
| Content (Reports, Publications, News, Events) | 6           | 4                  | 10     |
| Organization (Depts, Team, Past AGs)          | 7           | 5                  | 12     |
| Careers & Tenders                             | 4           | 3                  | 7      |
| Regional Offices                              | 1           | 1                  | 2      |
| Media (Gallery, Videos)                       | 2           | 2                  | 4      |
| Existing (Newsletter, Contact, RateLimit)     | 3           | 0                  | 3      |
| **TOTAL**                                     | **25**      | **15**             | **40** |

---

## Schema Files

The database schema is organized into the following files under `server/database/schema/`:

| File                  | Tables                                                                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users.ts`            | users, audit_logs                                                                                                                                                                                                                         |
| `audit-reports.ts`    | audit_reports, audit_report_translations                                                                                                                                                                                                  |
| `publications.ts`     | publications, publication_translations                                                                                                                                                                                                    |
| `news.ts`             | news_articles, news_article_translations, tags, news_article_tags                                                                                                                                                                         |
| `events.ts`           | events, event_translations                                                                                                                                                                                                                |
| `organization.ts`     | departments, department_translations, department_functions, department_function_translations, team_members, team_member_translations, past_auditors_general, past_ag_translations, past_ag_achievements, past_ag_achievement_translations |
| `careers.ts`          | vacancies, vacancy_translations, vacancy_requirements, vacancy_requirement_translations                                                                                                                                                   |
| `tenders.ts`          | tenders, tender_translations                                                                                                                                                                                                              |
| `regional-offices.ts` | regional_offices, regional_office_translations                                                                                                                                                                                            |
| `media.ts`            | gallery_images, gallery_image_translations, videos, video_translations                                                                                                                                                                    |
| `existing.ts`         | newsletter_subscribers, rate_limit_entries, contact_submissions                                                                                                                                                                           |

---

## Translation Pattern

All content tables follow the same translation pattern:

1. **Main table** - Contains non-translatable fields (slug, dates, URLs, etc.)
2. **Translation table** - Contains translatable fields (title, description, content)
   - Foreign key to main table with CASCADE delete
   - Unique index on (entity_id, locale)
   - Supports 'en' (English) and 'ak' (Akan)

---

## Database Configuration

### Environment Variables

Add to `.env`:

```env
# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=gas_user
DB_PASSWORD=your-secure-password
DB_NAME=ghana_audit_service

# Admin Authentication (JWT)
JWT_SECRET=generate-a-32-character-secret-key
JWT_EXPIRES_IN=7d

# Initial admin user (for seeding)
ADMIN_EMAIL=admin@audit.gov.gh
ADMIN_PASSWORD=change-this-password
```

---

## Usage

### Generate Migrations

```bash
npm run db:generate
```

### Apply Migrations

```bash
npm run db:migrate
```

### Open Studio (Database GUI)

```bash
npm run db:studio
```

---

## Implementation Status

- [x] Schema files created (40 tables)
- [x] MySQL driver installed (mysql2)
- [x] Drizzle configuration updated
- [x] Database connection updated
- [x] Environment variables documented
- [x] Admin API routes
- [x] Data migration/seeding (db:seed script)
- [ ] Admin dashboard UI

---

## Admin API Routes

All admin API routes are located under `server/api/admin/`:

| Endpoint                  | Methods        | Description                    |
| ------------------------- | -------------- | ------------------------------ |
| `/auth/login`             | POST           | Authenticate and get JWT token |
| `/auth/logout`            | POST           | Log logout action              |
| `/auth/me`                | GET            | Get current user               |
| `/reports`                | GET, POST      | List/create audit reports      |
| `/reports/[id]`           | GET, PUT, DEL  | Get/update/delete report       |
| `/publications`           | GET, POST      | List/create publications       |
| `/publications/[id]`      | GET, PUT, DEL  | Get/update/delete publication  |
| `/news`                   | GET, POST      | List/create news articles      |
| `/news/[id]`              | GET, PUT, DEL  | Get/update/delete article      |
| `/events`                 | GET, POST      | List/create events             |
| `/events/[id]`            | GET, PUT, DEL  | Get/update/delete event        |
| `/vacancies`              | GET, POST      | List/create vacancies          |
| `/vacancies/[id]`         | GET, PUT, DEL  | Get/update/delete vacancy      |
| `/tenders`                | GET, POST      | List/create tenders            |
| `/tenders/[id]`           | GET, PUT, DEL  | Get/update/delete tender       |
| `/departments`            | GET, POST      | List/create departments        |
| `/departments/[id]`       | GET, PUT, DEL  | Get/update/delete department   |
| `/team-members`           | GET, POST      | List/create team members       |
| `/team-members/[id]`      | GET, PUT, DEL  | Get/update/delete member       |
| `/regional-offices`       | GET, POST      | List/create offices            |
| `/regional-offices/[id]`  | GET, PUT, DEL  | Get/update/delete office       |
| `/gallery`                | GET, POST      | List/create gallery images     |
| `/gallery/[id]`           | GET, PUT, DEL  | Get/update/delete image        |
| `/videos`                 | GET, POST      | List/create videos             |
| `/videos/[id]`            | GET, PUT, DEL  | Get/update/delete video        |
| `/tags`                   | GET, POST      | List/create tags               |
| `/tags/[id]`              | GET, PUT, DEL  | Get/update/delete tag          |
| `/users`                  | GET, POST      | List/create users (admin only) |
| `/users/[id]`             | GET, PUT, DEL  | Get/update/delete user         |
| `/audit-logs`             | GET            | List audit logs                |
| `/contact-submissions`    | GET            | List contact submissions       |
| `/contact-submissions/[id]`| GET, PUT      | Get/update submission status   |
| `/newsletter`             | GET            | List newsletter subscribers    |
| `/upload`                 | POST           | Upload files (PDF, images)     |

### Authentication

All admin routes (except `/auth/login`) require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Role-Based Access Control

| Role   | Permissions                          |
| ------ | ------------------------------------ |
| admin  | read, create, update, delete, users  |
| editor | read, create, update                 |
| viewer | read                                 |

### Seed Database

```bash
npm run db:seed
```

Creates the initial admin user from `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables.
