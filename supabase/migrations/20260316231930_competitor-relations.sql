-- Migration: Competitor Monitoring Redesign
-- Adds location_ids array to competitors for tracking which locations compete.

ALTER TABLE "app"."competitors"
    ADD COLUMN IF NOT EXISTS "location_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL;
