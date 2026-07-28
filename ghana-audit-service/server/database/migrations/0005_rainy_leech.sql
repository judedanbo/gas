CREATE TABLE `site_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`section` enum('home','about_service','about_legacy') NOT NULL,
	`stat_key` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`suffix` varchar(16),
	`icon` varchar(255),
	`display_order` int NOT NULL DEFAULT 0,
	`source` enum('manual','hr_api') NOT NULL DEFAULT 'manual',
	`hr_metric_key` varchar(100),
	`manual_value` int NOT NULL DEFAULT 0,
	`api_value` int,
	`override_enabled` boolean NOT NULL DEFAULT false,
	`api_synced_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_stats_stat_key_unique` UNIQUE(`stat_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_site_stats_section` ON `site_stats` (`section`);