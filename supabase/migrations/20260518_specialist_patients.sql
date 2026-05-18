-- ═══════════════════════════════════════════════════════════════════
-- Pre-parent patients — schema for specialist_patients table
-- Date: 2026-05-18
-- Design: audit-2026-05-10/design-pre-parent-patients.md (Section 6)
-- Sub-commit: 1 of N for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.
-- Verify procedure included at the bottom.

CREATE TABLE specialist_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  dob DATE NULL,
  pronouns TEXT NULL CHECK (pronouns IS NULL OR pronouns IN ('he','she','they')),
  avatar_emoji TEXT DEFAULT '🧒',
  color TEXT,
  parent_email_hint TEXT NULL,
  parent_name_hint TEXT NULL,
  notes TEXT NULL,
  linked_child_id UUID NULL REFERENCES children(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','linked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spec_patients_specialist
  ON specialist_patients(specialist_id);

CREATE INDEX idx_spec_patients_linked
  ON specialist_patients(linked_child_id)
  WHERE linked_child_id IS NOT NULL;

CREATE INDEX idx_spec_patients_status
  ON specialist_patients(specialist_id, status);

ALTER TABLE specialist_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY spec_patients_owner_all
  ON specialist_patients FOR ALL
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE specialist_patients;

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries — paste these after the migration
-- ───────────────────────────────────────────────────────────────────
-- 1. Confirm table exists with all columns:
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'specialist_patients'
--    ORDER BY ordinal_position;
--
-- 2. Confirm RLS is enabled + policy exists:
--    SELECT policyname, cmd, roles, qual, with_check
--    FROM pg_policies
--    WHERE tablename = 'specialist_patients';
--
-- 3. Confirm indexes:
--    SELECT indexname FROM pg_indexes
--    WHERE tablename = 'specialist_patients';
--
-- 4. Confirm realtime publication:
--    SELECT pubname FROM pg_publication_tables
--    WHERE tablename = 'specialist_patients';

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails)
-- ───────────────────────────────────────────────────────────────────
-- ALTER PUBLICATION supabase_realtime DROP TABLE specialist_patients;
-- DROP POLICY IF EXISTS spec_patients_owner_all ON specialist_patients;
-- DROP TABLE IF EXISTS specialist_patients;
