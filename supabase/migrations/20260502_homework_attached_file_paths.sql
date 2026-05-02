-- Homework attachments: path-based storage alongside legacy URL columns
-- Foundation for Session B storage picker work.
-- attached_file_urls (TEXT[]) stores signed URLs that expire after 15 minutes.
-- Going forward, store paths in attached_file_paths and sign at render time.
-- Both columns are populated during transition; reads prefer paths when present.
-- No backfill: legacy URL rows stay untouched.

ALTER TABLE homework_tasks ADD COLUMN IF NOT EXISTS attached_file_paths TEXT[] DEFAULT '{}';
ALTER TABLE homework_exercises ADD COLUMN IF NOT EXISTS attached_file_paths TEXT[] DEFAULT '{}';
