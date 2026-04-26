-- Homework Redesign Phase 1: homework_exercises + homework_completions_v2
-- New tables live alongside old; no existing tables dropped or modified.

-- ═══════════════════════════════════════
-- homework_exercises — individual exercises within a homework assignment
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS homework_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homework_tasks(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  instructions TEXT,
  reps INT,
  sets INT,
  duration_seconds INT,
  measure_unit TEXT,
  override_recurrence TEXT,
  override_specific_days TEXT[],
  override_time_of_day TEXT,
  attached_file_urls TEXT[] DEFAULT '{}',
  attached_file_names TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homework_exercises_homework_position
  ON homework_exercises (homework_id, position);

ALTER TABLE homework_exercises ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- homework_completions_v2 — per-exercise completion records
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS homework_completions_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_exercise_id UUID NOT NULL REFERENCES homework_exercises(id) ON DELETE CASCADE,
  homework_id UUID NOT NULL REFERENCES homework_tasks(id) ON DELETE CASCADE,
  child_id UUID NOT NULL,
  household_id TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  slot TEXT CHECK (slot IS NULL OR slot IN ('morning', 'afternoon', 'evening')),
  status TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'cant_do')),
  note TEXT,
  photo_url TEXT,
  logged_by UUID NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one completion per exercise per date per slot
-- For non-NULL slots, the column-level unique handles it:
ALTER TABLE homework_completions_v2
  ADD CONSTRAINT homework_completions_v2_unique_with_slot
  UNIQUE (homework_exercise_id, scheduled_date, slot);

-- For NULL slot (tasks with no time-of-day), partial unique index:
CREATE UNIQUE INDEX IF NOT EXISTS homework_completions_v2_unique_no_slot
  ON homework_completions_v2 (homework_exercise_id, scheduled_date)
  WHERE slot IS NULL;

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_hcv2_household_date
  ON homework_completions_v2 (household_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_hcv2_homework_date
  ON homework_completions_v2 (homework_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_hcv2_exercise_date
  ON homework_completions_v2 (homework_exercise_id, scheduled_date DESC);

ALTER TABLE homework_completions_v2 ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- Backfill: create one exercise per existing homework_tasks row
-- Idempotent (WHERE NOT EXISTS guard)
-- ═══════════════════════════════════════

INSERT INTO homework_exercises (homework_id, position, title, instructions, attached_file_urls, attached_file_names, created_at, updated_at)
SELECT id, 0, title, description, attached_file_urls, attached_file_names, created_at, COALESCE(updated_at, created_at)
FROM homework_tasks
WHERE NOT EXISTS (
  SELECT 1 FROM homework_exercises WHERE homework_id = homework_tasks.id
);
