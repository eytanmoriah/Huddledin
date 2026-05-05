-- Session A: Homework redesign — schema additions for video media + renewable concept
-- Pre-migration: 30 completions (25 done, 3 cant_do, 2 skipped), 3 photo rows, 46 homework_tasks (37 open_ended, 7 end_date, 2 next_appointment, status distribution: 21 active / 11 archived / 14 deleted)
-- This migration is purely additive: 3 new columns, 1 backfill UPDATE on 3 rows
-- Does NOT touch end_date NULL rows (intentional per duration_type model)
-- Does NOT modify completion status enum (existing 'done'/'skipped'/'cant_do' is correct)

ALTER TABLE homework_completions_v2
  ADD COLUMN media_type TEXT
  CHECK (media_type IN ('image', 'video'));

ALTER TABLE homework_tasks
  ADD COLUMN is_renewable BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE homework_tasks
  ADD COLUMN renewal_period_days INTEGER;

UPDATE homework_completions_v2
  SET media_type = 'image'
  WHERE photo_path IS NOT NULL AND media_type IS NULL;
