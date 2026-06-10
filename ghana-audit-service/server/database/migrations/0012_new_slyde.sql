CREATE TABLE `office_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`office_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text NOT NULL,
	CONSTRAINT `office_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_office_locale` UNIQUE(`office_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `office_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `office_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `office_types_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `offices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`type_id` int NOT NULL,
	`parent_id` int,
	`region` varchar(100) NOT NULL,
	`phone` varchar(50),
	`email` varchar(255),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `offices_id` PRIMARY KEY(`id`),
	CONSTRAINT `offices_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
DROP TABLE `regional_office_translations`;--> statement-breakpoint
DROP TABLE `regional_offices`;--> statement-breakpoint
ALTER TABLE `management_team` DROP FOREIGN KEY `management_team_regional_office_id_regional_offices_id_fk`;
--> statement-breakpoint
DROP INDEX `idx_management_team_regional_office` ON `management_team`;--> statement-breakpoint
ALTER TABLE `audit_logs` MODIFY COLUMN `action` enum('create','update','delete','restore','login','logout','export') NOT NULL;--> statement-breakpoint
ALTER TABLE `management_team` MODIFY COLUMN `role` enum('auditor-general','deputy-auditor-general','regional-auditor','district-auditor','sector-head','branch-head') NOT NULL;--> statement-breakpoint
ALTER TABLE `management_team` ADD `office_id` int;--> statement-breakpoint
ALTER TABLE `office_translations` ADD CONSTRAINT `office_translations_office_id_offices_id_fk` FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offices` ADD CONSTRAINT `offices_type_id_office_types_id_fk` FOREIGN KEY (`type_id`) REFERENCES `office_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offices` ADD CONSTRAINT `offices_parent_id_offices_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `offices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_office_translations_locale` ON `office_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_offices_slug` ON `offices` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_offices_region` ON `offices` (`region`);--> statement-breakpoint
CREATE INDEX `idx_offices_type_id` ON `offices` (`type_id`);--> statement-breakpoint
CREATE INDEX `idx_offices_parent_id` ON `offices` (`parent_id`);--> statement-breakpoint
ALTER TABLE `management_team` ADD CONSTRAINT `management_team_office_id_offices_id_fk` FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_management_team_office` ON `management_team` (`office_id`);--> statement-breakpoint
ALTER TABLE `management_team` DROP COLUMN `regional_office_id`;