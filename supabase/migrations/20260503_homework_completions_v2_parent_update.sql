-- Homework Completion Overhaul Sub-commit 1: parent UPDATE + DELETE on homework_completions_v2
-- Enables editing of existing completion records and full clearing via "Delete response".
-- Locked decisions:
--   - Any household member can edit/delete (co-parent corrections without requiring original logger)
--   - logged_at is preserved on UPDATE in application code, NOT enforced at the DB layer

CREATE POLICY "parents_update_household_completions_v2"
  ON homework_completions_v2 FOR UPDATE
  TO authenticated
  USING (
    household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "parents_delete_household_completions_v2"
  ON homework_completions_v2 FOR DELETE
  TO authenticated
  USING (
    household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

-- Verify policies after running:
--   SELECT polname FROM pg_policy WHERE polrelid='homework_completions_v2'::regclass;
-- Should include both new policies plus the existing SELECT/INSERT policies.
