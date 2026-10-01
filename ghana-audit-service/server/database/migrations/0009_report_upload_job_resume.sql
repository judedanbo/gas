ALTER TABLE `report_upload_jobs` ADD `allow_drop_bookmarks` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `report_upload_jobs` ADD `run_id` varchar(36);--> statement-breakpoint
ALTER TABLE `report_upload_jobs` ADD `worker` varchar(255);--> statement-breakpoint
ALTER TABLE `report_upload_jobs` ADD `attempts` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `report_upload_jobs` ADD `interrupted_at` datetime;--> statement-breakpoint
CREATE INDEX `idx_report_upload_jobs_interrupted` ON `report_upload_jobs` (`interrupted_at`);