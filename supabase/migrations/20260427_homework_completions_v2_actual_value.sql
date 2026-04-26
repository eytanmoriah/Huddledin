-- Add actual_value column to homework_completions_v2
-- Stores partial completion counts (reps done, minutes done).
-- NULL means "did the prescribed amount" or "no measure applies".
-- RLS unchanged — column inherits existing row-level policies.

ALTER TABLE homework_completions_v2 ADD COLUMN IF NOT EXISTS actual_value INT;

-- Verify column added:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='homework_completions_v2' AND column_name='actual_value';

-- Verify RLS still active:
-- SELECT polname FROM pg_policy WHERE polrelid='homework_completions_v2'::regclass;
