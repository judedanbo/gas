CREATE TABLE `admin_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`last_activity_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`absolute_expires_at` datetime NOT NULL,
	`revoked_at` datetime,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	CONSTRAINT `admin_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_sessions_session_id_unique` UNIQUE(`session_id`)
);
--> statement-breakpoint
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_user` ON `admin_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_absolute_expires` ON `admin_sessions` (`absolute_expires_at`);
