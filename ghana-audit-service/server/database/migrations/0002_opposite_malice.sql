ALTER TABLE `management_team` ADD `department_id` int;--> statement-breakpoint
ALTER TABLE `management_team` ADD CONSTRAINT `management_team_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_management_team_department` ON `management_team` (`department_id`);