-- Homework Redesign Phase 1: RLS policies for homework_exercises + homework_completions_v2

-- ═══════════════════════════════════════
-- homework_exercises RLS
-- ═══════════════════════════════════════

-- Specialists: full CRUD on exercises belonging to their homework
CREATE POLICY "specialists_crud_own_exercises"
  ON homework_exercises FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM homework_tasks
      WHERE homework_tasks.id = homework_exercises.homework_id
        AND homework_tasks.specialist_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM homework_tasks
      WHERE homework_tasks.id = homework_exercises.homework_id
        AND homework_tasks.specialist_id = auth.uid()
    )
  );

-- Parents: read-only access to exercises for their household's homework
CREATE POLICY "parents_read_household_exercises"
  ON homework_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM homework_tasks
      WHERE homework_tasks.id = homework_exercises.homework_id
        AND homework_tasks.household_id = (
          SELECT CAST(household_id AS TEXT) FROM profiles WHERE id = auth.uid()
        )
    )
  );

-- ═══════════════════════════════════════
-- homework_completions_v2 RLS
-- ═══════════════════════════════════════

-- Specialists: read-only access to completions for their homework
CREATE POLICY "specialists_read_completions_v2"
  ON homework_completions_v2 FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM homework_tasks
      WHERE homework_tasks.id = homework_completions_v2.homework_id
        AND homework_tasks.specialist_id = auth.uid()
    )
  );

-- Parents: read + insert + update completions for their household
-- (no DELETE — completions are immutable records)
CREATE POLICY "parents_read_household_completions_v2"
  ON homework_completions_v2 FOR SELECT
  TO authenticated
  USING (
    household_id = (SELECT CAST(household_id AS TEXT) FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "parents_insert_household_completions_v2"
  ON homework_completions_v2 FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id = (SELECT CAST(household_id AS TEXT) FROM profiles WHERE id = auth.uid())
    AND logged_by = auth.uid()
  );

-- No UPDATE or DELETE policy — completions are immutable INSERT-only records.
