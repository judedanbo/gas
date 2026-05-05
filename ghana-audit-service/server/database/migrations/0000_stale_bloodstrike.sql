CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`action` enum('create','update','delete','restore','login','logout') NOT NULL,
	`entity_type` varchar(100) NOT NULL,
	`entity_id` int,
	`changes` json,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`role` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
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
	`category` enum('financial','compliance','it','performance','technical','follow-up') NOT NULL,
	`published_at` date NOT NULL,
	`year` year NOT NULL,
	`file_url` varchar(500) NOT NULL,
	`file_size` varchar(50) NOT NULL,
	`thumbnail` varchar(500),
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	`thumbnail` varchar(500),
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`updated_by` int,
	`deleted_at` datetime,
	CONSTRAINT `publications_id` PRIMARY KEY(`id`),
	CONSTRAINT `publications_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `news_article_tags` (
	`news_article_id` int NOT NULL,
	`tag_id` int NOT NULL,
	CONSTRAINT `news_article_tags_news_article_id_tag_id_pk` PRIMARY KEY(`news_article_id`,`tag_id`)
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_slug_unique` UNIQUE(`slug`)
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `tenders_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenders_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `tenders_reference_number_unique` UNIQUE(`reference_number`)
);
--> statement-breakpoint
CREATE TABLE `regional_office_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`office_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text NOT NULL,
	CONSTRAINT `regional_office_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_office_locale` UNIQUE(`office_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `regional_offices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`region` varchar(100) NOT NULL,
	`phone` varchar(50),
	`email` varchar(255),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `regional_offices_id` PRIMARY KEY(`id`),
	CONSTRAINT `regional_offices_slug_unique` UNIQUE(`slug`)
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
	`uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`created_by` int,
	`deleted_at` datetime,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`)
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `rate_limit_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_report_translations` ADD CONSTRAINT `audit_report_translations_audit_report_id_audit_reports_id_fk` FOREIGN KEY (`audit_report_id`) REFERENCES `audit_reports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publication_translations` ADD CONSTRAINT `publication_translations_publication_id_publications_id_fk` FOREIGN KEY (`publication_id`) REFERENCES `publications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publications` ADD CONSTRAINT `publications_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publications` ADD CONSTRAINT `publications_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_article_tags` ADD CONSTRAINT `news_article_tags_news_article_id_news_articles_id_fk` FOREIGN KEY (`news_article_id`) REFERENCES `news_articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_article_tags` ADD CONSTRAINT `news_article_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_article_translations` ADD CONSTRAINT `news_article_translations_news_article_id_news_articles_id_fk` FOREIGN KEY (`news_article_id`) REFERENCES `news_articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_articles` ADD CONSTRAINT `news_articles_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_translations` ADD CONSTRAINT `event_translations_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_function_translations` ADD CONSTRAINT `department_function_translations_function_id_department_functions_id_fk` FOREIGN KEY (`function_id`) REFERENCES `department_functions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_functions` ADD CONSTRAINT `department_functions_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_translations` ADD CONSTRAINT `department_translations_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `past_ag_achievement_translations` ADD CONSTRAINT `past_ag_achievement_translations_achievement_id_past_ag_achievements_id_fk` FOREIGN KEY (`achievement_id`) REFERENCES `past_ag_achievements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `past_ag_achievements` ADD CONSTRAINT `past_ag_achievements_past_ag_id_past_auditors_general_id_fk` FOREIGN KEY (`past_ag_id`) REFERENCES `past_auditors_general`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `past_ag_translations` ADD CONSTRAINT `past_ag_translations_past_ag_id_past_auditors_general_id_fk` FOREIGN KEY (`past_ag_id`) REFERENCES `past_auditors_general`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_member_translations` ADD CONSTRAINT `team_member_translations_team_member_id_team_members_id_fk` FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancies` ADD CONSTRAINT `vacancies_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancies` ADD CONSTRAINT `vacancies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancy_requirement_translations` ADD CONSTRAINT `vacancy_requirement_translations_requirement_id_vacancy_requirements_id_fk` FOREIGN KEY (`requirement_id`) REFERENCES `vacancy_requirements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancy_requirements` ADD CONSTRAINT `vacancy_requirements_vacancy_id_vacancies_id_fk` FOREIGN KEY (`vacancy_id`) REFERENCES `vacancies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vacancy_translations` ADD CONSTRAINT `vacancy_translations_vacancy_id_vacancies_id_fk` FOREIGN KEY (`vacancy_id`) REFERENCES `vacancies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tender_translations` ADD CONSTRAINT `tender_translations_tender_id_tenders_id_fk` FOREIGN KEY (`tender_id`) REFERENCES `tenders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenders` ADD CONSTRAINT `tenders_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regional_office_translations` ADD CONSTRAINT `regional_office_translations_office_id_regional_offices_id_fk` FOREIGN KEY (`office_id`) REFERENCES `regional_offices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_image_translations` ADD CONSTRAINT `gallery_image_translations_image_id_gallery_images_id_fk` FOREIGN KEY (`image_id`) REFERENCES `gallery_images`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery_images` ADD CONSTRAINT `gallery_images_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_translations` ADD CONSTRAINT `video_translations_video_id_videos_id_fk` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_submissions` ADD CONSTRAINT `contact_submissions_responded_by_users_id_fk` FOREIGN KEY (`responded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_audit_report_translations_locale` ON `audit_report_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_slug` ON `audit_reports` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_category` ON `audit_reports` (`category`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_year` ON `audit_reports` (`year`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_published` ON `audit_reports` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_is_published` ON `audit_reports` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_publication_translations_locale` ON `publication_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_publications_slug` ON `publications` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_publications_type` ON `publications` (`type`);--> statement-breakpoint
CREATE INDEX `idx_publications_published` ON `publications` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_publications_is_published` ON `publications` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_news_translations_locale` ON `news_article_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_news_slug` ON `news_articles` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_news_category` ON `news_articles` (`category`);--> statement-breakpoint
CREATE INDEX `idx_news_published` ON `news_articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_news_is_published` ON `news_articles` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_event_translations_locale` ON `event_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_events_slug` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_events_start_date` ON `events` (`start_date`);--> statement-breakpoint
CREATE INDEX `idx_events_is_published` ON `events` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_department_translations_locale` ON `department_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_departments_slug` ON `departments` (`slug`);--> statement-breakpoint
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
CREATE INDEX `idx_regional_office_translations_locale` ON `regional_office_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_regional_offices_slug` ON `regional_offices` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_regional_offices_region` ON `regional_offices` (`region`);--> statement-breakpoint
CREATE INDEX `idx_gallery_image_translations_locale` ON `gallery_image_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_gallery_category` ON `gallery_images` (`category`);--> statement-breakpoint
CREATE INDEX `idx_gallery_uploaded` ON `gallery_images` (`uploaded_at`);--> statement-breakpoint
CREATE INDEX `idx_video_translations_locale` ON `video_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_videos_published` ON `videos` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_videos_is_published` ON `videos` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_contact_status` ON `contact_submissions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_contact_submitted` ON `contact_submissions` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_newsletter_email` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE INDEX `idx_rate_limit_identifier` ON `rate_limit_entries` (`identifier`,`route`);