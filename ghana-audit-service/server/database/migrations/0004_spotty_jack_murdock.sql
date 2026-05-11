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
DROP INDEX `idx_audit_reports_year` ON `audit_reports`;--> statement-breakpoint
ALTER TABLE `bot_signatures` ADD CONSTRAINT `bot_signatures_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE `audit_reports` DROP COLUMN `year`;