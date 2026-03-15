-- Add digest preference columns to team_memberships
ALTER TABLE "app"."team_memberships"
  ADD COLUMN "digest_frequency" text NOT NULL DEFAULT 'off',
  ADD COLUMN "digest_last_sent_at" timestamp with time zone;

-- Add check constraint for valid values
ALTER TABLE "app"."team_memberships"
  ADD CONSTRAINT "team_memberships_digest_frequency_check"
  CHECK ("digest_frequency" IN ('off', 'daily', 'weekly'));

-- Index for cron query efficiency: find all active digest subscriptions
CREATE INDEX "idx_team_memberships_digest_active"
  ON "app"."team_memberships" ("digest_frequency")
  WHERE "digest_frequency" != 'off';
