CREATE TABLE `popups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`image_url` varchar(500) NOT NULL,
	`alt_text` varchar(500),
	`link_url` varchar(500),
	`open_in_new_tab` boolean NOT NULL DEFAULT false,
	`starts_at` datetime,
	`ends_at` datetime,
	`display_seconds` int NOT NULL DEFAULT 30,
	`is_dismissible` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `popups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `popups` ADD CONSTRAINT `popups_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_popups_live` ON `popups` (`is_active`,`starts_at`,`ends_at`);