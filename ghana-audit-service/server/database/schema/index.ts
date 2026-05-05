/**
 * Ghana Audit Service Database Schema
 *
 * This file exports all database tables and types for the application.
 * The schema uses MySQL/MariaDB with Drizzle ORM and supports multi-language
 * content through separate translation tables.
 */

// Users & Authentication
export * from './users'

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
export * from './regional-offices'

// Media Tables
export * from './media'

// Existing Tables (migrated from SQLite)
export * from './existing'
