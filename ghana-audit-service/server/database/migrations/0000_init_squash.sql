CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`action` enum('create','update','delete','restore','login','logout','export') NOT NULL,
	`entity_type` varchar(100) NOT NULL,
	`entity_id` int,
	`changes` json,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`role` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
	`modules` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
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
CREATE TABLE `audit_report_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`audit_report_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`title` varchar(500) NOT NULL,
	`summary` text,
	CONSTRAINT `audit_report_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_audit_report_locale` UNIQUE(`audit_report_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `audit_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`category` enum('financial','compliance','it','performance','technical','follow-up','special') NOT NULL,
	`published_at` date NOT NULL,
	`file_url` varchar(500) NOT NULL,
	`file_size` varchar(50) NOT NULL,
	`thumbnail` varchar(500),
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`updated_by` int,
	`deleted_at` datetime,
	CONSTRAINT `audit_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_reports_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `publication_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publication_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`title` varchar(500) NOT NULL,
	`excerpt` text,
	`content` longtext,
	CONSTRAINT `publication_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_publication_locale` UNIQUE(`publication_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `publications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`type` enum('press-statement','bulletin','guideline','manual','strategy','law') NOT NULL,
	`published_at` date NOT NULL,
	`file_url` varchar(500),
	`file_size` varchar(50),
	`thumbnail` varchar(500),
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`updated_by` int,
	`deleted_at` datetime,
	CONSTRAINT `publications_id` PRIMARY KEY(`id`),
	CONSTRAINT `publications_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
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
CREATE TABLE `news_article_tags` (
	`news_article_id` int NOT NULL,
	`tag_id` int NOT NULL,
	CONSTRAINT `news_article_tags_news_article_id_tag_id` PRIMARY KEY(`news_article_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `news_article_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`news_article_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`title` varchar(500) NOT NULL,
	`excerpt` text NOT NULL,
	`content` longtext NOT NULL,
	CONSTRAINT `news_article_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_news_locale` UNIQUE(`news_article_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `news_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`author` varchar(255),
	`thumbnail` varchar(500),
	`category` varchar(100),
	`published_at` datetime NOT NULL,
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `news_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_articles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
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
CREATE TABLE `event_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`location` varchar(500),
	CONSTRAINT `event_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_event_locale` UNIQUE(`event_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`start_date` datetime NOT NULL,
	`end_date` datetime,
	`is_virtual` boolean NOT NULL DEFAULT false,
	`registration_url` varchar(500),
	`thumbnail` varchar(500),
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `department_function_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`function_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`description` varchar(500) NOT NULL,
	CONSTRAINT `department_function_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_function_locale` UNIQUE(`function_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `department_functions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`department_id` int NOT NULL,
	`display_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `department_functions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `department_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`department_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	CONSTRAINT `department_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_department_locale` UNIQUE(`department_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`head_id` int,
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `management_team` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`role` enum('auditor-general','deputy-auditor-general','regional-auditor','district-auditor','sector-head','branch-head') NOT NULL,
	`office_id` int,
	`department_id` int,
	`icon` varchar(100),
	`photo` varchar(500),
	`email` varchar(255),
	`phone` varchar(50),
	`display_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `management_team_id` PRIMARY KEY(`id`),
	CONSTRAINT `management_team_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `management_team_responsibilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`management_team_id` int NOT NULL,
	`display_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `management_team_responsibilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `management_team_responsibility_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responsibility_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`description` varchar(500) NOT NULL,
	CONSTRAINT `management_team_responsibility_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_responsibility_locale` UNIQUE(`responsibility_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `management_team_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`management_team_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`name` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`bio` text,
	CONSTRAINT `management_team_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_management_team_locale` UNIQUE(`management_team_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `past_ag_achievement_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`achievement_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`description` varchar(500) NOT NULL,
	CONSTRAINT `past_ag_achievement_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_achievement_locale` UNIQUE(`achievement_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `past_ag_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`past_ag_id` int NOT NULL,
	`display_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `past_ag_achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `past_ag_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`past_ag_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`legacy` text,
	CONSTRAINT `past_ag_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_past_ag_locale` UNIQUE(`past_ag_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `past_auditors_general` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenure_start` varchar(10) NOT NULL,
	`tenure_end` varchar(10) NOT NULL,
	`photo` varchar(500),
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `past_auditors_general_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_member_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`team_member_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`name` varchar(255) NOT NULL,
	`position` varchar(255) NOT NULL,
	`bio` text,
	CONSTRAINT `team_member_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_member_locale` UNIQUE(`team_member_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`department_id` int,
	`photo` varchar(500),
	`email` varchar(255),
	`phone` varchar(50),
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vacancies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`department_id` int,
	`location` varchar(255) NOT NULL,
	`type` enum('full-time','part-time','contract') NOT NULL,
	`deadline` date NOT NULL,
	`published_at` datetime NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `vacancies_id` PRIMARY KEY(`id`),
	CONSTRAINT `vacancies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `vacancy_requirement_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requirement_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`description` varchar(500) NOT NULL,
	CONSTRAINT `vacancy_requirement_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_requirement_locale` UNIQUE(`requirement_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `vacancy_requirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vacancy_id` int NOT NULL,
	`display_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `vacancy_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vacancy_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vacancy_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT `vacancy_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_vacancy_locale` UNIQUE(`vacancy_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `tender_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tender_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT `tender_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_tender_locale` UNIQUE(`tender_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `tenders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`reference_number` varchar(100) NOT NULL,
	`category` varchar(100) NOT NULL,
	`submission_deadline` datetime NOT NULL,
	`opening_date` datetime,
	`document_url` varchar(500),
	`published_at` datetime NOT NULL,
	`status` enum('open','closed','awarded','cancelled') NOT NULL DEFAULT 'open',
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `tenders_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenders_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `tenders_reference_number_unique` UNIQUE(`reference_number`)
);
--> statement-breakpoint
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
CREATE TABLE `gallery_image_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`image_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`alt` varchar(255) NOT NULL,
	`caption` varchar(500),
	CONSTRAINT `gallery_image_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_image_locale` UNIQUE(`image_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `gallery_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` varchar(500) NOT NULL,
	`category` varchar(100),
	`album_id` int,
	`uploaded_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `gallery_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`video_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	CONSTRAINT `video_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_video_locale` UNIQUE(`video_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` varchar(500) NOT NULL,
	`thumbnail` varchar(500),
	`duration` varchar(20),
	`published_at` datetime NOT NULL,
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `abuse_incidents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ts` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`kind` varchar(32) NOT NULL,
	`severity` varchar(16) NOT NULL DEFAULT 'info',
	`ip_hash` char(64),
	`ua_hash` char(64),
	`route_pattern` varchar(256),
	`route_path` varchar(512),
	`details` json,
	CONSTRAINT `abuse_incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bot_signatures` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ip_hash` char(64) NOT NULL,
	`ua_hash` char(64) NOT NULL,
	`ua_family` varchar(32) NOT NULL DEFAULT 'unknown',
	`ua_sample` varchar(512),
	`first_seen` datetime NOT NULL,
	`last_seen` datetime NOT NULL,
	`total_requests` int NOT NULL DEFAULT 0,
	`distinct_routes_24h` int NOT NULL DEFAULT 0,
	`rate_limit_hits_24h` int NOT NULL DEFAULT 0,
	`failed_logins_24h` int NOT NULL DEFAULT 0,
	`score` int NOT NULL DEFAULT 0,
	`classification` varchar(16) NOT NULL DEFAULT 'clean',
	`notes` text,
	`decided_by` int,
	`decided_at` datetime,
	`country` char(2),
	`asn` int,
	CONSTRAINT `bot_signatures_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_iphash_uahash` UNIQUE(`ip_hash`,`ua_hash`)
);
--> statement-breakpoint
CREATE TABLE `download_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ts` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`kind` varchar(16) NOT NULL,
	`target_id` int NOT NULL,
	`slug` varchar(256),
	`duration_ms` int NOT NULL,
	`bytes_out` int NOT NULL DEFAULT 0,
	`is_partial` boolean NOT NULL DEFAULT false,
	`ip_hash` char(64) NOT NULL,
	`ua_hash` char(64) NOT NULL,
	`ua_family` varchar(32) NOT NULL DEFAULT 'unknown',
	`country` char(2),
	`asn` int,
	`is_bot` boolean,
	CONSTRAINT `download_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `request_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ts` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`method` varchar(8) NOT NULL,
	`route_pattern` varchar(256) NOT NULL,
	`route_path` varchar(512) NOT NULL,
	`status` smallint NOT NULL,
	`duration_ms` int NOT NULL,
	`bytes_out` int NOT NULL DEFAULT 0,
	`cache_hit` boolean NOT NULL DEFAULT false,
	`ip_hash` char(64) NOT NULL,
	`ua_hash` char(64) NOT NULL,
	`ua_family` varchar(32) NOT NULL DEFAULT 'unknown',
	`country` char(2),
	`asn` int,
	`referrer_host` varchar(128),
	`is_bot` boolean,
	`role` varchar(16),
	`has_accept_language` boolean,
	`has_accept_encoding` boolean,
	`http_version` varchar(8),
	CONSTRAINT `request_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `route_stats_hourly` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`hour` datetime NOT NULL,
	`route_pattern` varchar(256) NOT NULL,
	`visits` int NOT NULL DEFAULT 0,
	`unique_ips` int NOT NULL DEFAULT 0,
	`bot_visits` int NOT NULL DEFAULT 0,
	`cache_hits` int NOT NULL DEFAULT 0,
	`bytes_out` bigint NOT NULL DEFAULT 0,
	`p50_ms` int NOT NULL DEFAULT 0,
	`p95_ms` int NOT NULL DEFAULT 0,
	`p99_ms` int NOT NULL DEFAULT 0,
	`status_2xx` int NOT NULL DEFAULT 0,
	`status_3xx` int NOT NULL DEFAULT 0,
	`status_4xx` int NOT NULL DEFAULT 0,
	`status_5xx` int NOT NULL DEFAULT 0,
	CONSTRAINT `route_stats_hourly_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hour_pattern` UNIQUE(`hour`,`route_pattern`)
);
--> statement-breakpoint
CREATE TABLE `search_queries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ts` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`query_text` varchar(256) NOT NULL,
	`query_hash` char(64) NOT NULL,
	`locale` char(8),
	`result_count` int NOT NULL DEFAULT 0,
	`ip_hash` char(64),
	`ua_family` varchar(32) NOT NULL DEFAULT 'unknown',
	CONSTRAINT `search_queries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(50),
	`subject` varchar(500) NOT NULL,
	`message` text NOT NULL,
	`submitted_at` datetime NOT NULL,
	`ip_address` varchar(45),
	`status` enum('pending','read','responded','archived') NOT NULL DEFAULT 'pending',
	`responded_at` datetime,
	`responded_by` int,
	CONSTRAINT `contact_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`subscribed_at` datetime NOT NULL,
	`confirmed` boolean NOT NULL DEFAULT false,
	`confirmed_at` datetime,
	`unsubscribed_at` datetime,
	`ip_address` varchar(45),
	`user_agent` text,
	CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_subscribers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `rate_limit_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`route` varchar(255) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`reset_time` bigint NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `rate_limit_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_report_translations` ADD CONSTRAINT `audit_report_translations_audit_report_id_audit_reports_id_fk` FOREIGN KEY (`audit_report_id`) REFERENCES `audit_reports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publication_translations` ADD CONSTRAINT `publication_translations_publication_id_publications_id_fk` FOREIGN KEY (`publication_id`) REFERENCES `publications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publications` ADD CONSTRAINT `publications_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publications` ADD CONSTRAINT `publications_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_article_images` ADD CONSTRAINT `news_article_images_news_article_id_news_articles_id_fk` FOREIGN KEY (`news_article_id`) REFERENCES `news_articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_article_tags` ADD CONSTRAINT `news_article_tags_news_article_id_news_articles_id_fk` FOREIGN KEY (`news_article_id`) REFERENCES `news_articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_article_tags` ADD CONSTRAINT `news_article_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_article_translations` ADD CONSTRAINT `news_article_translations_news_article_id_news_articles_id_fk` FOREIGN KEY (`news_article_id`) REFERENCES `news_articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_articles` ADD CONSTRAINT `news_articles_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_images` ADD CONSTRAINT `event_images_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_translations` ADD CONSTRAINT `event_translations_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_function_translations` ADD CONSTRAINT `dept_func_trans_function_id_fk` FOREIGN KEY (`function_id`) REFERENCES `department_functions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_functions` ADD CONSTRAINT `department_functions_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_translations` ADD CONSTRAINT `department_translations_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `management_team` ADD CONSTRAINT `management_team_office_id_offices_id_fk` FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `management_team` ADD CONSTRAINT `management_team_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `management_team_responsibilities` ADD CONSTRAINT `mgmt_team_resp_team_id_fk` FOREIGN KEY (`management_team_id`) REFERENCES `management_team`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `management_team_responsibility_translations` ADD CONSTRAINT `mgmt_resp_trans_resp_id_fk` FOREIGN KEY (`responsibility_id`) REFERENCES `management_team_responsibilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `management_team_translations` ADD CONSTRAINT `mgmt_team_trans_team_id_fk` FOREIGN KEY (`management_team_id`) REFERENCES `management_team`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `past_ag_achievement_translations` ADD CONSTRAINT `past_ag_achiev_trans_achiev_id_fk` FOREIGN KEY (`achievement_id`) REFERENCES `past_ag_achievements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `past_ag_achievements` ADD CONSTRAINT `past_ag_achievements_past_ag_id_past_auditors_general_id_fk` FOREIGN KEY (`past_ag_id`) REFERENCES `past_auditors_general`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `past_ag_translations` ADD CONSTRAINT `past_ag_translations_past_ag_id_past_auditors_general_id_fk` FOREIGN KEY (`past_ag_id`) REFERENCES `past_auditors_general`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_member_translations` ADD CONSTRAINT `team_member_translations_team_member_id_team_members_id_fk` FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancies` ADD CONSTRAINT `vacancies_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancies` ADD CONSTRAINT `vacancies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancy_requirement_translations` ADD CONSTRAINT `vac_req_trans_req_id_fk` FOREIGN KEY (`requirement_id`) REFERENCES `vacancy_requirements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancy_requirements` ADD CONSTRAINT `vacancy_requirements_vacancy_id_vacancies_id_fk` FOREIGN KEY (`vacancy_id`) REFERENCES `vacancies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancy_translations` ADD CONSTRAINT `vacancy_translations_vacancy_id_vacancies_id_fk` FOREIGN KEY (`vacancy_id`) REFERENCES `vacancies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tender_translations` ADD CONSTRAINT `tender_translations_tender_id_tenders_id_fk` FOREIGN KEY (`tender_id`) REFERENCES `tenders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenders` ADD CONSTRAINT `tenders_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_translations` ADD CONSTRAINT `office_translations_office_id_offices_id_fk` FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offices` ADD CONSTRAINT `offices_type_id_office_types_id_fk` FOREIGN KEY (`type_id`) REFERENCES `office_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offices` ADD CONSTRAINT `offices_parent_id_offices_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `offices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_album_translations` ADD CONSTRAINT `gallery_album_translations_album_id_gallery_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `gallery_albums`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_albums` ADD CONSTRAINT `gallery_albums_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_image_translations` ADD CONSTRAINT `gallery_image_translations_image_id_gallery_images_id_fk` FOREIGN KEY (`image_id`) REFERENCES `gallery_images`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_images` ADD CONSTRAINT `gallery_images_album_id_gallery_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `gallery_albums`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_images` ADD CONSTRAINT `gallery_images_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_translations` ADD CONSTRAINT `video_translations_video_id_videos_id_fk` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bot_signatures` ADD CONSTRAINT `bot_signatures_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_submissions` ADD CONSTRAINT `contact_submissions_responded_by_users_id_fk` FOREIGN KEY (`responded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_user` ON `admin_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_absolute_expires` ON `admin_sessions` (`absolute_expires_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_report_translations_locale` ON `audit_report_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_slug` ON `audit_reports` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_category` ON `audit_reports` (`category`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_published` ON `audit_reports` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_is_published` ON `audit_reports` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_publication_translations_locale` ON `publication_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_publications_slug` ON `publications` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_publications_type` ON `publications` (`type`);--> statement-breakpoint
CREATE INDEX `idx_publications_published` ON `publications` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_publications_is_published` ON `publications` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_article_images_article` ON `news_article_images` (`news_article_id`);--> statement-breakpoint
CREATE INDEX `idx_article_images_sort` ON `news_article_images` (`news_article_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_news_translations_locale` ON `news_article_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_news_slug` ON `news_articles` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_news_category` ON `news_articles` (`category`);--> statement-breakpoint
CREATE INDEX `idx_news_published` ON `news_articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_news_is_published` ON `news_articles` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_event_images_event` ON `event_images` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_event_images_sort` ON `event_images` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_event_translations_locale` ON `event_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_events_slug` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_events_start_date` ON `events` (`start_date`);--> statement-breakpoint
CREATE INDEX `idx_events_is_published` ON `events` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_department_translations_locale` ON `department_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_departments_slug` ON `departments` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_management_team_slug` ON `management_team` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_management_team_role` ON `management_team` (`role`);--> statement-breakpoint
CREATE INDEX `idx_management_team_active` ON `management_team` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_management_team_office` ON `management_team` (`office_id`);--> statement-breakpoint
CREATE INDEX `idx_management_team_department` ON `management_team` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_management_team_translations_locale` ON `management_team_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_team_member_translations_locale` ON `team_member_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_team_members_department` ON `team_members` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_vacancies_slug` ON `vacancies` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_vacancies_deadline` ON `vacancies` (`deadline`);--> statement-breakpoint
CREATE INDEX `idx_vacancies_active` ON `vacancies` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_vacancies_department` ON `vacancies` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_vacancy_translations_locale` ON `vacancy_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_tender_translations_locale` ON `tender_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_tenders_slug` ON `tenders` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tenders_ref_number` ON `tenders` (`reference_number`);--> statement-breakpoint
CREATE INDEX `idx_tenders_status` ON `tenders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tenders_deadline` ON `tenders` (`submission_deadline`);--> statement-breakpoint
CREATE INDEX `idx_tenders_category` ON `tenders` (`category`);--> statement-breakpoint
CREATE INDEX `idx_office_translations_locale` ON `office_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_offices_slug` ON `offices` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_offices_region` ON `offices` (`region`);--> statement-breakpoint
CREATE INDEX `idx_offices_type_id` ON `offices` (`type_id`);--> statement-breakpoint
CREATE INDEX `idx_offices_parent_id` ON `offices` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_album_translations_locale` ON `gallery_album_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_albums_published` ON `gallery_albums` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_albums_is_published` ON `gallery_albums` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_gallery_image_translations_locale` ON `gallery_image_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_gallery_category` ON `gallery_images` (`category`);--> statement-breakpoint
CREATE INDEX `idx_gallery_album` ON `gallery_images` (`album_id`);--> statement-breakpoint
CREATE INDEX `idx_gallery_uploaded` ON `gallery_images` (`uploaded_at`);--> statement-breakpoint
CREATE INDEX `idx_video_translations_locale` ON `video_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_videos_published` ON `videos` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_videos_is_published` ON `videos` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_inc_ts` ON `abuse_incidents` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_inc_kind_ts` ON `abuse_incidents` (`kind`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_inc_iphash_ts` ON `abuse_incidents` (`ip_hash`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_inc_severity_ts` ON `abuse_incidents` (`severity`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_bot_class_score` ON `bot_signatures` (`classification`,`score`);--> statement-breakpoint
CREATE INDEX `idx_bot_lastseen` ON `bot_signatures` (`last_seen`);--> statement-breakpoint
CREATE INDEX `idx_dl_ts` ON `download_events` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_dl_kind_target` ON `download_events` (`kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_dl_iphash_ts` ON `download_events` (`ip_hash`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_req_ts` ON `request_events` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_req_pattern_ts` ON `request_events` (`route_pattern`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_req_iphash_ts` ON `request_events` (`ip_hash`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_req_uahash` ON `request_events` (`ua_hash`);--> statement-breakpoint
CREATE INDEX `idx_req_status_ts` ON `request_events` (`status`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_stats_hour` ON `route_stats_hourly` (`hour`);--> statement-breakpoint
CREATE INDEX `idx_stats_pattern_hour` ON `route_stats_hourly` (`route_pattern`,`hour`);--> statement-breakpoint
CREATE INDEX `idx_sq_ts` ON `search_queries` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_sq_hash_ts` ON `search_queries` (`query_hash`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_sq_zero_ts` ON `search_queries` (`result_count`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_contact_status` ON `contact_submissions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_contact_submitted` ON `contact_submissions` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_newsletter_email` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE INDEX `idx_rate_limit_identifier` ON `rate_limit_entries` (`identifier`,`route`);