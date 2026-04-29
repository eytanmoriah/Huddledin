-- Personal blocks: appointments without an assigned patient
-- Specialist creates these for "Lunch", "Conference", etc.
-- Visible to the specialist on every calendar view; never to parents.

ALTER TABLE appointments ALTER COLUMN child_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_apt_spec_personal
  ON appointments(specialist_id, date)
  WHERE child_id IS NULL AND deleted_at IS NULL;

-- REQUIRED MANUAL VERIFICATION:
-- In Supabase Dashboard → Authentication → Policies on the appointments table:
-- Confirm SELECT policy for specialists allows rows where specialist_id = auth.uid()
-- regardless of child_id (i.e., includes child_id IS NULL).
-- Same for INSERT WITH CHECK.
-- If the policy uses child_id IN (...) as a hard requirement, personal blocks
-- will be invisible to the specialist who created them. Update to OR with
-- specialist_id = auth.uid() if needed.
