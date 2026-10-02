-- One-time production baseline for the squashed Drizzle migration history.
--
-- WHY: Production's schema was originally created with `drizzle-kit push`, which
-- does NOT record anything in `__drizzle_migrations`. After squashing the broken
-- migration chain into a single baseline (`0000_init_squash`), the file-based
-- migrate Job would otherwise see an empty ledger, assume nothing is applied, and
-- try to CREATE tables that already exist ("Table 'audit_logs' already exists").
--
-- This script seeds the ledger so the Job recognizes the baseline as already
-- applied and becomes a safe no-op on prod, while still applying any FUTURE
-- migrations generated on top of the baseline.
--
-- PRECONDITION (verify before running): prod's schema must already match the
-- current Drizzle schema. Confirm with `drizzle-kit push` against prod showing
-- "No changes" / nothing to apply. If push reports pending changes, apply them
-- first — do NOT baseline a prod DB that is behind the schema.
--
-- The hash + created_at below are the exact values Drizzle writes when it applies
-- `0000_init_squash.sql` to a fresh DB (created_at = the migration's journal
-- `when` from meta/_journal.json). Run ONCE against the prod database.
-- Idempotent: safe to re-run (the INSERT is a no-op if any row already exists).

CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id` bigint unsigned AUTO_INCREMENT,
  `hash` text NOT NULL,
  `created_at` bigint,
  CONSTRAINT `__drizzle_migrations_id` PRIMARY KEY (`id`)
);

INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
SELECT
  '4bae540fae96167e6c375a3f8e4f32e8e0ba81e7c0a92b46ed1d3b4538fe9923',
  1781453046275
WHERE NOT EXISTS (SELECT 1 FROM `__drizzle_migrations`);
