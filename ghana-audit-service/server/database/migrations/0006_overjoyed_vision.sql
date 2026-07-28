CREATE TABLE `auditor_general_message` (
	`id` int AUTO_INCREMENT NOT NULL,
	`photo` varchar(500),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auditor_general_message_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditor_general_message_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`message_id` int NOT NULL,
	`locale` enum('en','ak') NOT NULL,
	`name` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`excerpt` text NOT NULL,
	`full_message` text NOT NULL,
	CONSTRAINT `auditor_general_message_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_ag_message_locale` UNIQUE(`message_id`,`locale`)
);
--> statement-breakpoint
ALTER TABLE `auditor_general_message_translations` ADD CONSTRAINT `ag_message_trans_message_id_fk` FOREIGN KEY (`message_id`) REFERENCES `auditor_general_message`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_ag_message_translations_locale` ON `auditor_general_message_translations` (`locale`);