CREATE TABLE `carousel_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_type` enum('news','event','report','gallery') NOT NULL,
	`ref_id` int NOT NULL,
	`mode` enum('pinned','hidden') NOT NULL DEFAULT 'pinned',
	`pinned_until` date,
	`image_count` int,
	`image_ids` json,
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `carousel_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_carousel_items_ref` UNIQUE(`item_type`,`ref_id`)
);
--> statement-breakpoint
CREATE TABLE `carousel_settings` (
	`id` int NOT NULL,
	`news_count` int NOT NULL DEFAULT 2,
	`events_count` int NOT NULL DEFAULT 2,
	`reports_count` int NOT NULL DEFAULT 2,
	`updated_by` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carousel_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `carousel_settings` ADD CONSTRAINT `carousel_settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_carousel_items_order` ON `carousel_items` (`display_order`);