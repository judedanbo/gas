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
export * from './publications'
export * from './news'
export * from './events'

// Organization Tables
export * from './organization'

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
