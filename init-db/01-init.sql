-- Ghana Audit Service Database Initialization
-- This script runs automatically when the MySQL container is first created

-- Ensure we're using the correct database
USE ghana_audit_service;

-- Set character encoding
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create any initial tables or seed data here
-- Note: If using Drizzle ORM migrations, you may want to leave this empty
-- and run migrations through the application instead

-- Example: Create a basic audit log table
-- CREATE TABLE IF NOT EXISTS audit_logs (
--     id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--     action VARCHAR(100) NOT NULL,
--     entity_type VARCHAR(100),
--     entity_id VARCHAR(100),
--     user_id VARCHAR(100),
--     ip_address VARCHAR(45),
--     details JSON,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     INDEX idx_action (action),
--     INDEX idx_entity (entity_type, entity_id),
--     INDEX idx_created_at (created_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grant additional permissions if needed
-- GRANT ALL PRIVILEGES ON ghana_audit_service.* TO 'gas_user'@'%';
-- FLUSH PRIVILEGES;

SELECT 'Ghana Audit Service database initialized successfully!' AS status;
