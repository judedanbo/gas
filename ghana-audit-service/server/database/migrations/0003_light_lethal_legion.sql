CREATE TABLE `news_article_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`news_article_id` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`alt` varchar(255) NOT NULL DEFAULT '',
	`caption` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `news_article_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`alt` varchar(255) NOT NULL,
	`caption` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `event_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gallery_album_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`album_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	CONSTRAINT `gallery_album_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_album_locale` UNIQUE(`album_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `gallery_albums` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`cover_image_id` int,
	`published_at` datetime NOT NULL,
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `gallery_albums_id` PRIMARY KEY(`id`),
	CONSTRAINT `gallery_albums_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `department_function_translations` DROP FOREIGN KEY `department_function_translations_function_id_department_functions_id_fk`;
--> statement-breakpoint
ALTER TABLE `management_team_responsibilities` DROP FOREIGN KEY `management_team_responsibilities_management_team_id_management_team_id_fk`;
--> statement-breakpoint
ALTER TABLE `management_team_responsibility_translations` DROP FOREIGN KEY `management_team_responsibility_translations_responsibility_id_management_team_responsibilities_id_fk`;
--> statement-breakpoint
ALTER TABLE `management_team_translations` DROP FOREIGN KEY `management_team_translations_management_team_id_management_team_id_fk`;
--> statement-breakpoint
ALTER TABLE `past_ag_achievement_translations` DROP FOREIGN KEY `past_ag_achievement_translations_achievement_id_past_ag_achievements_id_fk`;
--> statement-breakpoint
ALTER TABLE `vacancy_requirement_translations` DROP FOREIGN KEY `vacancy_requirement_translations_requirement_id_vacancy_requirements_id_fk`;
--> statement-breakpoint
ALTER TABLE `news_article_tags` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `audit_logs` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `audit_reports` MODIFY COLUMN `category` enum('financial','compliance','it','performance','technical','follow-up','special') NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_reports` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `publications` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `news_articles` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `events` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `departments` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `management_team` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `past_auditors_general` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `team_members` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `vacancies` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `tenders` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `regional_offices` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `gallery_images` MODIFY COLUMN `uploaded_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `videos` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `rate_limit_entries` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `news_article_tags` ADD PRIMARY KEY(`news_article_id`,`tag_id`);--> statement-breakpoint
ALTER TABLE `gallery_images` ADD `album_id` int;--> statement-breakpoint
ALTER TABLE `news_article_images` ADD CONSTRAINT `news_article_images_news_article_id_news_articles_id_fk` FOREIGN KEY (`news_article_id`) REFERENCES `news_articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_images` ADD CONSTRAINT `event_images_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_album_translations` ADD CONSTRAINT `gallery_album_translations_album_id_gallery_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `gallery_albums`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_albums` ADD CONSTRAINT `gallery_albums_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_article_images_article` ON `news_article_images` (`news_article_id`);--> statement-breakpoint
CREATE INDEX `idx_article_images_sort` ON `news_article_images` (`news_article_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_event_images_event` ON `event_images` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_event_images_sort` ON `event_images` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_album_translations_locale` ON `gallery_album_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_albums_published` ON `gallery_albums` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_albums_is_published` ON `gallery_albums` (`is_published`);--> statement-breakpoint
ALTER TABLE `department_function_translations` ADD CONSTRAINT `dept_func_trans_function_id_fk` FOREIGN KEY (`function_id`) REFERENCES `department_functions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `management_team_responsibilities` ADD CONSTRAINT `mgmt_team_resp_team_id_fk` FOREIGN KEY (`management_team_id`) REFERENCES `management_team`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `management_team_responsibility_translations` ADD CONSTRAINT `mgmt_resp_trans_resp_id_fk` FOREIGN KEY (`responsibility_id`) REFERENCES `management_team_responsibilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `management_team_translations` ADD CONSTRAINT `mgmt_team_trans_team_id_fk` FOREIGN KEY (`management_team_id`) REFERENCES `management_team`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `past_ag_achievement_translations` ADD CONSTRAINT `past_ag_achiev_trans_achiev_id_fk` FOREIGN KEY (`achievement_id`) REFERENCES `past_ag_achievements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancy_requirement_translations` ADD CONSTRAINT `vac_req_trans_req_id_fk` FOREIGN KEY (`requirement_id`) REFERENCES `vacancy_requirements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_images` ADD CONSTRAINT `gallery_images_album_id_gallery_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `gallery_albums`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_gallery_album` ON `gallery_images` (`album_id`);