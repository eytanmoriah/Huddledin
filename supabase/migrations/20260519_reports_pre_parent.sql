-- ═══════════════════════════════════════════════════════════════════
-- reports pre-parent extension
-- Date: 2026-05-19
-- Design: audit-2026-05-10/fix-14-reports-pre-parent-investigation.md
-- Sub-commit: 4e of N for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Extends reports to support pre-parent patient reports. New column
-- specialist_patient_id references specialist_patients; existing
-- child_id NOT NULL is relaxed; CHECK constraint enforces strict XOR.
--
-- Adds pending_share BOOLEAN to track finalized reports awaiting
-- parent link. When a specialist finalizes a pre-parent report and
-- triggers Share, the modal converts intent to "share-when-connected"
-- and writes pending_share=true. On merge (Sub-commit 6), the function
-- flips pending_share→false and shared_with_parents→true, making the
-- report visible to the now-linked parent.
--
-- No RLS policy rewrites needed. Live policy
-- `specialists_crud_own_reports` filters only by specialist_id; pre-
-- parent rows pass via that clause without modification.
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.
--
-- Pre-verify (already verified May 19):
--   SELECT COUNT(*) FROM reports WHERE child_id IS NULL; -- expected 0
--   SELECT is_nullable FROM information_schema.columns
--     WHERE table_name='reports' AND column_name='child_id'; -- expected NO

-- ───────────────────────────────────────────────────────────────────
-- PHASE A: Schema changes
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE reports
  ADD COLUMN specialist_patient_id UUID NULL
  REFERENCES specialist_patients(id) ON DELETE CASCADE;

CREATE INDEX idx_reports_spec_patient
  ON reports(specialist_patient_id)
  WHERE specialist_patient_id IS NOT NULL;

ALTER TABLE reports ALTER COLUMN child_id DROP NOT NULL;

-- ───────────────────────────────────────────────────────────────────
-- PHASE B: XOR constraint (strict — reports don't have a
-- personal-report use case)
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE reports
  ADD CONSTRAINT reports_patient_xor CHECK (
    (child_id IS NOT NULL AND specialist_patient_id IS NULL)
    OR (child_id IS NULL AND specialist_patient_id IS NOT NULL)
  );

-- ───────────────────────────────────────────────────────────────────
-- PHASE C: pending_share column (for Option b "publish-when-linked")
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE reports
  ADD COLUMN pending_share BOOLEAN NOT NULL DEFAULT FALSE;

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries — paste after applying
-- ───────────────────────────────────────────────────────────────────
--
-- (1) Confirm new columns:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name='reports' AND column_name IN ('specialist_patient_id','pending_share','child_id')
--   ORDER BY column_name;
--   Expected:
--     child_id: uuid, YES (relaxed)
--     pending_share: boolean, NO, 'false'
--     specialist_patient_id: uuid, YES
--
-- (2) Confirm partial index:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE indexname='idx_reports_spec_patient';
--   Expected: 1 row.
--
-- (3) Confirm XOR constraint:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid='reports'::regclass AND conname='reports_patient_xor';
--   Expected: 1 row showing strict XOR.
--
-- (4) Confirm no row loss:
--   SELECT COUNT(*) FROM reports;
--   Expected: same count as before.

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails)
-- ───────────────────────────────────────────────────────────────────
--
-- ALTER TABLE reports DROP COLUMN IF EXISTS pending_share;
-- ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_patient_xor;
-- ALTER TABLE reports ALTER COLUMN child_id SET NOT NULL;
-- DROP INDEX IF EXISTS idx_reports_spec_patient;
-- ALTER TABLE reports DROP COLUMN IF EXISTS specialist_patient_id;
