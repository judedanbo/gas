ALTER TABLE `users` ADD `modules` json;--> statement-breakpoint
-- Backfill: preserve current behaviour for existing non-admin users so they
-- don't lose access. Admins are intentionally left NULL (the application
-- short-circuits admins to all modules). Soft-deleted users are skipped; an
-- admin re-assigns modules if such a user is ever restored.
UPDATE `users`
SET `modules` = '["reports","content","careers","organization","media","analytics","communications"]'
WHERE `role` <> 'admin' AND `deleted_at` IS NULL AND `modules` IS NULL;
