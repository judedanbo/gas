CREATE TABLE `report_upload_jobs` (
	`id` varchar(36) NOT NULL,
	`user_id` int,
	`report_id` int,
	`status` enum('queued','storing','thumbnail','optimizing','completed','failed') NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`phase` varchar(32),
	`page` int NOT NULL DEFAULT 0,
	`total_pages` int NOT NULL DEFAULT 0,
	`original_name` varchar(255) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`file_url` varchar(500) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size` bigint unsigned NOT NULL,
	`final_size` bigint unsigned,
	`preset` enum('screen','ebook','printer') NOT NULL DEFAULT 'ebook',
	`thumbnail_url` varchar(500),
	`optimization_job_id` varchar(36),
	`optimization_status` enum('pending','success','error') NOT NULL DEFAULT 'pending',
	`optimization_result` json,
	`error` varchar(255),
	`error_code` varchar(50),
	`dismissed_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`completed_at` datetime,
	CONSTRAINT `report_upload_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `report_upload_jobs` ADD CONSTRAINT `report_upload_jobs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_upload_jobs` ADD CONSTRAINT `report_upload_jobs_report_id_audit_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `audit_reports`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_report_upload_jobs_status` ON `report_upload_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_report_upload_jobs_user` ON `report_upload_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_report_upload_jobs_report` ON `report_upload_jobs` (`report_id`);--> statement-breakpoint
CREATE INDEX `idx_report_upload_jobs_file_url` ON `report_upload_jobs` (`file_url`);--> statement-breakpoint
CREATE INDEX `idx_report_upload_jobs_created` ON `report_upload_jobs` (`created_at`);