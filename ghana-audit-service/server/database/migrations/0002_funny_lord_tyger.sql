ALTER TABLE `abuse_incidents` ADD `ip` varchar(45);--> statement-breakpoint
ALTER TABLE `bot_signatures` ADD `ip` varchar(45);--> statement-breakpoint
ALTER TABLE `download_events` ADD `ip` varchar(45);--> statement-breakpoint
ALTER TABLE `request_events` ADD `ip` varchar(45);--> statement-breakpoint
ALTER TABLE `search_queries` ADD `ip` varchar(45);--> statement-breakpoint
CREATE INDEX `idx_inc_ip_ts` ON `abuse_incidents` (`ip`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_bot_ip` ON `bot_signatures` (`ip`);--> statement-breakpoint
CREATE INDEX `idx_dl_ip_ts` ON `download_events` (`ip`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_req_ip_ts` ON `request_events` (`ip`,`ts`);