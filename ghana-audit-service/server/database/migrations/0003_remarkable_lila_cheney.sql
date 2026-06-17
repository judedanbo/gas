ALTER TABLE `users` ADD `status` enum('pending','active','inactive') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `invitation_token` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `invitation_token_expires_at` datetime;