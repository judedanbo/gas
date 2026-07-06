CREATE TABLE `board_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`role` enum('chairperson','member') NOT NULL,
	`name` varchar(255) NOT NULL,
	`title` varchar(255),
	`bio` text,
	`photo` varchar(500),
	`email` varchar(255),
	`phone` varchar(50),
	`display_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `board_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `board_members_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `idx_board_members_slug` ON `board_members` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_board_members_role` ON `board_members` (`role`);--> statement-breakpoint
CREATE INDEX `idx_board_members_active` ON `board_members` (`is_active`);