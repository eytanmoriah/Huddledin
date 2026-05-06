-- Exercise Templates table — Template Library Sub-commit 1 of 5
-- Per-specialist private library of reusable exercise specs.
-- Mirrors homework_exercises columns for clean copy semantics.

CREATE TABLE exercise_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  instructions TEXT,
  reps INT,
  sets INT,
  duration_seconds INT,
  measure_unit TEXT,
  attached_file_paths TEXT[] DEFAULT '{}',
  attached_file_names TEXT[] DEFAULT '{}',
  times_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exercise_templates_specialist ON exercise_templates(specialist_id);

ALTER TABLE exercise_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_templates_owner_select ON exercise_templates
  FOR SELECT USING (specialist_id = auth.uid());
CREATE POLICY exercise_templates_owner_insert ON exercise_templates
  FOR INSERT WITH CHECK (specialist_id = auth.uid());
CREATE POLICY exercise_templates_owner_update ON exercise_templates
  FOR UPDATE USING (specialist_id = auth.uid());
CREATE POLICY exercise_templates_owner_delete ON exercise_templates
  FOR DELETE USING (specialist_id = auth.uid());
