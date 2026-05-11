ALTER TABLE `request_events` ADD `has_accept_language` boolean;--> statement-breakpoint
ALTER TABLE `request_events` ADD `has_accept_encoding` boolean;--> statement-breakpoint
ALTER TABLE `request_events` ADD `http_version` varchar(8);