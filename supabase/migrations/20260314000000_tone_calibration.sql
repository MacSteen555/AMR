-- Add tone calibration columns to locations
ALTER TABLE app.locations ADD COLUMN IF NOT EXISTS tone_calibration jsonb;
ALTER TABLE app.locations ADD COLUMN IF NOT EXISTS negative_contact_email text;
ALTER TABLE app.locations ADD COLUMN IF NOT EXISTS google_primary_category text;
