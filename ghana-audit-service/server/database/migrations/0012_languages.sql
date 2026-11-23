CREATE TABLE `languages` (
	`code` varchar(10) NOT NULL,
	`name` varchar(100) NOT NULL,
	`native_name` varchar(100) NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` int,
	CONSTRAINT `languages_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `ui_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locale` varchar(10) NOT NULL,
	`message_key` varchar(191) NOT NULL,
	`value` text NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` int,
	CONSTRAINT `ui_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_ui_translations_key` UNIQUE(`locale`,`message_key`)
);
--> statement-breakpoint
ALTER TABLE `languages` ADD CONSTRAINT `languages_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ui_translations` ADD CONSTRAINT `ui_translations_locale_languages_code_fk` FOREIGN KEY (`locale`) REFERENCES `languages`(`code`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ui_translations` ADD CONSTRAINT `ui_translations_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Akan ships with the app (i18n/locales/ak.json) and was public before
-- languages became configurable. It starts added but switched off; an admin
-- turns it on at /admin/languages.
INSERT INTO `languages` (`code`, `name`, `native_name`, `is_enabled`, `sort_order`) VALUES ('ak', 'Akan', 'Akan', false, 0);
