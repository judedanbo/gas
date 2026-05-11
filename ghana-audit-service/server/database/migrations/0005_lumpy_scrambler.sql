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
CREATE INDEX `idx_sq_ts` ON `search_queries` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_sq_hash_ts` ON `search_queries` (`query_hash`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_sq_zero_ts` ON `search_queries` (`result_count`,`ts`);