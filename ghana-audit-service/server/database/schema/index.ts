/**
 * Ghana Audit Service Database Schema
 *
 * This file exports all database tables and types for the application.
 * The schema uses MySQL/MariaDB with Drizzle ORM and supports multi-language
 * content through separate translation tables.
 */

// Users & Authentication
export * from './users'
export * from './sessions'

// Content Tables
export * from './audit-reports'
export * from './report-upload-jobs'
export * from './publications'
export * from './news'
export * from './events'

// Organization Tables
export * from './organization'

// Auditor-General message (singleton home-page section content)
export * from './auditor-general'

// Site Statistics (editable public figures)
export * from './site-stats'

// Site pop-ups (scheduled image + link shown on page load)
export * from './popups'

// Home page carousel (settings + per-item overrides)
export * from './carousel'

// Site languages + admin-entered interface translations
export * from './languages'

// Audit Service apps and websites (CitizensEye, Tracker, …)
export * from './service-apps'

// Career & Procurement Tables
export * from './careers'
export * from './tenders'

// Location Tables
export * from './offices'

// Media Tables
export * from './media'

// Analytics & Abuse Detection
export * from './analytics'

// Existing Tables (migrated from SQLite)
export * from './existing'
