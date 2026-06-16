ALTER TABLE `users` ADD `failed_login_attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lockout_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `locked_until` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD `last_failed_login_at` datetime;