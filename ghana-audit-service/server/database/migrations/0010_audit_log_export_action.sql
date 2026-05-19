-- Add 'export' to the audit_logs.action MySQL ENUM so PDF report
-- generations and other future export actions can be recorded.
ALTER TABLE `audit_logs`
    MODIFY COLUMN `action` ENUM('create','update','delete','restore','login','logout','export') NOT NULL;
