-- ═══════════════════════════════════════════════════════════════════
-- vault_notes pre-parent extension
-- Date: 2026-05-18
-- Design: audit-2026-05-10/fix-11-notes-pre-parent-investigation.md
-- Sub-commit: 4a of N for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Extends vault_notes to support pre-parent patient notes. New column
-- specialist_patient_id references specialist_patients; existing
-- child_id becomes nullable; CHECK constraint enforces XOR.
--
-- INSERT and UPDATE policies are rewritten to accept either path via
-- a new helper i_own_specialist_patient(uuid). SELECT, DELETE, and
-- parent-mark-as-read policies already handle pre-parent correctly
-- without changes (verified via investigation).
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.
--
-- Pre-verify (run first, expect specific results):
--   1. SELECT COUNT(*) FROM vault_notes WHERE child_id IS NULL;
--      Expected: 0 (already verified May 18).
--   2. SELECT data_type FROM information_schema.columns
--      WHERE table_name='vault_notes' AND column_name='specialist_id';
--      Expected: 'text' (already verified).
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PHASE A: Schema changes
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE vault_notes
  ADD COLUMN specialist_patient_id UUID NULL
  REFERENCES specialist_patients(id) ON DELETE CASCADE;

CREATE INDEX idx_vault_notes_spec_patient
  ON vault_notes(specialist_patient_id)
  WHERE specialist_patient_id IS NOT NULL;

ALTER TABLE vault_notes ALTER COLUMN child_id DROP NOT NULL;

ALTER TABLE vault_notes
  ADD CONSTRAINT vault_notes_patient_xor CHECK (
    (child_id IS NOT NULL AND specialist_patient_id IS NULL)
    OR (child_id IS NULL AND specialist_patient_id IS NOT NULL)
  );

-- ───────────────────────────────────────────────────────────────────
-- PHASE B: New helper function (mirror of i_am_specialist_for_child)
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.i_own_specialist_patient(p_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.specialist_patients
    WHERE id = p_id
      AND specialist_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.i_own_specialist_patient(uuid) TO authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────
-- PHASE C: Policy rewrites (INSERT + UPDATE)
--
-- Both policies extend with an OR clause that allows pre-parent paths
-- where child_id is null and the caller owns the referenced
-- specialist_patient. Existing connected-child behavior preserved
-- byte-for-byte in the first clause.
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "vault_notes_insert" ON vault_notes;
CREATE POLICY "vault_notes_insert"
  ON vault_notes FOR INSERT TO public
  WITH CHECK (
    specialist_id = (auth.uid())::text
    AND (
      (child_id IS NOT NULL AND i_am_specialist_for_child(child_id))
      OR
      (child_id IS NULL AND specialist_patient_id IS NOT NULL AND i_own_specialist_patient(specialist_patient_id))
    )
  );

DROP POLICY IF EXISTS "vault_notes_update" ON vault_notes;
CREATE POLICY "vault_notes_update"
  ON vault_notes FOR UPDATE TO public
  USING (
    specialist_id = (auth.uid())::text
    AND (
      (child_id IS NOT NULL AND i_am_specialist_for_child(child_id))
      OR
      (child_id IS NULL AND specialist_patient_id IS NOT NULL AND i_own_specialist_patient(specialist_patient_id))
    )
  );

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries — paste after applying
-- ───────────────────────────────────────────────────────────────────
--
-- (1) Confirm new column + nullability + constraint:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name='vault_notes' AND column_name IN ('child_id','specialist_patient_id')
--   ORDER BY column_name;
--   Expected: child_id YES, specialist_patient_id YES.
--
-- (2) Confirm CHECK constraint:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid='vault_notes'::regclass AND conname='vault_notes_patient_xor';
--   Expected: 1 row showing the XOR constraint.
--
-- (3) Confirm new index:
--   SELECT indexname FROM pg_indexes WHERE indexname='idx_vault_notes_spec_patient';
--   Expected: 1 row.
--
-- (4) Confirm new helper function:
--   SELECT routine_name, security_type
--   FROM information_schema.routines
--   WHERE routine_name='i_own_specialist_patient';
--   Expected: 1 row, security_type=DEFINER.
--   Smoke test: SELECT i_own_specialist_patient(gen_random_uuid()); -- expects false
--
-- (5) Confirm policies updated:
--   SELECT policyname, cmd, with_check, qual FROM pg_policies
--   WHERE tablename='vault_notes' AND policyname IN ('vault_notes_insert','vault_notes_update')
--   ORDER BY policyname;
--   Expected: 2 rows, both showing the new OR clause text containing 'i_own_specialist_patient'.

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails)
-- ───────────────────────────────────────────────────────────────────
--
-- DROP POLICY IF EXISTS "vault_notes_insert" ON vault_notes;
-- CREATE POLICY "vault_notes_insert"
--   ON vault_notes FOR INSERT TO public
--   WITH CHECK ((specialist_id = (auth.uid())::text) AND i_am_specialist_for_child(child_id));
--
-- DROP POLICY IF EXISTS "vault_notes_update" ON vault_notes;
-- CREATE POLICY "vault_notes_update"
--   ON vault_notes FOR UPDATE TO public
--   USING ((specialist_id = (auth.uid())::text) AND i_am_specialist_for_child(child_id));
--
-- DROP FUNCTION IF EXISTS public.i_own_specialist_patient(uuid);
-- ALTER TABLE vault_notes DROP CONSTRAINT IF EXISTS vault_notes_patient_xor;
-- ALTER TABLE vault_notes ALTER COLUMN child_id SET NOT NULL;
-- DROP INDEX IF EXISTS idx_vault_notes_spec_patient;
-- ALTER TABLE vault_notes DROP COLUMN IF EXISTS specialist_patient_id;
