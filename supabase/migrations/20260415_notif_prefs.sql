-- Per-user push notification preferences (in-app notifications always fire)
-- Stored as JSONB on profiles so they sync across devices
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_prefs JSONB
  DEFAULT '{"reports":true,"chat":true,"homework":true,"appointments":false,"consult":true}'::jsonb;

-- Backfill existing rows with defaults (column default only applies to new rows)
UPDATE profiles SET notif_prefs = '{"reports":true,"chat":true,"homework":true,"appointments":false,"consult":true}'::jsonb
WHERE notif_prefs IS NULL;
